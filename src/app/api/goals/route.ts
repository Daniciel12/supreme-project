import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/goals
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const goals = await prisma.goal.findMany({
      where: { userId: session.user.id },
      orderBy: { title: "asc" },
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

// POST /api/goals
// Body: { title: string, category: string, deadline?: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { title, category, deadline } = body;

    if (!title || !category) {
      return NextResponse.json(
        { error: "Campos 'title' e 'category' são obrigatórios." },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
        title,
        category,
        deadline: deadline ? new Date(deadline) : undefined,
        userId: session.user.id,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("[POST /api/goals]", error);
    return NextResponse.json(
      { error: "Erro ao criar meta." },
      { status: 500 }
    );
  }
}
