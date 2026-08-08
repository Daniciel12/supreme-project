import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/tasks
// Body: { title: string, goalId: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { title, goalId } = body;

    if (!title || !goalId) {
      return NextResponse.json(
        { error: "Campos 'title' e 'goalId' são obrigatórios." },
        { status: 400 }
      );
    }

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
    console.error("[POST /api/tasks]", error);
    return NextResponse.json(
      { error: "Erro ao criar tarefa." },
      { status: 500 }
    );
  }
}
