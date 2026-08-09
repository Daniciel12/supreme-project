import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFinancialAccountPayloadSchema } from "@/lib/api-validation";

function currentBalance(account: {
  initialBalance: { toString(): string };
  transactions: Array<{
    amount: { toString(): string };
    type: "INCOME" | "EXPENSE";
  }>;
}) {
  return account.transactions.reduce((balance, transaction) => {
    const amount = Number(transaction.amount.toString());
    return transaction.type === "INCOME" ? balance + amount : balance - amount;
  }, Number(account.initialBalance.toString()));
}

// GET /api/finances/accounts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const accounts = await prisma.financialAccount.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      include: {
        transactions: {
          where: { isPaid: true },
          select: { amount: true, type: true },
        },
      },
    });

    return NextResponse.json(
      accounts.map(({ transactions, initialBalance, ...account }) => ({
        ...account,
        initialBalance: Number(initialBalance.toString()),
        balance: currentBalance({ initialBalance, transactions }),
      })),
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/finances/accounts]", error);
    return NextResponse.json(
      { error: "Erro ao listar contas." },
      { status: 500 }
    );
  }
}

// POST /api/finances/accounts
// Body: { name: string, type: FinancialAccountType, balance: number }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createFinancialAccountPayloadSchema.safeParse(
      await request.json()
    );

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const { name, type, balance } = payload.data;
    const account = await prisma.financialAccount.create({
      data: {
        name,
        type,
        initialBalance: balance,
        userId: session.user.id,
      },
    });

    const initialBalance = Number(account.initialBalance.toString());

    return NextResponse.json(
      { ...account, initialBalance, balance: initialBalance },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/finances/accounts]", error);
    return NextResponse.json(
      { error: "Erro ao criar conta." },
      { status: 500 }
    );
  }
}
