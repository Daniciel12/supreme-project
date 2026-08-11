import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { UTApi } from "uploadthing/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createVisionImagePayloadSchema,
  visionImageIdSchema,
} from "@/lib/api-validation";

const utapi = new UTApi();

export function getUploadThingFileKey(imageUrl: string) {
  try {
    const url = new URL(imageUrl);
    const isCurrentHost = url.protocol === "https:" && url.hostname.endsWith(".ufs.sh");
    const isLegacyHost = url.protocol === "https:" && url.hostname === "utfs.io";
    const match = url.pathname.match(/^\/f\/([^/]+)$/);

    if ((!isCurrentHost && !isLegacyHost) || !match) {
      return null;
    }

    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

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
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createVisionImagePayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const image = await prisma.visionImage.create({
      data: {
        imageUrl: payload.data.imageUrl,
        userId: session.user.id,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

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

    const parsedId = visionImageIdSchema.safeParse(
      request.nextUrl.searchParams.get("id")
    );

    if (!parsedId.success) {
      return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
    }

    const image = await prisma.visionImage.findFirst({
      where: { id: parsedId.data, userId: session.user.id },
      select: { id: true, imageUrl: true },
    });

    if (!image) {
      return NextResponse.json(
        { error: "Imagem não encontrada." },
        { status: 404 }
      );
    }

    const fileKey = getUploadThingFileKey(image.imageUrl);

    if (fileKey) {
      await utapi.deleteFiles(fileKey);
    }

    await prisma.visionImage.delete({
      where: { id: image.id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/vision]", error);
    return NextResponse.json(
      { error: "Erro ao remover imagem." },
      { status: 500 }
    );
  }
}
