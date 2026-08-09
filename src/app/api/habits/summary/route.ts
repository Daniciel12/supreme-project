import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardDateSchema } from "@/lib/api-validation";

function dateContext(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const dayStart = new Date(Date.UTC(year, month - 1, day));
  const historyStart = new Date(dayStart);
  historyStart.setUTCDate(historyStart.getUTCDate() - 6);

  return { dayStart, historyStart };
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

    const { dayStart, historyStart } = dateContext(parsedDate.data);
    const habits = await prisma.habit.findMany({
      where: { userId: session.user.id, active: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        active: true,
        checkIns: {
          where: {
            userId: session.user.id,
            completed: true,
            date: { gte: historyStart, lte: dayStart },
          },
          select: { date: true },
        },
      },
    });

    const activityDays = new Set<string>();
    const dailyHabits = habits.map(({ checkIns, ...habit }) => {
      let checkedToday = false;

      for (const checkIn of checkIns) {
        const key = checkIn.date.toISOString().slice(0, 10);
        activityDays.add(key);
        if (key === parsedDate.data) checkedToday = true;
      }

      return { ...habit, checkedToday };
    });

    const completedToday = dailyHabits.filter(
      (habit) => habit.checkedToday
    ).length;

    return NextResponse.json(
      {
        date: parsedDate.data,
        habits: dailyHabits,
        summary: {
          completedToday,
          totalActive: dailyHabits.length,
          activeDays7: activityDays.size,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/habits/summary]", error);
    return NextResponse.json(
      { error: "Erro ao carregar resumo de hábitos." },
      { status: 500 }
    );
  }
}
