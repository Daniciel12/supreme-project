import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["INCOME", "EXPENSE"];

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

    return NextResponse.json(transactions, { status: 200 });
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

    const body = await request.json();
    const { accountId, title, type, amount, date, isPaid } = body;

    if (!accountId || !title || !type || amount == null) {
      return NextResponse.json(
        {
          error:
            "Campos 'accountId', 'title', 'type' e 'amount' são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const normalizedType = String(type).toUpperCase();

    if (!VALID_TYPES.includes(normalizedType)) {
      return NextResponse.json(
        { error: `'type' deve ser um de: ${VALID_TYPES.join(", ")}.` },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);

    if (Number.isNaN(amountNum)) {
      return NextResponse.json(
        { error: "'amount' deve ser um número válido." },
        { status: 400 }
      );
    }

    // Garante que a conta pertence ao usuário autenticado antes de vincular
    // a transação a ela.
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
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
        type: normalizedType,
        amount: amountNum,
        date: date ? new Date(date) : new Date(),
        isPaid: isPaid ?? false,
        userId: session.user.id,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("[POST /api/finances/transactions]", error);
    return NextResponse.json(
      { error: "Erro ao criar transação." },
      { status: 500 }
    );
  }
}
