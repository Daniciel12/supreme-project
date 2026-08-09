import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  transactionIdSchema,
  updateTransactionStatusPayloadSchema,
} from "@/lib/api-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function serializeTransaction<T extends { amount: { toString(): string } }>(
  transaction: T
) {
  return {
    ...transaction,
    amount: Number(transaction.amount.toString()),
  };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedId = transactionIdSchema.safeParse((await params).id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const payload = updateTransactionStatusPayloadSchema.safeParse(
      await request.json()
    );
    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: parsedId.data,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada." },
        { status: 404 }
      );
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: parsedId.data, userId: session.user.id },
      data: { isPaid: payload.data.isPaid },
    });

    return NextResponse.json(serializeTransaction(updatedTransaction), {
      status: 200,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[PATCH /api/finances/transactions/[id]]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar transação." },
      { status: 500 }
    );
  }
}
