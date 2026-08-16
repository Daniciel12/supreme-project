import { isIP } from "node:net";

const DEFAULT_MAX_ENTRIES = 10_000;
const MAX_PRUNE_INTERVAL_MS = 60_000;
const SHARED_CLIENT_IDENTIFIER = "shared-client";

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
  maxEntries?: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly maxEntries: number;
  private readonly policy: RateLimitPolicy;
  private readonly now: () => number;
  private nextPruneAt = 0;
  private overflowEntry: RateLimitEntry | null = null;

  constructor(
    policy: RateLimitPolicy,
    now: () => number = Date.now
  ) {
    if (!Number.isInteger(policy.limit) || policy.limit <= 0) {
      throw new Error("Rate limit must be a positive integer.");
    }

    if (!Number.isFinite(policy.windowMs) || policy.windowMs <= 0) {
      throw new Error("Rate limit window must be positive.");
    }

    this.policy = policy;
    this.now = now;
    this.maxEntries = policy.maxEntries ?? DEFAULT_MAX_ENTRIES;
    if (!Number.isInteger(this.maxEntries) || this.maxEntries <= 0) {
      throw new Error("Rate limit entry capacity must be a positive integer.");
    }
  }

  check(key: string): RateLimitDecision {
    const now = this.now();
    let entry = this.entries.get(key);

    if (entry?.resetAt && entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.policy.windowMs };
      this.entries.set(key, entry);
    } else if (!entry) {
      this.pruneExpiredEntriesIfDue(now);

      if (this.entries.size >= this.maxEntries) {
        return this.recordOverflowAttempt(now);
      }

      entry = { count: 0, resetAt: now + this.policy.windowMs };
      this.entries.set(key, entry);
    }

    return this.recordAttempt(entry, now);
  }

  private recordAttempt(entry: RateLimitEntry, now: number): RateLimitDecision {
    entry.count += 1;
    return {
      allowed: entry.count <= this.policy.limit,
      limit: this.policy.limit,
      remaining: Math.max(0, this.policy.limit - entry.count),
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  private pruneExpiredEntriesIfDue(now: number) {
    if (this.entries.size < this.maxEntries) {
      return;
    }

    if (now < this.nextPruneAt) {
      return;
    }

    this.nextPruneAt =
      now + Math.min(this.policy.windowMs, MAX_PRUNE_INTERVAL_MS);

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private recordOverflowAttempt(now: number): RateLimitDecision {
    if (!this.overflowEntry || this.overflowEntry.resetAt <= now) {
      this.overflowEntry = {
        count: 0,
        resetAt: now + this.policy.windowMs,
      };
    }

    return this.recordAttempt(this.overflowEntry, now);
  }
}

function forwardedClientAddress(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }

  const firstAddress = forwardedFor.split(",", 1)[0]?.trim();
  return firstAddress && isIP(firstAddress) ? firstAddress : null;
}

export function clientRateLimitKey(
  request: Pick<Request, "headers">,
  scope: string,
  trustProxy = process.env.RATE_LIMIT_TRUST_PROXY === "true"
): string {
  const clientIdentifier = trustProxy
    ? forwardedClientAddress(request.headers) ?? SHARED_CLIENT_IDENTIFIER
    : SHARED_CLIENT_IDENTIFIER;

  return `${scope}:${clientIdentifier}`;
}

export function rateLimitHeaders(
  decision: RateLimitDecision
): Record<string, string> {
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(decision.retryAfterSeconds),
  };
}

export function attachRateLimitHeaders<T extends Response>(
  response: T,
  decision: RateLimitDecision
): T {
  for (const [name, value] of Object.entries(rateLimitHeaders(decision))) {
    response.headers.set(name, value);
  }
  return response;
}

export function rateLimitExceededResponse(
  decision: RateLimitDecision
): Response {
  return Response.json(
    { error: "Muitas tentativas. Tente novamente mais tarde." },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(decision),
        "Retry-After": String(decision.retryAfterSeconds),
      },
    }
  );
}

export function nextAuthRateLimitExceededResponse(
  request: Pick<Request, "url">,
  decision: RateLimitDecision
): Response {
  const errorUrl = new URL("/api/auth/error", request.url);
  errorUrl.searchParams.set("error", "TooManyRequests");

  return Response.json(
    { url: errorUrl.toString() },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(decision),
        "Retry-After": String(decision.retryAfterSeconds),
      },
    }
  );
}

export function isUploadInitiationRequest(
  request: Pick<Request, "url">
): boolean {
  return new URL(request.url).searchParams.get("actionType") === "upload";
}

export const registrationRateLimiter = new FixedWindowRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
});

export const credentialsRateLimiter = new FixedWindowRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

export const uploadRateLimiter = new FixedWindowRateLimiter({
  limit: 30,
  windowMs: 15 * 60 * 1000,
});

export const emailVerificationRequestRateLimiter = new FixedWindowRateLimiter({
  limit: 3,
  windowMs: 60 * 60 * 1000,
});

export const emailVerificationConfirmRateLimiter = new FixedWindowRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

export const passwordRecoveryRequestIpRateLimiter = new FixedWindowRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
});

export const passwordRecoveryRequestEmailRateLimiter =
  new FixedWindowRateLimiter({
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });

export const passwordRecoveryConfirmRateLimiter = new FixedWindowRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

export const accountDataExportRateLimiter = new FixedWindowRateLimiter({
  limit: 3,
  windowMs: 60 * 60 * 1000,
});

export const accountDeletionRateLimiter = new FixedWindowRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
});
