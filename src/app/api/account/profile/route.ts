import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { updateAccountProfilePayloadSchema } from "@/lib/api-validation";
import { prisma } from "@/lib/prisma";

const accountProfileSelect = {
  name: true,
  email: true,
  emailVerified: true,
  password: true,
  accounts: {
    select: { provider: true },
  },
} as const;

type AccountProfileRecord = {
  name: string | null;
  email: string;
  emailVerified: Date | null;
  password: string | null;
  accounts: Array<{ provider: string }>;
};

function accountProfileResponse(user: AccountProfileRecord) {
  return {
    name: user.name ?? "",
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    accessMethods: {
      credentials: Boolean(user.password),
      google: user.accounts.some((account) => account.provider === "google"),
    },
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: accountProfileSelect,
    });

    if (!user) {
      return NextResponse.json(
        { error: "Conta não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json(accountProfileResponse(user), { status: 200 });
  } catch (error) {
    console.error("[GET /api/account/profile]", error);
    return NextResponse.json(
      { error: "Erro ao carregar perfil." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = updateAccountProfilePayloadSchema.safeParse(
      await request.json()
    );

    if (!payload.success) {
      return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "Conta não encontrada." },
        { status: 404 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: payload.data.name },
      select: accountProfileSelect,
    });

    return NextResponse.json(accountProfileResponse(user), { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    }

    console.error("[PATCH /api/account/profile]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil." },
      { status: 500 }
    );
  }
}
