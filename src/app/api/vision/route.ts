import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/vision
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const images = await prisma.visionImage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(images, { status: 200 });
  } catch (error) {
    console.error("[GET /api/vision]", error);
    return NextResponse.json(
      { error: "Erro ao listar imagens." },
      { status: 500 }
    );
  }
}

// POST /api/vision
// Body: { imageUrl: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Campo 'imageUrl' é obrigatório." },
        { status: 400 }
      );
    }

    const image = await prisma.visionImage.create({
      data: { imageUrl, userId: session.user.id },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("[POST /api/vision]", error);
    return NextResponse.json(
      { error: "Erro ao salvar imagem." },
      { status: 500 }
    );
  }
}

// DELETE /api/vision?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Parâmetro 'id' é obrigatório." },
        { status: 400 }
      );
    }

    // Confere que a imagem pertence ao usuário autenticado antes de remover.
    const image = await prisma.visionImage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!image) {
      return NextResponse.json(
        { error: "Imagem não encontrada." },
        { status: 404 }
      );
    }

    await prisma.visionImage.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/vision]", error);
    return NextResponse.json(
      { error: "Erro ao remover imagem." },
      { status: 500 }
    );
  }
}
