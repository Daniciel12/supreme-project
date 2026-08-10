import { isIP } from "node:net";

const DEFAULT_MAX_ENTRIES = 10_000;
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

    if (!entry || entry.resetAt <= now) {
      this.makeRoom(now, key);
      entry = { count: 0, resetAt: now + this.policy.windowMs };
    }

    entry.count += 1;

    // Refresh insertion order so capacity pressure evicts an older client.
    this.entries.delete(key);
    this.entries.set(key, entry);

    return {
      allowed: entry.count <= this.policy.limit,
      limit: this.policy.limit,
      remaining: Math.max(0, this.policy.limit - entry.count),
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  private makeRoom(now: number, incomingKey: string) {
    if (this.entries.has(incomingKey)) {
      this.entries.delete(incomingKey);
    }

    if (this.entries.size < this.maxEntries) {
      return;
    }

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.entries.delete(oldestKey);
    }
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
