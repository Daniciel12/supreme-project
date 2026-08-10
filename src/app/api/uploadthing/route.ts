import type { NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  rateLimitExceededResponse,
  uploadRateLimiter,
} from "@/lib/rate-limit";
import { ourFileRouter } from "./core";

const handlers = createRouteHandler({
  router: ourFileRouter,
});

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const rateLimit = uploadRateLimiter.check(
    clientRateLimitKey(request, "upload")
  );

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  const response = await handlers.POST(request);
  return attachRateLimitHeaders(response, rateLimit);
}
