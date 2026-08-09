import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardDateSchema } from "@/lib/api-validation";

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedDate = dashboardDateSchema.safeParse(
      request.nextUrl.searchParams.get("date")
    );

    if (!parsedDate.success) {
      return NextResponse.json({ error: "Data inválida." }, { status: 400 });
    }

    const selectedDate = utcDate(parsedDate.data);
    const windowStart = new Date(selectedDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 6);

    const completions = await prisma.workoutCompletion.findMany({
      where: {
        userId: session.user.id,
        date: { gte: windowStart, lte: selectedDate },
      },
      orderBy: { date: "asc" },
      select: { date: true },
    });

    const activeDays = new Set(completions.map((completion) => dateKey(completion.date)));

    return NextResponse.json(
      {
        date: parsedDate.data,
        activeDaysLast7: activeDays.size,
        completionsLast7: completions.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/workouts/summary]", error);
    return NextResponse.json(
      { error: "Erro ao carregar resumo de treinos." },
      { status: 500 }
    );
  }
}
