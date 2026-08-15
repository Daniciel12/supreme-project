import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier.slice(2)}.ts`, sourceRoot).href,
      };
    }
    return nextResolve(specifier, context);
  },
});

function asyncStub(implementation = async () => null) {
  const stub = mock.fn(implementation);
  return stub;
}

const verificationTokenDeleteMany = asyncStub(async () => ({ count: 1 }));
const verificationTokenCreate = asyncStub(async ({ data }) => data);
const verificationTokenFindUnique = asyncStub();
const userFindUnique = asyncStub();
const userUpdateMany = asyncStub(async () => ({ count: 1 }));

const transaction = {
  verificationToken: {
    deleteMany: verificationTokenDeleteMany,
    create: verificationTokenCreate,
    findUnique: verificationTokenFindUnique,
  },
  user: { findUnique: userFindUnique, updateMany: userUpdateMany },
};
const prisma = {
  ...transaction,
  $transaction: async (operation) => operation(transaction),
};

mock.module("server-only", { exports: { default: {} } });
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  exports: { prisma },
});

const {
  consumeEmailVerificationToken,
  hashEmailVerificationToken,
  issueEmailVerificationToken,
} = await import("../src/lib/email-verification.ts");

test("issued tokens are random credentials stored only as SHA-256", async () => {
  const issued = await issueEmailVerificationToken({
    userId: "user-1",
    email: "Owner@Example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;

  assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(stored.token, hashEmailVerificationToken(issued.token));
  assert.notEqual(stored.token, issued.token);
  assert.doesNotMatch(stored.identifier, /owner@example\.test/i);
  assert.match(stored.identifier, /^email-verification:user-1:[a-f0-9]{64}$/);
  assert.ok(stored.expires.getTime() > Date.now());
  assert.ok(stored.expires.getTime() <= Date.now() + 24 * 60 * 60 * 1000);
});

test("a valid token verifies the current email and revokes sibling tokens", async () => {
  const issued = await issueEmailVerificationToken({
    userId: "user-2",
    email: "owner@example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;
  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  userFindUnique.mock.mockImplementation(async () => ({
    id: "user-2",
    email: "owner@example.test",
  }));

  assert.equal(await consumeEmailVerificationToken(issued.token), true);
  assert.deepEqual(userUpdateMany.mock.calls.at(-1).arguments[0].where, {
    id: "user-2",
    email: "owner@example.test",
  });
  assert.ok(
    userUpdateMany.mock.calls.at(-1).arguments[0].data.emailVerified instanceof Date
  );
  assert.deepEqual(verificationTokenDeleteMany.mock.calls.at(-1).arguments[0], {
    where: { identifier: stored.identifier },
  });
});

test("expired or email-mismatched tokens fail without verifying a user", async () => {
  const baselineUpdates = userUpdateMany.mock.callCount();
  const issued = await issueEmailVerificationToken({
    userId: "user-3",
    email: "old@example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;

  verificationTokenFindUnique.mock.mockImplementation(async () => ({
    ...stored,
    expires: new Date(Date.now() - 1),
  }));
  assert.equal(await consumeEmailVerificationToken(issued.token), false);

  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  userFindUnique.mock.mockImplementation(async () => ({
    id: "user-3",
    email: "new@example.test",
  }));
  assert.equal(await consumeEmailVerificationToken(issued.token), false);
  assert.equal(userUpdateMany.mock.callCount(), baselineUpdates);
});

test("a token already claimed by a concurrent confirmation cannot verify twice", async () => {
  const baselineUpdates = userUpdateMany.mock.callCount();
  const issued = await issueEmailVerificationToken({
    userId: "user-4",
    email: "owner@example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;
  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  verificationTokenDeleteMany.mock.mockImplementationOnce(async () => ({
    count: 0,
  }));

  assert.equal(await consumeEmailVerificationToken(issued.token), false);
  assert.equal(userUpdateMany.mock.callCount(), baselineUpdates);
});

test("malformed tokens are rejected before a database lookup", async () => {
  const baselineLookups = verificationTokenFindUnique.mock.callCount();
  assert.equal(await consumeEmailVerificationToken("not-a-token"), false);
  assert.equal(verificationTokenFindUnique.mock.callCount(), baselineLookups);
});
