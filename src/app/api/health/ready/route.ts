import { NextResponse } from "next/server";
import { validateRuntimeEnvironment } from "@/lib/runtime-environment";

export const dynamic = "force-dynamic";

function notReadyResponse() {
  return NextResponse.json(
    { status: "not_ready" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET() {
  if (!validateRuntimeEnvironment(process.env).ready) {
    return notReadyResponse();
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ready" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[GET /api/health/ready] readiness check failed", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return notReadyResponse();
  }
}
