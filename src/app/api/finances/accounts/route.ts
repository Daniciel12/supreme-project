import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    });

    return NextResponse.json(accounts, { status: 200 });
  } catch (error) {
    console.error("[GET /api/finances/accounts]", error);
    return NextResponse.json(
      { error: "Erro ao listar contas." },
      { status: 500 }
    );
  }
}

// POST /api/finances/accounts
// Body: { name: string, type: string, balance: number }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, balance } = body;

    if (!name || !type || balance == null) {
      return NextResponse.json(
        { error: "Campos 'name', 'type' e 'balance' são obrigatórios." },
        { status: 400 }
      );
    }

    const balanceNum = Number(balance);

    if (Number.isNaN(balanceNum)) {
      return NextResponse.json(
        { error: "'balance' deve ser um número válido." },
        { status: 400 }
      );
    }

    const account = await prisma.financialAccount.create({
      data: {
        name,
        type,
        balance: balanceNum,
        userId: session.user.id,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("[POST /api/finances/accounts]", error);
    return NextResponse.json(
      { error: "Erro ao criar conta." },
      { status: 500 }
    );
  }
}
