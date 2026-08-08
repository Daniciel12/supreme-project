import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkInPayloadSchema } from "@/lib/api-validation";

// POST /api/checkins
// Body: { habitId: string, date?: string (ISO), note?: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = checkInPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Payload inválido." },
        { status: 400 }
      );
    }

    const { habitId, date, note } = payload.data;

    const habit = await prisma.habit.findFirst({
      where: {
        id: habitId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!habit) {
      return NextResponse.json(
        { error: "Hábito não encontrado." },
        { status: 404 }
      );
    }

    // Normaliza para meia-noite UTC, já que CheckIn.date é @db.Date
    // e a constraint de unicidade é por (habitId, date).
    const checkInDate = date ? new Date(date) : new Date();
    checkInDate.setUTCHours(0, 0, 0, 0);

    const checkIn = await prisma.checkIn.create({
      data: {
        habitId,
        userId: session.user.id,
        date: checkInDate,
        note,
      },
    });

    return NextResponse.json(checkIn, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    // P2002 = violação de constraint única (Prisma)
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json(
        { error: "Check-in já registrado para este hábito hoje." },
        { status: 400 }
      );
    }

    console.error("[POST /api/checkins]", error);
    return NextResponse.json(
      { error: "Erro ao registrar check-in." },
      { status: 500 }
    );
  }
}
