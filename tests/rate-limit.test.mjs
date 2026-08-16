import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FixedWindowRateLimiter,
  attachRateLimitHeaders,
  clientRateLimitKey,
  isUploadInitiationRequest,
  nextAuthRateLimitExceededResponse,
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

test("capacity pressure preserves active counters and fails closed", () => {
  const limiter = new FixedWindowRateLimiter({
    limit: 1,
    windowMs: 60_000,
    maxEntries: 2,
  });

  assert.equal(limiter.check("client-a").allowed, true);
  assert.equal(limiter.check("client-b").allowed, true);
  assert.equal(limiter.check("client-c").allowed, true);
  assert.equal(limiter.check("client-d").allowed, false);
  assert.equal(limiter.check("client-c").allowed, false);
  assert.equal(limiter.check("client-a").allowed, false);
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

test("NextAuth 429 response preserves the redirect-false client contract", async () => {
  const request = new Request(
    "https://supreme.example/api/auth/callback/credentials"
  );
  const response = nextAuthRateLimitExceededResponse(request, {
    allowed: false,
    limit: 10,
    remaining: 0,
    resetAt: 61_000,
    retryAfterSeconds: 60,
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");

  const data = await response.json();
  const errorUrl = new URL(data.url);
  assert.equal(errorUrl.origin, "https://supreme.example");
  assert.equal(errorUrl.pathname, "/api/auth/error");
  assert.equal(errorUrl.searchParams.get("error"), "TooManyRequests");
});

test("only client upload initiation is subject to the local quota", () => {
  assert.equal(
    isUploadInitiationRequest(
      new Request(
        "https://supreme.example/api/uploadthing?actionType=upload&slug=receiptUploader"
      )
    ),
    true
  );
  assert.equal(
    isUploadInitiationRequest(
      new Request("https://supreme.example/api/uploadthing", {
        headers: { "uploadthing-hook": "callback" },
      })
    ),
    false
  );
  assert.equal(
    isUploadInitiationRequest(
      new Request("https://supreme.example/api/uploadthing", {
        headers: { "uploadthing-hook": "error" },
      })
    ),
    false
  );
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
    [
      "src/app/api/auth/email-verification/request/route.ts",
      "emailVerificationRequestRateLimiter",
      'clientRateLimitKey(request, "email-verification-request")',
    ],
    [
      "src/app/api/auth/email-verification/confirm/route.ts",
      "emailVerificationConfirmRateLimiter",
      'clientRateLimitKey(request, "email-verification-confirm")',
    ],
    [
      "src/app/api/auth/password-recovery/request/route.ts",
      "passwordRecoveryRequestIpRateLimiter",
      'clientRateLimitKey(request, "password-recovery-request")',
    ],
    [
      "src/app/api/auth/password-recovery/confirm/route.ts",
      "passwordRecoveryConfirmRateLimiter",
      'clientRateLimitKey(request, "password-recovery-confirm")',
    ],
    [
      "src/app/api/account/email-change/request/route.ts",
      "emailChangeRequestRateLimiter",
      'clientRateLimitKey(request, "email-change-request")',
    ],
    [
      "src/app/api/account/email-change/confirm/route.ts",
      "emailChangeConfirmRateLimiter",
      'clientRateLimitKey(request, "email-change-confirm")',
    ],
  ];

  for (const [path, limiter, routeContract] of contracts) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(limiter));
    assert.ok(source.includes(routeContract));
    assert.match(source, /[rR]ateLimitExceededResponse/);
  }
});

test("account export has an authenticated client-and-user quota", () => {
  const source = readFileSync(
    new URL("../src/app/api/account/export/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /accountDataExportRateLimiter/);
  assert.ok(
    source.includes(
      '`${clientRateLimitKey(request, "account-data-export")}:${session.user.id}`'
    )
  );
  assert.match(source, /rateLimitExceededResponse/);
});

test("account deletion has an authenticated client-and-user quota", () => {
  const source = readFileSync(
    new URL("../src/app/api/account/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /accountDeletionRateLimiter/);
  assert.ok(
    source.includes(
      '`${clientRateLimitKey(request, "account-deletion")}:${session.user.id}`'
    )
  );
  assert.match(source, /rateLimitExceededResponse/);
});
