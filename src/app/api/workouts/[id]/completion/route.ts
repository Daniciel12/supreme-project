import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  workoutCompletionPayloadSchema,
  workoutIdSchema,
} from "@/lib/api-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

// PATCH /api/workouts/[id]/completion
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedId = workoutIdSchema.safeParse((await params).id);
    const payload = workoutCompletionPayloadSchema.safeParse(await request.json());

    if (!parsedId.success || !payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const workoutId = parsedId.data;
    const userId = session.user.id;
    const date = utcDate(payload.data.date);

    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId },
      select: { id: true },
    });

    if (!workout) {
      return NextResponse.json(
        { error: "Treino não encontrado." },
        { status: 404 }
      );
    }

    if (payload.data.completed) {
      await prisma.workoutCompletion.upsert({
        where: {
          workout_date_unique: { workoutId, date },
        },
        update: { userId },
        create: { workoutId, userId, date },
      });
    } else {
      await prisma.workoutCompletion.deleteMany({
        where: { workoutId, userId, date },
      });
    }

    return NextResponse.json(
      {
        workoutId,
        date: payload.data.date,
        completed: payload.data.completed,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[PATCH /api/workouts/[id]/completion]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar execução do treino." },
      { status: 500 }
    );
  }
}
