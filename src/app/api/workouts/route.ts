import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createWorkoutPayloadSchema,
  dashboardDateSchema,
} from "@/lib/api-validation";

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

// GET /api/workouts?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const rawDate = request.nextUrl.searchParams.get("date");

    if (!rawDate) {
      const workouts = await prisma.workout.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(workouts, { status: 200 });
    }

    const parsedDate = dashboardDateSchema.safeParse(rawDate);

    if (!parsedDate.success) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const date = utcDate(parsedDate.data);
    const workouts = await prisma.workout.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        dayOfWeek: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        completions: {
          where: { date },
          select: { id: true },
          take: 1,
        },
      },
    });

    return NextResponse.json(
      workouts.map(({ completions, ...workout }) => ({
        ...workout,
        completed: completions.length > 0,
      })),
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/workouts]", error);
    return NextResponse.json(
      { error: "Erro ao listar treinos." },
      { status: 500 }
    );
  }
}

// POST /api/workouts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createWorkoutPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const workout = await prisma.workout.create({
      data: {
        userId: session.user.id,
        name: payload.data.name,
        dayOfWeek: payload.data.dayOfWeek,
        notes: payload.data.notes,
      },
    });

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/workouts]", error);
    return NextResponse.json(
      { error: "Erro ao criar treino." },
      { status: 500 }
    );
  }
}
