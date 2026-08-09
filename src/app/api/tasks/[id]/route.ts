import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  taskIdSchema,
  updateTaskStatusPayloadSchema,
} from "@/lib/api-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedId = taskIdSchema.safeParse((await params).id);
    const payload = updateTaskStatusPayloadSchema.safeParse(await request.json());

    if (!parsedId.success || !payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const id = parsedId.data;
    const task = await prisma.task.findFirst({
      where: { id, goal: { userId: session.user.id } },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Tarefa não encontrada." },
        { status: 404 }
      );
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { isCompleted: payload.data.isCompleted },
    });

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[PATCH /api/tasks/[id]]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar tarefa." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedId = taskIdSchema.safeParse((await params).id);

    if (!parsedId.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const id = parsedId.data;
    const task = await prisma.task.findFirst({
      where: { id, goal: { userId: session.user.id } },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Tarefa não encontrada." },
        { status: 404 }
      );
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/tasks/[id]]", error);
    return NextResponse.json(
      { error: "Erro ao remover tarefa." },
      { status: 500 }
    );
  }
}
