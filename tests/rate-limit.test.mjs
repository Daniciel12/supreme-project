import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FixedWindowRateLimiter,
  attachRateLimitHeaders,
  clientRateLimitKey,
  rateLimitExceededResponse,
} from "../src/lib/rate-limit.ts";

test("fixed-window limiter blocks only after the configured allowance", () => {
  let now = 1_000;
  const limiter = new FixedWindowRateLimiter(
    { limit: 2, windowMs: 60_000 },
    () => now
  );

  assert.deepEqual(limiter.check("client-a"), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 61_000,
    retryAfterSeconds: 60,
  });
  assert.equal(limiter.check("client-a").allowed, true);

  const denied = limiter.check("client-a");
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.equal(denied.retryAfterSeconds, 60);

  now = 61_000;
  assert.equal(limiter.check("client-a").allowed, true);
});

test("capacity pressure evicts an older client without disabling limits", () => {
  const limiter = new FixedWindowRateLimiter({
    limit: 1,
    windowMs: 60_000,
    maxEntries: 2,
  });

  assert.equal(limiter.check("client-a").allowed, true);
  assert.equal(limiter.check("client-b").allowed, true);
  assert.equal(limiter.check("client-c").allowed, true);
  assert.equal(limiter.check("client-c").allowed, false);
});

test("forwarded client address is trusted only when explicitly enabled", () => {
  const request = new Request("https://supreme.example/api/auth/register", {
    headers: { "x-forwarded-for": "203.0.113.8, 127.0.0.1" },
  });

  assert.equal(
    clientRateLimitKey(request, "registration", false),
    "registration:shared-client"
  );
  assert.equal(
    clientRateLimitKey(request, "registration", true),
    "registration:203.0.113.8"
  );
});

test("invalid forwarded addresses fall back to the shared safe key", () => {
  const request = new Request("https://supreme.example/api/auth/register", {
    headers: { "x-forwarded-for": "attacker-controlled-value" },
  });

  assert.equal(
    clientRateLimitKey(request, "registration", true),
    "registration:shared-client"
  );
});

test("429 response is generic and includes retry metadata", async () => {
  const response = rateLimitExceededResponse({
    allowed: false,
    limit: 5,
    remaining: 0,
    resetAt: 61_000,
    retryAfterSeconds: 60,
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("ratelimit-limit"), "5");
  assert.deepEqual(await response.json(), {
    error: "Muitas tentativas. Tente novamente mais tarde.",
  });
});

test("successful responses receive remaining quota metadata", () => {
  const response = attachRateLimitHeaders(
    Response.json({ ok: true }),
    {
      allowed: true,
      limit: 10,
      remaining: 7,
      resetAt: 61_000,
      retryAfterSeconds: 60,
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("ratelimit-limit"), "10");
  assert.equal(response.headers.get("ratelimit-remaining"), "7");
  assert.equal(response.headers.get("ratelimit-reset"), "60");
});

test("public abuse surfaces use their dedicated policies", () => {
  const contracts = [
    [
      "src/app/api/auth/register/route.ts",
      "registrationRateLimiter",
      'clientRateLimitKey(request, "registration")',
    ],
    [
      "src/app/api/auth/[...nextauth]/route.ts",
      "credentialsRateLimiter",
      'request.nextUrl.pathname !== "/api/auth/callback/credentials"',
    ],
    [
      "src/app/api/uploadthing/route.ts",
      "uploadRateLimiter",
      'clientRateLimitKey(request, "upload")',
    ],
  ];

  for (const [path, limiter, routeContract] of contracts) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(limiter));
    assert.ok(source.includes(routeContract));
    assert.match(source, /rateLimitExceededResponse/);
  }
});
