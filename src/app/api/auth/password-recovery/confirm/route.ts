import { NextRequest, NextResponse } from "next/server";
import { confirmPasswordRecoveryPayloadSchema } from "@/lib/api-validation";
import { resetPasswordWithToken } from "@/lib/password-recovery";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  passwordRecoveryConfirmRateLimiter,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

const INVALID_TOKEN_ERROR = "Link inválido ou expirado.";

export async function POST(request: NextRequest) {
  const rateLimit = passwordRecoveryConfirmRateLimiter.check(
    clientRateLimitKey(request, "password-recovery-confirm")
  );

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, rateLimit);

  try {
    const payload = confirmPasswordRecoveryPayloadSchema.safeParse(
      await request.json()
    );

    if (!payload.success) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    const passwordWasReset = await resetPasswordWithToken(payload.data);
    if (!passwordWasReset) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    return respond(
      NextResponse.json({ status: "password-reset" }, { status: 200 })
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    console.error("[POST /api/auth/password-recovery/confirm] failed");
    return respond(
      NextResponse.json(
        { error: "Não foi possível redefinir a senha agora." },
        { status: 500 }
      )
    );
  }
}
