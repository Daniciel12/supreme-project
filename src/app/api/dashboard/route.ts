import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dashboardDateSchema } from "@/lib/api-validation";

const DAY_KEYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;

type DecimalLike = { toString(): string };

function moneyToCents(value: DecimalLike | null | undefined) {
  if (!value) return BigInt(0);

  const raw = value.toString();
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents =
    BigInt(whole || "0") * BigInt(100) +
    BigInt((fraction + "00").slice(0, 2));

  return negative ? -cents : cents;
}

function centsToNumber(value: bigint) {
  return Number(value) / 100;
}

function dateContext(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const dayStart = new Date(Date.UTC(year, month - 1, day));
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  return {
    dayStart,
    monthStart,
    monthEnd,
    dayOfWeek: DAY_KEYS[dayStart.getUTCDay()],
  };
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

    const userId = session.user.id;
    const date = parsedDate.data;
    const { dayStart, monthStart, monthEnd, dayOfWeek } = dateContext(date);

    const [
      habits,
      pendingTasks,
      goals,
      workouts,
      latestPhysicalRecord,
      initialBalances,
      paidIncomeTotal,
      paidExpenseTotal,
      monthlyIncome,
      monthlyExpense,
      monthlyPendingCount,
    ] = await Promise.all([
      prisma.habit.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          checkIns: {
            where: { date: dayStart, completed: true },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.task.findMany({
        where: {
          isCompleted: false,
          goal: { userId, isCompleted: false },
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          goal: { select: { id: true, title: true } },
        },
      }),
      prisma.goal.findMany({
        where: { userId, isCompleted: false },
        orderBy: [{ deadline: "asc" }, { title: "asc" }],
        take: 4,
        select: {
          id: true,
          title: true,
          category: true,
          deadline: true,
          tasks: { select: { isCompleted: true } },
        },
      }),
      prisma.workout.findMany({
        where: { userId, dayOfWeek },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          notes: true,
          completions: {
            where: { date: dayStart },
            select: { id: true },
            take: 1,
          },
        },
      }),
      prisma.physicalRecord.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
          weight: true,
          bodyFat: true,
          imc: true,
          shapeStatus: true,
        },
      }),
      prisma.financialAccount.aggregate({
        where: { userId },
        _sum: { initialBalance: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, isPaid: true, type: "INCOME" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, isPaid: true, type: "EXPENSE" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          isPaid: true,
          type: "INCOME",
          date: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          isPaid: true,
          type: "EXPENSE",
          date: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          userId,
          isPaid: false,
          date: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    const dashboardHabits = habits.map(({ checkIns, ...habit }) => ({
      ...habit,
      checkedToday: checkIns.length > 0,
    }));
    const habitsCompleted = dashboardHabits.filter(
      (habit) => habit.checkedToday
    ).length;

    const dashboardWorkouts = workouts.map(({ completions, ...workout }) => ({
      ...workout,
      completed: completions.length > 0,
    }));

    const dashboardGoals = goals.map(({ tasks, deadline, ...goal }) => {
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((task) => task.isCompleted).length;

      return {
        ...goal,
        deadline: deadline?.toISOString() ?? null,
        isOverdue: deadline ? deadline < dayStart : false,
        totalTasks,
        completedTasks,
        progress:
          totalTasks === 0
            ? null
            : Math.round((completedTasks / totalTasks) * 100),
      };
    });

    const currentBalanceCents =
      moneyToCents(initialBalances._sum.initialBalance) +
      moneyToCents(paidIncomeTotal._sum.amount) -
      moneyToCents(paidExpenseTotal._sum.amount);

    return NextResponse.json(
      {
        date,
        today: {
          habits: dashboardHabits,
          habitsCompleted,
          habitsTotal: dashboardHabits.length,
          pendingTasks,
          workouts: dashboardWorkouts,
        },
        finances: {
          balance: centsToNumber(currentBalanceCents),
          monthlyIncome: centsToNumber(
            moneyToCents(monthlyIncome._sum.amount)
          ),
          monthlyExpense: centsToNumber(
            moneyToCents(monthlyExpense._sum.amount)
          ),
          monthlyPendingCount,
        },
        goals: dashboardGoals,
        evolution: latestPhysicalRecord
          ? {
              ...latestPhysicalRecord,
              date: latestPhysicalRecord.date.toISOString(),
            }
          : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json(
      { error: "Erro ao carregar dashboard." },
      { status: 500 }
    );
  }
}
