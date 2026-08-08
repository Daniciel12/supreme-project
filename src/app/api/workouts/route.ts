import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

// GET /api/workouts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const workouts = await prisma.workout.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(workouts, { status: 200 });
  } catch (error) {
    console.error("[GET /api/workouts]", error);
    return NextResponse.json(
      { error: "Erro ao listar treinos." },
      { status: 500 }
    );
  }
}

// POST /api/workouts
// Body: { name: string, dayOfWeek: string, completed?: boolean }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { name, dayOfWeek, completed } = body;

    if (!name || !dayOfWeek) {
      return NextResponse.json(
        { error: "Campos 'name' e 'dayOfWeek' são obrigatórios." },
        { status: 400 }
      );
    }

    const normalizedDay = String(dayOfWeek).toUpperCase();

    if (!VALID_DAYS.includes(normalizedDay)) {
      return NextResponse.json(
        { error: `'dayOfWeek' deve ser um de: ${VALID_DAYS.join(", ")}.` },
        { status: 400 }
      );
    }

    const workout = await prisma.workout.create({
      data: {
        userId: session.user.id,
        name,
        dayOfWeek: normalizedDay,
        completed: completed ?? false,
      },
    });

    return NextResponse.json(workout, { status: 201 });
  } catch (error) {
    console.error("[POST /api/workouts]", error);
    return NextResponse.json(
      { error: "Erro ao criar treino." },
      { status: 500 }
    );
  }
}
