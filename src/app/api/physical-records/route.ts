import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
// Body: { weight: number, height: number, notes?: string, photoUrl?: string, date?: string }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { weight, height, notes, photoUrl, date } = body;

    if (weight == null || height == null) {
      return NextResponse.json(
        { error: "Campos 'weight' e 'height' são obrigatórios." },
        { status: 400 }
      );
    }

    const weightNum = Number(weight);
    const heightNum = Number(height);

    if (Number.isNaN(weightNum) || Number.isNaN(heightNum) || heightNum <= 0) {
      return NextResponse.json(
        { error: "'weight' e 'height' devem ser números válidos (height > 0)." },
        { status: 400 }
      );
    }

    const imc = calculateImc(weightNum, heightNum);
    const shapeStatus = getShapeStatus(imc);

    const record = await prisma.physicalRecord.create({
      data: {
        userId: session.user.id,
        weight: weightNum,
        height: heightNum,
        imc,
        shapeStatus,
        notes,
        photoUrl,
        ...(date ? { date: new Date(date) } : {}),
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("[POST /api/physical-records]", error);
    return NextResponse.json(
      { error: "Erro ao criar registro físico." },
      { status: 500 }
    );
  }
}
