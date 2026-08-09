import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBookPayloadSchema } from "@/lib/api-validation";

// GET /api/books
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const books = await prisma.book.findMany({
      where: { userId: session.user.id },
      orderBy: { title: "asc" },
    });

    return NextResponse.json(books, { status: 200 });
  } catch (error) {
    console.error("[GET /api/books]", error);
    return NextResponse.json(
      { error: "Erro ao listar livros." },
      { status: 500 }
    );
  }
}

// POST /api/books
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createBookPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const book = await prisma.book.create({
      data: {
        ...payload.data,
        userId: session.user.id,
      },
    });

    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/books]", error);
    return NextResponse.json(
      { error: "Erro ao criar livro." },
      { status: 500 }
    );
  }
}
