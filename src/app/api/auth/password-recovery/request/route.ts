import { NextRequest, NextResponse } from "next/server";
import { requestPasswordRecoveryPayloadSchema } from "@/lib/api-validation";
import {
  EmailConfigurationError,
  readEmailTransportConfiguration,
  sendPasswordResetEmail,
} from "@/lib/email";
import {
  issuePasswordRecoveryToken,
  passwordRecoveryRateLimitKey,
  revokePasswordRecoveryToken,
} from "@/lib/password-recovery";
import { prisma } from "@/lib/prisma";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  passwordRecoveryRequestEmailRateLimiter,
  passwordRecoveryRequestIpRateLimiter,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

const GENERIC_RESPONSE = {
  status: "accepted",
  message:
    "Se existir uma conta com senha para este e-mail, enviaremos as próximas instruções.",
};

function createPasswordResetUrl(token: string) {
  const applicationUrl = process.env.NEXTAUTH_URL;
  if (!applicationUrl) {
    throw new EmailConfigurationError("NEXTAUTH_URL is not configured.");
  }

  const url = new URL("/redefinir-senha", applicationUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new EmailConfigurationError(
      "NEXTAUTH_URL must use HTTPS in production."
    );
  }

  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function POST(request: NextRequest) {
  const ipRateLimit = passwordRecoveryRequestIpRateLimiter.check(
    clientRateLimitKey(request, "password-recovery-request")
  );

  if (!ipRateLimit.allowed) {
    return rateLimitExceededResponse(ipRateLimit);
  }

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, ipRateLimit);

  try {
    const payload = requestPasswordRecoveryPayloadSchema.safeParse(
      await request.json()
    );

    if (!payload.success) {
      return respond(
        NextResponse.json({ error: "Payload inválido." }, { status: 400 })
      );
    }

    const emailRateLimit = passwordRecoveryRequestEmailRateLimiter.check(
      `password-recovery-email:${passwordRecoveryRateLimitKey(payload.data.email)}`
    );
    if (!emailRateLimit.allowed) {
      return rateLimitExceededResponse(emailRateLimit);
    }

    const user = await prisma.user.findUnique({
      where: { email: payload.data.email },
      select: { id: true, email: true, password: true },
    });

    if (user?.password) {
      readEmailTransportConfiguration();
      const issuedToken = await issuePasswordRecoveryToken({
        userId: user.id,
        email: user.email,
      });

      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl: createPasswordResetUrl(issuedToken.token),
        });
      } catch (error) {
        await revokePasswordRecoveryToken(issuedToken.tokenHash).catch(
          () => {}
        );
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respond(
        NextResponse.json({ error: "Payload inválido." }, { status: 400 })
      );
    }

    const reason =
      error instanceof EmailConfigurationError
        ? "email configuration unavailable"
        : "request processing failed";
    console.error(`[POST /api/auth/password-recovery/request] ${reason}`);
  }

  return respond(NextResponse.json(GENERIC_RESPONSE, { status: 202 }));
}
