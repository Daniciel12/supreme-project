import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  accountDataExportSelect,
  createAccountDataExport,
} from "@/lib/account-data-export";
import { prisma } from "@/lib/prisma";
import {
  accountDataExportRateLimiter,
  attachRateLimitHeaders,
  clientRateLimitKey,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const rateLimit = accountDataExportRateLimiter.check(
      `${clientRateLimitKey(request, "account-data-export")}:${session.user.id}`
    );

    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: accountDataExportSelect(session.user.id),
    });

    if (!user) {
      return attachRateLimitHeaders(
        NextResponse.json(
          { error: "Conta não encontrada." },
          { status: 404 }
        ),
        rateLimit
      );
    }

    const exportedAt = new Date();
    const body = JSON.stringify(
      createAccountDataExport(user, exportedAt),
      null,
      2
    );
    const filename = `supreme-export-${exportedAt
      .toISOString()
      .slice(0, 10)}.json`;

    return attachRateLimitHeaders(
      new NextResponse(body, {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Type": "application/json; charset=utf-8",
          Expires: "0",
          Pragma: "no-cache",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex, noarchive",
        },
      }),
      rateLimit
    );
  } catch {
    console.error("[POST /api/account/export] failed");
    return NextResponse.json(
      { error: "Não foi possível exportar seus dados agora." },
      { status: 500 }
    );
  }
}
