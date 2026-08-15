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

const bcryptHash = mock.fn(async () => "new-password-hash");
const verificationTokenDeleteMany = mock.fn(async () => ({ count: 1 }));
const verificationTokenCreate = mock.fn(async ({ data }) => data);
const verificationTokenFindUnique = mock.fn();
const userFindUnique = mock.fn();
const userUpdateMany = mock.fn(async () => ({ count: 1 }));
const sessionDeleteMany = mock.fn(async () => ({ count: 0 }));

const transaction = {
  verificationToken: {
    deleteMany: verificationTokenDeleteMany,
    create: verificationTokenCreate,
    findUnique: verificationTokenFindUnique,
  },
  user: { findUnique: userFindUnique, updateMany: userUpdateMany },
  session: { deleteMany: sessionDeleteMany },
};
const prisma = {
  ...transaction,
  $transaction: async (operation) => operation(transaction),
};

mock.module("server-only", { defaultExport: {} });
mock.module("bcrypt", { defaultExport: { hash: bcryptHash } });
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});

const {
  hashPasswordRecoveryToken,
  issuePasswordRecoveryToken,
  resetPasswordWithToken,
} = await import("../src/lib/password-recovery.ts");

test("recovery tokens are random, short lived and stored only as SHA-256", async () => {
  const issued = await issuePasswordRecoveryToken({
    userId: "user-1",
    email: "Owner@Example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;

  assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(stored.token, hashPasswordRecoveryToken(issued.token));
  assert.notEqual(stored.token, issued.token);
  assert.doesNotMatch(stored.identifier, /owner@example\.test/i);
  assert.match(stored.identifier, /^password-recovery:user-1:[a-f0-9]{64}$/);
  assert.ok(stored.expires.getTime() > Date.now());
  assert.ok(stored.expires.getTime() <= Date.now() + 60 * 60 * 1000);
});

test("a valid token replaces the password and invalidates every prior session", async () => {
  const issued = await issuePasswordRecoveryToken({
    userId: "user-2",
    email: "owner@example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;
  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  userFindUnique.mock.mockImplementation(async () => ({
    id: "user-2",
    email: "owner@example.test",
    password: "old-password-hash",
  }));

  assert.equal(
    await resetPasswordWithToken({
      token: issued.token,
      password: "new-secure-password",
    }),
    true
  );

  assert.deepEqual(bcryptHash.mock.calls.at(-1).arguments, [
    "new-secure-password",
    10,
  ]);
  const update = userUpdateMany.mock.calls.at(-1).arguments[0];
  assert.deepEqual(update.where, {
    id: "user-2",
    email: "owner@example.test",
    password: { not: null },
  });
  assert.equal(update.data.password, "new-password-hash");
  assert.ok(update.data.sessionsValidAfter instanceof Date);
  assert.deepEqual(sessionDeleteMany.mock.calls.at(-1).arguments[0], {
    where: { userId: "user-2" },
  });
});

test("expired, changed-email and OAuth-only accounts cannot reset a password", async () => {
  const baselineUpdates = userUpdateMany.mock.callCount();
  const issued = await issuePasswordRecoveryToken({
    userId: "user-3",
    email: "old@example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;

  verificationTokenFindUnique.mock.mockImplementation(async () => ({
    ...stored,
    expires: new Date(Date.now() - 1),
  }));
  assert.equal(
    await resetPasswordWithToken({ token: issued.token, password: "new-password" }),
    false
  );

  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  userFindUnique.mock.mockImplementation(async () => ({
    id: "user-3",
    email: "new@example.test",
    password: "old-password-hash",
  }));
  assert.equal(
    await resetPasswordWithToken({ token: issued.token, password: "new-password" }),
    false
  );

  userFindUnique.mock.mockImplementation(async () => ({
    id: "user-3",
    email: "old@example.test",
    password: null,
  }));
  assert.equal(
    await resetPasswordWithToken({ token: issued.token, password: "new-password" }),
    false
  );
  assert.equal(userUpdateMany.mock.callCount(), baselineUpdates);
});

test("a concurrently claimed token cannot reset the password twice", async () => {
  const baselineUpdates = userUpdateMany.mock.callCount();
  const issued = await issuePasswordRecoveryToken({
    userId: "user-4",
    email: "owner@example.test",
  });
  const stored = verificationTokenCreate.mock.calls.at(-1).arguments[0].data;
  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  verificationTokenDeleteMany.mock.mockImplementationOnce(async () => ({ count: 0 }));

  assert.equal(
    await resetPasswordWithToken({ token: issued.token, password: "new-password" }),
    false
  );
  assert.equal(userUpdateMany.mock.callCount(), baselineUpdates);
});

test("malformed tokens are rejected before bcrypt or database access", async () => {
  const baselineHashes = bcryptHash.mock.callCount();
  const baselineLookups = verificationTokenFindUnique.mock.callCount();

  assert.equal(
    await resetPasswordWithToken({ token: "not-a-token", password: "new-password" }),
    false
  );
  assert.equal(bcryptHash.mock.callCount(), baselineHashes);
  assert.equal(verificationTokenFindUnique.mock.callCount(), baselineLookups);
});
