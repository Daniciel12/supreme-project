import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  bookIdSchema,
  updateBookProgressPayloadSchema,
} from "@/lib/api-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedId = bookIdSchema.safeParse((await params).id);
    const payload = updateBookProgressPayloadSchema.safeParse(await request.json());

    if (!parsedId.success || !payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const book = await prisma.book.findFirst({
      where: { id: parsedId.data, userId: session.user.id },
      select: { id: true, totalPages: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Livro não encontrado." },
        { status: 404 }
      );
    }

    if (payload.data.readPages > book.totalPages) {
      return NextResponse.json(
        { error: "Páginas lidas não podem exceder o total do livro." },
        { status: 400 }
      );
    }

    const updatedBook = await prisma.book.update({
      where: { id: book.id },
      data: { readPages: payload.data.readPages },
    });

    return NextResponse.json(updatedBook, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[PATCH /api/books/[id]]", error);
    return NextResponse.json(
      { error: "Erro ao atualizar progresso do livro." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const parsedId = bookIdSchema.safeParse((await params).id);

    if (!parsedId.success) {
      return NextResponse.json({ error: "Livro inválido." }, { status: 400 });
    }

    const result = await prisma.book.deleteMany({
      where: { id: parsedId.data, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Livro não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/books/[id]]", error);
    return NextResponse.json(
      { error: "Erro ao remover livro." },
      { status: 500 }
    );
  }
}
