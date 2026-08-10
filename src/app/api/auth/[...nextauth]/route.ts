import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  credentialsRateLimiter,
  nextAuthRateLimitExceededResponse,
} from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/auth/[...nextauth]">
) {
  if (request.nextUrl.pathname !== "/api/auth/callback/credentials") {
    return handler(request, context);
  }

  const rateLimit = credentialsRateLimiter.check(
    clientRateLimitKey(request, "credentials")
  );

  if (!rateLimit.allowed) {
    return nextAuthRateLimitExceededResponse(request, rateLimit);
  }

  const response = await handler(request, context);
  return attachRateLimitHeaders(response, rateLimit);
}
