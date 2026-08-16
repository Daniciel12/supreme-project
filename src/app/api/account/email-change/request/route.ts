import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requestEmailChangePayloadSchema } from "@/lib/api-validation";
import {
  requestEmailChange,
  revokeEmailChangeToken,
} from "@/lib/email-change";
import {
  EmailConfigurationError,
  readEmailTransportConfiguration,
  sendEmailChangeRequestedNotice,
  sendEmailChangeVerification,
} from "@/lib/email";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  emailChangeRequestRateLimiter,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

function createEmailChangeUrl(token: string) {
  const applicationUrl = process.env.NEXTAUTH_URL;
  if (!applicationUrl) {
    throw new EmailConfigurationError("NEXTAUTH_URL is not configured.");
  }

  const url = new URL("/alterar-email", applicationUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new EmailConfigurationError(
      "NEXTAUTH_URL must use HTTPS in production."
    );
  }

  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const rateLimit = emailChangeRequestRateLimiter.check(
    `${clientRateLimitKey(request, "email-change-request")}:${session.user.id}`
  );
  if (!rateLimit.allowed) return rateLimitExceededResponse(rateLimit);

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, rateLimit);

  try {
    const payload = requestEmailChangePayloadSchema.safeParse(
      await request.json()
    );
    if (!payload.success) {
      return respond(
        NextResponse.json(
          { error: "Solicitação de troca inválida." },
          { status: 400 }
        )
      );
    }

    readEmailTransportConfiguration();
    const result = await requestEmailChange({
      userId: session.user.id,
      newEmail: payload.data.newEmail,
      password: payload.data.password,
      authenticatedAt: session.authenticatedAt,
    });

    if (result.status === "invalid-identity") {
      return respond(
        NextResponse.json(
          { error: "Não foi possível confirmar sua identidade." },
          { status: 403 }
        )
      );
    }
    if (result.status === "recent-authentication-required") {
      return respond(
        NextResponse.json(
          { error: "Entre novamente com Google antes de trocar o e-mail." },
          { status: 428 }
        )
      );
    }
    if (result.status === "same-email") {
      return respond(
        NextResponse.json(
          { error: "Informe um endereço diferente do atual." },
          { status: 400 }
        )
      );
    }
    if (result.status === "conflict") {
      return respond(
        NextResponse.json(
          { error: "Não foi possível usar esse endereço." },
          { status: 409 }
        )
      );
    }
    if (result.status === "not-found") {
      return respond(
        NextResponse.json({ error: "Conta não encontrada." }, { status: 404 })
      );
    }
    if (result.status === "unavailable") {
      return respond(
        NextResponse.json(
          { error: "A conta não está disponível para esta alteração." },
          { status: 409 }
        )
      );
    }

    const verificationUrl = createEmailChangeUrl(result.token);

    try {
      await sendEmailChangeRequestedNotice({
        to: result.currentEmail,
        newEmail: result.newEmail,
      });
      await sendEmailChangeVerification({
        to: result.newEmail,
        verificationUrl,
      });
    } catch (error) {
      await revokeEmailChangeToken(result.tokenHash).catch(() => {});
      throw error;
    }

    return respond(
      NextResponse.json({ status: "verification-sent" }, { status: 202 })
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respond(
        NextResponse.json(
          { error: "Solicitação de troca inválida." },
          { status: 400 }
        )
      );
    }

    const reason =
      error instanceof EmailConfigurationError
        ? "email configuration unavailable"
        : "email change request failed";
    console.error(`[POST /api/account/email-change/request] ${reason}`);
    return respond(
      NextResponse.json(
        { error: "Não foi possível enviar a confirmação agora." },
        { status: 503 }
      )
    );
  }
}
