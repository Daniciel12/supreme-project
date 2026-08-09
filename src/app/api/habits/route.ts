import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHabitPayloadSchema } from "@/lib/api-validation";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const habits = await prisma.habit.findMany({
      where: { userId: session.user.id, active: true },
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createHabitPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const habit = await prisma.habit.create({
      data: {
        ...payload.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/habits]", error);
    return NextResponse.json(
      { error: "Erro ao criar hábito." },
      { status: 500 }
    );
  }
}
