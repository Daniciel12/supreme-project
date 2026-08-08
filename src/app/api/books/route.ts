import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
// Body: { title: string, author: string, totalPages: number }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { title, author, totalPages } = body;

    if (!title || !author || totalPages == null) {
      return NextResponse.json(
        { error: "Campos 'title', 'author' e 'totalPages' são obrigatórios." },
        { status: 400 }
      );
    }

    const totalPagesNum = parseInt(totalPages, 10);

    if (Number.isNaN(totalPagesNum) || totalPagesNum <= 0) {
      return NextResponse.json(
        { error: "'totalPages' deve ser um número inteiro maior que zero." },
        { status: 400 }
      );
    }

    const book = await prisma.book.create({
      data: {
        title,
        author,
        totalPages: totalPagesNum,
        userId: session.user.id,
      },
    });

    return NextResponse.json(book, { status: 201 });
  } catch (error) {
    console.error("[POST /api/books]", error);
    return NextResponse.json(
      { error: "Erro ao criar livro." },
      { status: 500 }
    );
  }
}
