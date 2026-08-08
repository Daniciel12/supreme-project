import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskPayloadSchema } from "@/lib/api-validation";

// POST /api/tasks
// Body: { title: string, goalId: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createTaskPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Payload inválido." },
        { status: 400 }
      );
    }

    const { title, goalId } = payload.data;

    // Garante que a meta pertence ao usuário autenticado antes de vincular
    // a tarefa a ela.
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId: session.user.id },
    });

    if (!goal) {
      return NextResponse.json(
        { error: "Meta não encontrada." },
        { status: 404 }
      );
    }

    const task = await prisma.task.create({
      data: { title, goalId },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/tasks]", error);
    return NextResponse.json(
      { error: "Erro ao criar tarefa." },
      { status: 500 }
    );
  }
}
