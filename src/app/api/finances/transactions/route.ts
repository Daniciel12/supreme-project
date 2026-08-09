import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTransactionPayloadSchema } from "@/lib/api-validation";

function serializeTransaction<T extends { amount: { toString(): string } }>(
  transaction: T
) {
  return {
    ...transaction,
    amount: Number(transaction.amount.toString()),
  };
}

// GET /api/finances/transactions
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(transactions.map(serializeTransaction), {
      status: 200,
    });
  } catch (error) {
    console.error("[GET /api/finances/transactions]", error);
    return NextResponse.json(
      { error: "Erro ao listar transações." },
      { status: 500 }
    );
  }
}

// POST /api/finances/transactions
// Body: { accountId: string, title: string, type: "INCOME" | "EXPENSE", amount: number, date?: string, isPaid?: boolean }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createTransactionPayloadSchema.safeParse(
      await request.json()
    );

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const { accountId, title, type, amount, date, isPaid } = payload.data;
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada." },
        { status: 404 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        title,
        type,
        amount,
        date: date ? new Date(date) : new Date(),
        isPaid: isPaid ?? false,
        userId: session.user.id,
      },
    });

    return NextResponse.json(serializeTransaction(transaction), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/finances/transactions]", error);
    return NextResponse.json(
      { error: "Erro ao criar transação." },
      { status: 500 }
    );
  }
}
