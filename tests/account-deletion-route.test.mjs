import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, mock, test } from "node:test";

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
const deleteAccount = mock.fn();
const limiterCheck = mock.fn(() => ({ allowed: true }));

mock.module("next-auth/next", {
  namedExports: { getServerSession },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module(new URL("../src/lib/account-deletion.ts", import.meta.url), {
  namedExports: { deleteAccount },
});
mock.module(new URL("../src/lib/rate-limit.ts", import.meta.url), {
  namedExports: {
    accountDeletionRateLimiter: { check: limiterCheck },
    clientRateLimitKey: () => "account-deletion:test-client",
    rateLimitExceededResponse: () => Response.json({}, { status: 429 }),
  },
});

const { NextRequest } = await import("next/server");
const { DELETE } = await import("../src/app/api/account/route.ts");

function request(body) {
  return new NextRequest("https://supreme.example/api/account", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  email: "owner@example.com",
  password: "valid-password",
  confirmation: "EXCLUIR MINHA CONTA",
  acknowledgedBackupRetention: true,
};

beforeEach(() => {
  getServerSession.mock.resetCalls();
  deleteAccount.mock.resetCalls();
  limiterCheck.mock.resetCalls();
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "session-user", email: "owner@example.com" },
    authenticatedAt: "2026-08-16T13:30:00.000Z",
  }));
  deleteAccount.mock.mockImplementation(async () => ({ status: "deleted" }));
  limiterCheck.mock.mockImplementation(() => ({ allowed: true }));
});

test("account deletion requires an authenticated session", async () => {
  getServerSession.mock.mockImplementation(async () => null);
  const response = await DELETE(request(validPayload));
  assert.equal(response.status, 401);
  assert.equal(deleteAccount.mock.callCount(), 0);
});

test("strict confirmation rejects a client-selected user id", async () => {
  const response = await DELETE(
    request({ ...validPayload, userId: "attacker-selected-user" })
  );
  assert.equal(response.status, 400);
  assert.equal(deleteAccount.mock.callCount(), 0);
});

test("route derives identity only from the session", async () => {
  const response = await DELETE(request(validPayload));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(deleteAccount.mock.calls[0].arguments[0], {
    userId: "session-user",
    email: "owner@example.com",
    password: "valid-password",
    authenticatedAt: "2026-08-16T13:30:00.000Z",
  });
});

test("partial remote cleanup stays retryable", async () => {
  deleteAccount.mock.mockImplementation(async () => ({
    status: "remote-cleanup-pending",
  }));
  const response = await DELETE(request(validPayload));
  assert.equal(response.status, 503);
});

test("OAuth-only stale authentication requests a new login", async () => {
  deleteAccount.mock.mockImplementation(async () => ({
    status: "recent-authentication-required",
  }));
  const response = await DELETE(request({ ...validPayload, password: undefined }));
  assert.equal(response.status, 428);
});
