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
    return nextResolve(specifier, context);
  },
});

function asyncStub(defaultValue = null) {
  return mock.fn(async () => defaultValue);
}

const userFindUnique = asyncStub();
const userFindFirst = asyncStub();
const transactionUserFindUnique = asyncStub();
const transactionUserFindFirst = asyncStub();
const transactionUserUpdateMany = asyncStub({ count: 1 });
const verificationTokenDeleteMany = asyncStub({ count: 1 });
const verificationTokenCreate = asyncStub();
const verificationTokenFindUnique = asyncStub();
const sessionDeleteMany = asyncStub({ count: 1 });
const queryRaw = asyncStub([{ id: "user-1" }]);
const bcryptCompare = asyncStub(false);

const transaction = {
  $queryRaw: queryRaw,
  user: {
    findUnique: transactionUserFindUnique,
    findFirst: transactionUserFindFirst,
    updateMany: transactionUserUpdateMany,
  },
  verificationToken: {
    deleteMany: verificationTokenDeleteMany,
    create: verificationTokenCreate,
    findUnique: verificationTokenFindUnique,
  },
  session: { deleteMany: sessionDeleteMany },
};

const prisma = {
  user: { findUnique: userFindUnique, findFirst: userFindFirst },
  verificationToken: { deleteMany: verificationTokenDeleteMany },
  $transaction: mock.fn(async (work) => work(transaction)),
};

mock.module("server-only", { defaultExport: {} });
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module("bcrypt", {
  defaultExport: { compare: bcryptCompare },
});

const {
  confirmEmailChange,
  hashEmailChangeToken,
  requestEmailChange,
} = await import("../src/lib/email-change.ts");

const stubs = [
  userFindUnique,
  userFindFirst,
  transactionUserFindUnique,
  transactionUserFindFirst,
  transactionUserUpdateMany,
  verificationTokenDeleteMany,
  verificationTokenCreate,
  verificationTokenFindUnique,
  sessionDeleteMany,
  queryRaw,
  bcryptCompare,
  prisma.$transaction,
];

beforeEach(() => {
  for (const stub of stubs) stub.mock.resetCalls();

  userFindFirst.mock.mockImplementation(async () => null);
  transactionUserFindFirst.mock.mockImplementation(async () => null);
  transactionUserUpdateMany.mock.mockImplementation(async () => ({ count: 1 }));
  verificationTokenDeleteMany.mock.mockImplementation(async () => ({ count: 1 }));
  verificationTokenCreate.mock.mockImplementation(async ({ data }) => data);
  sessionDeleteMany.mock.mockImplementation(async () => ({ count: 1 }));
  queryRaw.mock.mockImplementation(async () => [{ id: "user-1" }]);
  prisma.$transaction.mock.mockImplementation(async (work) => work(transaction));
});

function credentialsUser() {
  return {
    email: "owner@example.test",
    password: "stored-hash",
    deletionRequest: null,
  };
}

async function issueValidToken() {
  userFindUnique.mock.mockImplementation(async () => credentialsUser());
  bcryptCompare.mock.mockImplementation(async () => true);

  const result = await requestEmailChange({
    userId: "user-1",
    newEmail: "NEW@example.test",
    password: "current-password",
  });
  assert.equal(result.status, "issued");
  return {
    result,
    stored: verificationTokenCreate.mock.calls.at(-1).arguments[0].data,
  };
}

test("credentials request verifies identity and stores only a token hash", async () => {
  const { result, stored } = await issueValidToken();

  assert.equal(result.newEmail, "new@example.test");
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(stored.token, hashEmailChangeToken(result.token));
  assert.notEqual(stored.token, result.token);
  assert.match(
    stored.identifier,
    /^email-change:user-1:[a-f0-9]{64}:[A-Za-z0-9_-]+$/
  );
  assert.doesNotMatch(stored.identifier, /owner@example|new@example/i);
  assert.deepEqual(userFindFirst.mock.calls[0].arguments[0], {
    where: {
      id: { not: "user-1" },
      email: { equals: "new@example.test", mode: "insensitive" },
    },
    select: { id: true },
  });
});

test("wrong password and stale OAuth authentication cannot issue tokens", async () => {
  userFindUnique.mock.mockImplementation(async () => credentialsUser());
  bcryptCompare.mock.mockImplementation(async () => false);
  assert.deepEqual(
    await requestEmailChange({
      userId: "user-1",
      newEmail: "new@example.test",
      password: "wrong-password",
    }),
    { status: "invalid-identity" }
  );

  userFindUnique.mock.mockImplementation(async () => ({
    ...credentialsUser(),
    password: null,
  }));
  assert.deepEqual(
    await requestEmailChange({
      userId: "user-1",
      newEmail: "new@example.test",
      authenticatedAt: "2026-08-16T00:00:00.000Z",
    }),
    { status: "recent-authentication-required" }
  );
  assert.equal(verificationTokenCreate.mock.callCount(), 0);
});

test("same address, case-insensitive collision and deletion state fail closed", async () => {
  userFindUnique.mock.mockImplementation(async () => credentialsUser());
  assert.deepEqual(
    await requestEmailChange({
      userId: "user-1",
      newEmail: "OWNER@EXAMPLE.TEST",
      password: "current-password",
    }),
    { status: "same-email" }
  );

  bcryptCompare.mock.mockImplementation(async () => true);
  userFindFirst.mock.mockImplementation(async () => ({ id: "user-2" }));
  assert.deepEqual(
    await requestEmailChange({
      userId: "user-1",
      newEmail: "new@example.test",
      password: "current-password",
    }),
    { status: "conflict" }
  );

  userFindUnique.mock.mockImplementation(async () => ({
    ...credentialsUser(),
    deletionRequest: { status: "PENDING_REMOTE_CLEANUP" },
  }));
  assert.deepEqual(
    await requestEmailChange({
      userId: "user-1",
      newEmail: "another@example.test",
      password: "current-password",
    }),
    { status: "unavailable" }
  );
});

test("valid confirmation changes the email and revokes every session", async () => {
  const { result, stored } = await issueValidToken();
  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  transactionUserFindUnique.mock.mockImplementation(async () => ({
    email: "owner@example.test",
    deletionRequest: null,
  }));

  assert.deepEqual(await confirmEmailChange(result.token), {
    status: "changed",
    previousEmail: "owner@example.test",
    newEmail: "new@example.test",
  });

  const update = transactionUserUpdateMany.mock.calls[0].arguments[0];
  assert.deepEqual(update.where, {
    id: "user-1",
    email: "owner@example.test",
  });
  assert.equal(update.data.email, "new@example.test");
  assert.ok(update.data.emailVerified instanceof Date);
  assert.equal(update.data.sessionsValidAfter, update.data.emailVerified);
  assert.deepEqual(sessionDeleteMany.mock.calls[0].arguments[0], {
    where: { userId: "user-1" },
  });
  const cleanup = verificationTokenDeleteMany.mock.calls.at(-1).arguments[0];
  assert.match(JSON.stringify(cleanup), /email-verification:user-1/);
  assert.match(JSON.stringify(cleanup), /password-recovery:user-1/);
  assert.match(JSON.stringify(cleanup), /email-change:user-1/);
});

test("expired, concurrently claimed and now-colliding tokens cannot mutate", async () => {
  const { result, stored } = await issueValidToken();
  verificationTokenFindUnique.mock.mockImplementation(async () => ({
    ...stored,
    expires: new Date(Date.now() - 1),
  }));
  assert.deepEqual(await confirmEmailChange(result.token), { status: "invalid" });

  verificationTokenFindUnique.mock.mockImplementation(async () => stored);
  verificationTokenDeleteMany.mock.mockImplementationOnce(async () => ({
    count: 0,
  }));
  assert.deepEqual(await confirmEmailChange(result.token), { status: "invalid" });

  verificationTokenDeleteMany.mock.mockImplementation(async () => ({ count: 1 }));
  transactionUserFindUnique.mock.mockImplementation(async () => ({
    email: "owner@example.test",
    deletionRequest: null,
  }));
  transactionUserFindFirst.mock.mockImplementation(async () => ({ id: "user-2" }));
  assert.deepEqual(await confirmEmailChange(result.token), { status: "conflict" });
  assert.equal(transactionUserUpdateMany.mock.callCount(), 0);
});

test("malformed tokens fail before database access", async () => {
  assert.deepEqual(await confirmEmailChange("not-a-token"), {
    status: "invalid",
  });
  assert.equal(verificationTokenFindUnique.mock.callCount(), 0);
});
