import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGoalPayloadSchema } from "@/lib/api-validation";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const goals = await prisma.goal.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isCompleted: "asc" }, { deadline: "asc" }, { title: "asc" }],
      include: {
        tasks: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(goals, { status: 200 });
  } catch (error) {
    console.error("[GET /api/goals]", error);
    return NextResponse.json(
      { error: "Erro ao listar metas." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createGoalPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const { title, category, deadline } = payload.data;
    const goal = await prisma.goal.create({
      data: {
        title,
        category,
        deadline: deadline
          ? new Date(`${deadline}T00:00:00.000Z`)
          : undefined,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ ...goal, tasks: [] }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/goals]", error);
    return NextResponse.json(
      { error: "Erro ao criar meta." },
      { status: 500 }
    );
  }
}
