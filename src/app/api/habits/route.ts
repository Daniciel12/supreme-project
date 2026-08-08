import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/habits
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const habits = await prisma.habit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(habits, { status: 200 });
  } catch (error) {
    console.error("[GET /api/habits]", error);
    return NextResponse.json(
      { error: "Erro ao listar hábitos." },
      { status: 500 }
    );
  }
}

// POST /api/habits
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Campo 'name' é obrigatório." },
        { status: 400 }
      );
    }

    const habit = await prisma.habit.create({
      data: { name, description, icon, color, userId: session.user.id },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error("[POST /api/habits]", error);
    return NextResponse.json(
      { error: "Erro ao criar hábito." },
      { status: 500 }
    );
  }
}
