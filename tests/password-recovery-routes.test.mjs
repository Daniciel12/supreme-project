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

const userFindUnique = mock.fn();
const issuePasswordRecoveryToken = mock.fn();
const revokePasswordRecoveryToken = mock.fn(async () => undefined);
const sendPasswordResetEmail = mock.fn(async () => undefined);
const readEmailTransportConfiguration = mock.fn(() => ({}));
const resetPasswordWithToken = mock.fn();

class EmailConfigurationError extends Error {}

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma: { user: { findUnique: userFindUnique } } },
});
mock.module(new URL("../src/lib/email.ts", import.meta.url), {
  namedExports: {
    EmailConfigurationError,
    readEmailTransportConfiguration,
    sendPasswordResetEmail,
  },
});
mock.module(new URL("../src/lib/password-recovery.ts", import.meta.url), {
  namedExports: {
    issuePasswordRecoveryToken,
    passwordRecoveryRateLimitKey: (email) => `safe-${email.length}`,
    revokePasswordRecoveryToken,
    resetPasswordWithToken,
  },
});

const { NextRequest } = await import("next/server");
const { POST: requestRecovery } = await import(
  "../src/app/api/auth/password-recovery/request/route.ts"
);
const { POST: confirmRecovery } = await import(
  "../src/app/api/auth/password-recovery/confirm/route.ts"
);

function request(path, body) {
  return new NextRequest(`https://supreme.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("unknown and OAuth-only accounts receive the same generic response", async () => {
  userFindUnique.mock.mockImplementationOnce(async () => null);
  const unknown = await requestRecovery(
    request("/api/auth/password-recovery/request", {
      email: "unknown@example.test",
    })
  );

  userFindUnique.mock.mockImplementationOnce(async () => ({
    id: "oauth-user",
    email: "oauth@example.test",
    password: null,
  }));
  const oauthOnly = await requestRecovery(
    request("/api/auth/password-recovery/request", {
      email: "oauth@example.test",
    })
  );

  assert.equal(unknown.status, 202);
  assert.equal(oauthOnly.status, 202);
  assert.deepEqual(await unknown.json(), await oauthOnly.json());
  assert.equal(issuePasswordRecoveryToken.mock.callCount(), 0);
  assert.equal(sendPasswordResetEmail.mock.callCount(), 0);
});

test("a Credentials account receives a fragment-only reset link", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    id: "credentials-user",
    email: "owner@example.test",
    password: "stored-password-hash",
  }));
  issuePasswordRecoveryToken.mock.mockImplementation(async () => ({
    token: "a".repeat(43),
    tokenHash: "hashed-token",
    expires: new Date(Date.now() + 60_000),
  }));

  const response = await requestRecovery(
    request("/api/auth/password-recovery/request", {
      email: "owner@example.test",
    })
  );
  const responseBody = await response.json();

  assert.equal(response.status, 202);
  assert.deepEqual(responseBody.status, "accepted");
  const delivery = sendPasswordResetEmail.mock.calls.at(-1).arguments[0];
  assert.equal(delivery.to, "owner@example.test");
  assert.match(delivery.resetUrl, /\/redefinir-senha#token=a{43}$/);
  assert.doesNotMatch(JSON.stringify(responseBody), /a{43}|hashed-token/);
});

test("delivery failure revokes the token without revealing account existence", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    id: "delivery-user",
    email: "delivery@example.test",
    password: "stored-password-hash",
  }));
  issuePasswordRecoveryToken.mock.mockImplementation(async () => ({
    token: "d".repeat(43),
    tokenHash: "failed-delivery-hash",
    expires: new Date(Date.now() + 60_000),
  }));
  sendPasswordResetEmail.mock.mockImplementationOnce(async () => {
    throw new Error("test delivery failure");
  });

  const response = await requestRecovery(
    request("/api/auth/password-recovery/request", {
      email: "delivery@example.test",
    })
  );

  assert.equal(response.status, 202);
  assert.deepEqual(revokePasswordRecoveryToken.mock.calls.at(-1).arguments, [
    "failed-delivery-hash",
  ]);
  assert.doesNotMatch(JSON.stringify(await response.json()), /delivery-user|failed-delivery-hash/);
});

test("confirmation uses one generic error for malformed and consumed tokens", async () => {
  const malformed = await confirmRecovery(
    request("/api/auth/password-recovery/confirm", {
      token: "short",
      password: "new-password",
    })
  );
  const malformedBody = await malformed.json();

  resetPasswordWithToken.mock.mockImplementation(async () => false);
  const consumed = await confirmRecovery(
    request("/api/auth/password-recovery/confirm", {
      token: "b".repeat(43),
      password: "new-password",
    })
  );

  assert.equal(malformed.status, 400);
  assert.equal(consumed.status, 400);
  assert.deepEqual(await consumed.json(), malformedBody);
});

test("confirmation succeeds only after the transactional reset", async () => {
  resetPasswordWithToken.mock.mockImplementation(async () => true);
  const response = await confirmRecovery(
    request("/api/auth/password-recovery/confirm", {
      token: "c".repeat(43),
      password: "new-secure-password",
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "password-reset" });
});
