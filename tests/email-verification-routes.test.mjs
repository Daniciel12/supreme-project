import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);
process.env.NEXTAUTH_URL = "https://supreme.example";

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
const userFindUnique = mock.fn();
const issueEmailVerificationToken = mock.fn();
const revokeEmailVerificationToken = mock.fn(async () => undefined);
const sendEmailVerification = mock.fn(async () => undefined);
const readEmailTransportConfiguration = mock.fn(() => ({}));
const consumeEmailVerificationToken = mock.fn();

class EmailConfigurationError extends Error {}

mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  exports: { authOptions: {} },
});
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  exports: { prisma: { user: { findUnique: userFindUnique } } },
});
mock.module(new URL("../src/lib/email.ts", import.meta.url), {
  exports: {
    EmailConfigurationError,
    readEmailTransportConfiguration,
    sendEmailVerification,
  },
});
mock.module(new URL("../src/lib/email-verification.ts", import.meta.url), {
  exports: {
    issueEmailVerificationToken,
    revokeEmailVerificationToken,
    consumeEmailVerificationToken,
  },
});
mock.module("next-auth/next", { exports: { getServerSession } });

const { NextRequest } = await import("next/server");
const { POST: requestVerification } = await import(
  "../src/app/api/auth/email-verification/request/route.ts"
);
const { POST: confirmVerification } = await import(
  "../src/app/api/auth/email-verification/confirm/route.ts"
);

function request(path, body) {
  return new NextRequest(`https://supreme.example${path}`, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("verification request requires a real session", async () => {
  getServerSession.mock.mockImplementation(async () => null);
  const response = await requestVerification(
    request("/api/auth/email-verification/request")
  );

  assert.equal(response.status, 401);
  assert.equal(userFindUnique.mock.callCount(), 0);
});

test("verified accounts do not issue or send a token", async () => {
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "verified-user" },
  }));
  userFindUnique.mock.mockImplementation(async () => ({
    id: "verified-user",
    email: "verified@example.test",
    emailVerified: new Date(),
  }));
  const baselineIssues = issueEmailVerificationToken.mock.callCount();
  const response = await requestVerification(
    request("/api/auth/email-verification/request")
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "already-verified" });
  assert.equal(issueEmailVerificationToken.mock.callCount(), baselineIssues);
});

test("request sends only to the session user's database email", async () => {
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "pending-user" },
  }));
  userFindUnique.mock.mockImplementation(async () => ({
    id: "pending-user",
    email: "owner@example.test",
    emailVerified: null,
  }));
  issueEmailVerificationToken.mock.mockImplementation(async () => ({
    token: "a".repeat(43),
    tokenHash: "hashed-token",
    expires: new Date(Date.now() + 60_000),
  }));
  const response = await requestVerification(
    request("/api/auth/email-verification/request")
  );

  assert.equal(response.status, 202);
  const responseBody = await response.json();
  assert.deepEqual(responseBody, { status: "verification-sent" });
  assert.equal(
    sendEmailVerification.mock.calls.at(-1).arguments[0].to,
    "owner@example.test"
  );
  assert.match(
    sendEmailVerification.mock.calls.at(-1).arguments[0].verificationUrl,
    /\/verificar-email#token=a{43}$/
  );
  assert.doesNotMatch(JSON.stringify(responseBody), /a{43}/);
});

test("a delivery failure revokes the newly issued token", async () => {
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "delivery-failure-user" },
  }));
  userFindUnique.mock.mockImplementation(async () => ({
    id: "delivery-failure-user",
    email: "owner@example.test",
    emailVerified: null,
  }));
  issueEmailVerificationToken.mock.mockImplementation(async () => ({
    token: "d".repeat(43),
    tokenHash: "failed-delivery-hash",
    expires: new Date(Date.now() + 60_000),
  }));
  sendEmailVerification.mock.mockImplementationOnce(async () => {
    throw new Error("test delivery failure");
  });
  const response = await requestVerification(
    request("/api/auth/email-verification/request")
  );

  assert.equal(response.status, 503);
  assert.deepEqual(
    revokeEmailVerificationToken.mock.calls.at(-1).arguments,
    ["failed-delivery-hash"]
  );
  assert.doesNotMatch(JSON.stringify(await response.json()), /failed-delivery-hash/);
});

test("confirmation returns one generic error for invalid and consumed tokens", async () => {
  const malformed = await confirmVerification(
    request("/api/auth/email-verification/confirm", { token: "short" })
  );
  assert.equal(malformed.status, 400);
  const malformedBody = await malformed.json();

  consumeEmailVerificationToken.mock.mockImplementation(async () => false);
  const consumed = await confirmVerification(
    request("/api/auth/email-verification/confirm", { token: "b".repeat(43) })
  );
  assert.equal(consumed.status, 400);
  assert.deepEqual(await consumed.json(), malformedBody);
});

test("confirmation succeeds only after the server consumes the token", async () => {
  consumeEmailVerificationToken.mock.mockImplementation(async () => true);
  const response = await confirmVerification(
    request("/api/auth/email-verification/confirm", { token: "c".repeat(43) })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "email-verified" });
});
