import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPhysicalRecordPayloadSchema } from "@/lib/api-validation";

// height é esperado em metros (ex: 1.78), conforme fórmula padrão de IMC.
function calculateImc(weight: number, height: number): number {
  return weight / (height * height);
}

function getShapeStatus(imc: number): string {
  if (imc < 18.5) return "Abaixo do peso";
  if (imc < 25.0) return "Shape em dia";
  if (imc < 30.0) return "Sobrepeso leve";
  return "Foco na saúde";
}

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

// GET /api/physical-records
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const records = await prisma.physicalRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    console.error("[GET /api/physical-records]", error);
    return NextResponse.json(
      { error: "Erro ao listar registros físicos." },
      { status: 500 }
    );
  }
}

// POST /api/physical-records
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = createPhysicalRecordPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const { weight, height, bodyFat, notes, photoUrl, date } = payload.data;
    const imc = calculateImc(weight, height);
    const shapeStatus = getShapeStatus(imc);

    const record = await prisma.physicalRecord.create({
      data: {
        userId: session.user.id,
        weight,
        height,
        bodyFat,
        imc,
        shapeStatus,
        notes,
        photoUrl,
        ...(date ? { date: utcDate(date) } : {}),
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    console.error("[POST /api/physical-records]", error);
    return NextResponse.json(
      { error: "Erro ao criar registro físico." },
      { status: 500 }
    );
  }
}
