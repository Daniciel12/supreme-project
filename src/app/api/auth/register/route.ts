import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { registerPayloadSchema } from "@/lib/api-validation";

const SALT_ROUNDS = 10;

// POST /api/auth/register
// Body: { email: string, password: string, name?: string }
export async function POST(request: NextRequest) {
  try {
    const payload = registerPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: "Payload inválido." },
        { status: 400 }
      );
    }

    const { email, password, name } = payload.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json(
        { error: "Já existe um usuário cadastrado com este e-mail." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { error: "Erro ao cadastrar usuário." },
      { status: 500 }
    );
  }
}
