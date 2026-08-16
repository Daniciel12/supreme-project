import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteAccount } from "@/lib/account-deletion";
import { accountDeletionPayloadSchema } from "@/lib/api-validation";
import {
  accountDeletionRateLimiter,
  clientRateLimitKey,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const rateLimit = accountDeletionRateLimiter.check(
      `${clientRateLimitKey(request, "account-deletion")}:${session.user.id}`
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const payload = accountDeletionPayloadSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Confirmação de exclusão inválida." },
        { status: 400 }
      );
    }

    const result = await deleteAccount({
      userId: session.user.id,
      email: payload.data.email,
      password: payload.data.password,
      authenticatedAt: session.authenticatedAt,
    });

    if (result.status === "invalid-identity") {
      return NextResponse.json(
        { error: "Não foi possível confirmar sua identidade." },
        { status: 403 }
      );
    }
    if (result.status === "recent-authentication-required") {
      return NextResponse.json(
        { error: "Entre novamente com Google antes de excluir a conta." },
        { status: 428 }
      );
    }
    if (result.status === "not-found") {
      return NextResponse.json(
        { error: "Conta não encontrada." },
        { status: 404 }
      );
    }
    if (result.status === "remote-cleanup-pending") {
      return NextResponse.json(
        {
          error:
            "A limpeza dos arquivos não terminou. Entre novamente e tente de novo.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { status: "account-deleted" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Confirmação de exclusão inválida." },
        { status: 400 }
      );
    }

    console.error("[DELETE /api/account] failed");
    return NextResponse.json(
      { error: "Não foi possível excluir a conta agora." },
      { status: 500 }
    );
  }
}
