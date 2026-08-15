import { NextRequest, NextResponse } from "next/server";
import { confirmEmailVerificationPayloadSchema } from "@/lib/api-validation";
import { consumeEmailVerificationToken } from "@/lib/email-verification";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  emailVerificationConfirmRateLimiter,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

const INVALID_TOKEN_ERROR = "Link inválido ou expirado.";

export async function POST(request: NextRequest) {
  const rateLimit = emailVerificationConfirmRateLimiter.check(
    clientRateLimitKey(request, "email-verification-confirm")
  );

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, rateLimit);

  try {
    const payload = confirmEmailVerificationPayloadSchema.safeParse(
      await request.json()
    );

    if (!payload.success) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    const verified = await consumeEmailVerificationToken(payload.data.token);
    if (!verified) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    return respond(
      NextResponse.json({ status: "email-verified" }, { status: 200 })
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    console.error("[POST /api/auth/email-verification/confirm] failed");
    return respond(
      NextResponse.json(
        { error: "Não foi possível confirmar o e-mail agora." },
        { status: 500 }
      )
    );
  }
}
