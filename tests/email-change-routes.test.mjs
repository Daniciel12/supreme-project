import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, beforeEach, mock, test } from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier.slice(2)}.ts`, sourceRoot).href,
      };
    }
    if (specifier === "next/server") {
      return nextResolve(`${specifier}.js`, context);
    }
    return nextResolve(specifier, context);
  },
});

const getServerSession = mock.fn();
const requestEmailChange = mock.fn();
const revokeEmailChangeToken = mock.fn();
const confirmEmailChange = mock.fn();
const readEmailTransportConfiguration = mock.fn();
const sendEmailChangeRequestedNotice = mock.fn();
const sendEmailChangeVerification = mock.fn();
const sendEmailChangedNotice = mock.fn();
const limiterCheck = mock.fn(() => ({
  allowed: true,
  limit: 3,
  remaining: 2,
  resetAt: Date.now() + 60_000,
  retryAfterSeconds: 60,
}));

class EmailConfigurationError extends Error {}

mock.module("next-auth/next", { namedExports: { getServerSession } });
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module(new URL("../src/lib/email-change.ts", import.meta.url), {
  namedExports: {
    requestEmailChange,
    revokeEmailChangeToken,
    confirmEmailChange,
  },
});
mock.module(new URL("../src/lib/email.ts", import.meta.url), {
  namedExports: {
    EmailConfigurationError,
    readEmailTransportConfiguration,
    sendEmailChangeRequestedNotice,
    sendEmailChangeVerification,
    sendEmailChangedNotice,
  },
});
mock.module(new URL("../src/lib/rate-limit.ts", import.meta.url), {
  namedExports: {
    emailChangeRequestRateLimiter: { check: limiterCheck },
    emailChangeConfirmRateLimiter: { check: limiterCheck },
    clientRateLimitKey: () => "email-change:test-client",
    attachRateLimitHeaders: (response) => response,
    rateLimitExceededResponse: () => Response.json({}, { status: 429 }),
  },
});

const { NextRequest } = await import("next/server");
const { POST: requestChange } = await import(
  "../src/app/api/account/email-change/request/route.ts"
);
const { POST: confirmChange } = await import(
  "../src/app/api/account/email-change/confirm/route.ts"
);

function jsonRequest(path, payload) {
  return new NextRequest(`https://supreme.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const validRequest = {
  newEmail: "new@example.test",
  password: "current-password",
};

const originalNextAuthUrl = process.env.NEXTAUTH_URL;

after(() => {
  if (originalNextAuthUrl === undefined) {
    delete process.env.NEXTAUTH_URL;
  } else {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  }
});

beforeEach(() => {
  process.env.NEXTAUTH_URL = "https://supreme.example";

  for (const stub of [
    getServerSession,
    requestEmailChange,
    revokeEmailChangeToken,
    confirmEmailChange,
    readEmailTransportConfiguration,
    sendEmailChangeRequestedNotice,
    sendEmailChangeVerification,
    sendEmailChangedNotice,
    limiterCheck,
  ]) {
    stub.mock.resetCalls();
  }

  limiterCheck.mock.mockImplementation(() => ({
    allowed: true,
    limit: 3,
    remaining: 2,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 60,
  }));
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "session-user" },
    authenticatedAt: "2026-08-16T18:00:00.000Z",
  }));
  readEmailTransportConfiguration.mock.mockImplementation(() => ({}));
  requestEmailChange.mock.mockImplementation(async () => ({
    status: "issued",
    token: "a".repeat(43),
    tokenHash: "token-hash",
    currentEmail: "old@example.test",
    newEmail: "new@example.test",
    expires: new Date(Date.now() + 60_000),
  }));
  confirmEmailChange.mock.mockImplementation(async () => ({
    status: "changed",
    previousEmail: "old@example.test",
    newEmail: "new@example.test",
  }));
});

test("request derives identity only from the authenticated session", async () => {
  const response = await requestChange(
    jsonRequest("/api/account/email-change/request", validRequest)
  );

  assert.equal(response.status, 202);
  assert.deepEqual(requestEmailChange.mock.calls[0].arguments[0], {
    userId: "session-user",
    newEmail: "new@example.test",
    password: "current-password",
    authenticatedAt: "2026-08-16T18:00:00.000Z",
  });
  assert.deepEqual(
    sendEmailChangeRequestedNotice.mock.calls[0].arguments[0],
    { to: "old@example.test", newEmail: "new@example.test" }
  );
  const verification =
    sendEmailChangeVerification.mock.calls[0].arguments[0];
  assert.equal(verification.to, "new@example.test");
  assert.match(verification.verificationUrl, /alterar-email#token=/);
  assert.doesNotMatch(verification.verificationUrl, /old@example|new@example/);
});

test("request rejects missing session and client-selected identity", async () => {
  getServerSession.mock.mockImplementationOnce(async () => null);
  assert.equal(
    (
      await requestChange(
        jsonRequest("/api/account/email-change/request", validRequest)
      )
    ).status,
    401
  );

  assert.equal(
    (
      await requestChange(
        jsonRequest("/api/account/email-change/request", {
          ...validRequest,
          userId: "attacker-selected-user",
        })
      )
    ).status,
    400
  );
});

test("request maps identity, freshness and collision failures deliberately", async () => {
  for (const [status, expected] of [
    ["invalid-identity", 403],
    ["recent-authentication-required", 428],
    ["same-email", 400],
    ["conflict", 409],
    ["unavailable", 409],
  ]) {
    requestEmailChange.mock.mockImplementationOnce(async () => ({ status }));
    const response = await requestChange(
      jsonRequest("/api/account/email-change/request", validRequest)
    );
    assert.equal(response.status, expected);
  }
});

test("delivery failure revokes the newly issued token", async (t) => {
  t.mock.method(console, "error", () => {});
  sendEmailChangeVerification.mock.mockImplementationOnce(async () => {
    throw new Error("SMTP unavailable");
  });

  const response = await requestChange(
    jsonRequest("/api/account/email-change/request", validRequest)
  );
  assert.equal(response.status, 503);
  assert.deepEqual(revokeEmailChangeToken.mock.calls[0].arguments, [
    "token-hash",
  ]);
});

test("confirmation is explicit, single-token and revokes the old session", async () => {
  const response = await confirmChange(
    jsonRequest("/api/account/email-change/confirm", {
      token: "a".repeat(43),
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(confirmEmailChange.mock.calls[0].arguments, ["a".repeat(43)]);
  assert.deepEqual(sendEmailChangedNotice.mock.calls[0].arguments[0], {
    to: "old@example.test",
  });
});

test("completion notice failure does not misreport a committed email change", async (t) => {
  t.mock.method(console, "error", () => {});
  sendEmailChangedNotice.mock.mockImplementationOnce(async () => {
    throw new Error("SMTP unavailable after commit");
  });

  const response = await confirmChange(
    jsonRequest("/api/account/email-change/confirm", {
      token: "a".repeat(43),
    })
  );
  assert.equal(response.status, 200);
});

test("invalid and newly-colliding confirmation tokens fail closed", async () => {
  confirmEmailChange.mock.mockImplementationOnce(async () => ({
    status: "invalid",
  }));
  assert.equal(
    (
      await confirmChange(
        jsonRequest("/api/account/email-change/confirm", {
          token: "a".repeat(43),
        })
      )
    ).status,
    400
  );

  confirmEmailChange.mock.mockImplementationOnce(async () => ({
    status: "conflict",
  }));
  assert.equal(
    (
      await confirmChange(
        jsonRequest("/api/account/email-change/confirm", {
          token: "b".repeat(43),
        })
      )
    ).status,
    409
  );
});
