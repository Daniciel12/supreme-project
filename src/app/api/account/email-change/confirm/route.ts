import { NextRequest, NextResponse } from "next/server";
import { confirmEmailChangePayloadSchema } from "@/lib/api-validation";
import { confirmEmailChange } from "@/lib/email-change";
import { sendEmailChangedNotice } from "@/lib/email";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  emailChangeConfirmRateLimiter,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

const INVALID_TOKEN_ERROR = "Link inválido ou expirado.";

export async function POST(request: NextRequest) {
  const rateLimit = emailChangeConfirmRateLimiter.check(
    clientRateLimitKey(request, "email-change-confirm")
  );
  if (!rateLimit.allowed) return rateLimitExceededResponse(rateLimit);

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, rateLimit);

  try {
    const payload = confirmEmailChangePayloadSchema.safeParse(
      await request.json()
    );
    if (!payload.success) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    const result = await confirmEmailChange(payload.data.token);
    if (result.status === "invalid") {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }
    if (result.status === "conflict") {
      return respond(
        NextResponse.json(
          { error: "O endereço não está mais disponível." },
          { status: 409 }
        )
      );
    }

    try {
      await sendEmailChangedNotice({ to: result.previousEmail });
    } catch {
      console.error(
        "[POST /api/account/email-change/confirm] previous-address notice failed"
      );
    }

    return respond(
      NextResponse.json(
        { status: "email-changed" },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      )
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respond(
        NextResponse.json({ error: INVALID_TOKEN_ERROR }, { status: 400 })
      );
    }

    console.error("[POST /api/account/email-change/confirm] failed");
    return respond(
      NextResponse.json(
        { error: "Não foi possível alterar o e-mail agora." },
        { status: 500 }
      )
    );
  }
}
