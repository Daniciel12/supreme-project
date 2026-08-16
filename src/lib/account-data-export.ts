import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export const ACCOUNT_DATA_EXPORT_FORMAT = "supreme-account-export";
export const ACCOUNT_DATA_EXPORT_VERSION = 1;

export function accountDataExportSelect(userId: string) {
  return {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    createdAt: true,
    updatedAt: true,
    habits: {
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        color: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        checkIns: {
          where: { userId },
          orderBy: [{ date: "asc" }, { id: "asc" }],
          select: {
            id: true,
            date: true,
            completed: true,
            note: true,
            createdAt: true,
          },
        },
      },
    },
    goals: {
      where: { userId },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        category: true,
        isCompleted: true,
        deadline: true,
        tasks: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            isCompleted: true,
            createdAt: true,
          },
        },
      },
    },
    workouts: {
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        dayOfWeek: true,
        completed: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        completions: {
          where: { userId },
          orderBy: [{ date: "asc" }, { id: "asc" }],
          select: {
            id: true,
            date: true,
            createdAt: true,
          },
        },
      },
    },
    physicalRecords: {
      where: { userId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      select: {
        id: true,
        date: true,
        weight: true,
        height: true,
        bodyFat: true,
        imc: true,
        shapeStatus: true,
        photoUrl: true,
        notes: true,
        createdAt: true,
      },
    },
    financialAccounts: {
      where: { userId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        initialBalance: true,
        transactions: {
          where: { userId },
          orderBy: [{ date: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            type: true,
            amount: true,
            date: true,
            isPaid: true,
          },
        },
      },
    },
    books: {
      where: { userId },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        author: true,
        totalPages: true,
        readPages: true,
      },
    },
    visionImages: {
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        imageUrl: true,
        createdAt: true,
      },
    },
  } satisfies Prisma.UserSelect;
}

type AccountDataExportRecord = Prisma.UserGetPayload<{
  select: ReturnType<typeof accountDataExportSelect>;
}>;

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function createAccountDataExport(
  user: AccountDataExportRecord,
  exportedAt = new Date()
) {
  return {
    format: ACCOUNT_DATA_EXPORT_FORMAT,
    version: ACCOUNT_DATA_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: iso(user.emailVerified),
      profileImageUrl: user.image,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    data: {
      habits: user.habits.map((habit) => ({
        id: habit.id,
        name: habit.name,
        description: habit.description,
        icon: habit.icon,
        color: habit.color,
        active: habit.active,
        createdAt: habit.createdAt.toISOString(),
        updatedAt: habit.updatedAt.toISOString(),
        checkIns: habit.checkIns.map((checkIn) => ({
          id: checkIn.id,
          date: checkIn.date.toISOString(),
          completed: checkIn.completed,
          note: checkIn.note,
          createdAt: checkIn.createdAt.toISOString(),
        })),
      })),
      goals: user.goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        category: goal.category,
        isCompleted: goal.isCompleted,
        deadline: iso(goal.deadline),
        tasks: goal.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          isCompleted: task.isCompleted,
          createdAt: task.createdAt.toISOString(),
        })),
      })),
      workouts: user.workouts.map((workout) => ({
        id: workout.id,
        name: workout.name,
        dayOfWeek: workout.dayOfWeek,
        completed: workout.completed,
        notes: workout.notes,
        createdAt: workout.createdAt.toISOString(),
        updatedAt: workout.updatedAt.toISOString(),
        completions: workout.completions.map((completion) => ({
          id: completion.id,
          date: completion.date.toISOString(),
          createdAt: completion.createdAt.toISOString(),
        })),
      })),
      physicalRecords: user.physicalRecords.map((record) => ({
        id: record.id,
        date: record.date.toISOString(),
        weight: record.weight,
        height: record.height,
        bodyFat: record.bodyFat,
        imc: record.imc,
        shapeStatus: record.shapeStatus,
        photoUrl: record.photoUrl,
        notes: record.notes,
        createdAt: record.createdAt.toISOString(),
      })),
      financialAccounts: user.financialAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        initialBalance: account.initialBalance.toFixed(2),
        transactions: account.transactions.map((transaction) => ({
          id: transaction.id,
          title: transaction.title,
          type: transaction.type,
          amount: transaction.amount.toFixed(2),
          date: transaction.date.toISOString(),
          isPaid: transaction.isPaid,
        })),
      })),
      books: user.books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        totalPages: book.totalPages,
        readPages: book.readPages,
      })),
      visionImages: user.visionImages.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        createdAt: image.createdAt.toISOString(),
      })),
    },
  };
}
