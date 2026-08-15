import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  EmailConfigurationError,
  readEmailTransportConfiguration,
  sendEmailVerification,
} from "@/lib/email";
import {
  issueEmailVerificationToken,
  revokeEmailVerificationToken,
} from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  emailVerificationRequestRateLimiter,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";

function createVerificationUrl(token: string) {
  const applicationUrl = process.env.NEXTAUTH_URL;
  if (!applicationUrl) {
    throw new EmailConfigurationError("NEXTAUTH_URL is not configured.");
  }

  const url = new URL("/verificar-email", applicationUrl);
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

  const rateLimit = emailVerificationRequestRateLimiter.check(
    `${clientRateLimitKey(request, "email-verification-request")}:${session.user.id}`
  );

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, rateLimit);

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return respond(
        NextResponse.json({ error: "Conta não encontrada." }, { status: 404 })
      );
    }

    if (user.emailVerified) {
      return respond(
        NextResponse.json({ status: "already-verified" }, { status: 200 })
      );
    }

    readEmailTransportConfiguration();
    const issuedToken = await issueEmailVerificationToken({
      userId: user.id,
      email: user.email,
    });

    try {
      await sendEmailVerification({
        to: user.email,
        verificationUrl: createVerificationUrl(issuedToken.token),
      });
    } catch (error) {
      await revokeEmailVerificationToken(issuedToken.tokenHash).catch(() => {});
      throw error;
    }

    return respond(
      NextResponse.json({ status: "verification-sent" }, { status: 202 })
    );
  } catch (error) {
    const reason =
      error instanceof EmailConfigurationError
        ? "email configuration unavailable"
        : "email delivery failed";
    console.error(`[POST /api/auth/email-verification/request] ${reason}`);

    return respond(
      NextResponse.json(
        { error: "Não foi possível enviar a verificação agora." },
        { status: 503 }
      )
    );
  }
}
