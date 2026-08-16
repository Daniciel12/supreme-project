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
  const stub = mock.fn(async () => defaultValue);
  return stub;
}

const userFindUnique = asyncStub();
const transactionUserFindUnique = asyncStub();
const transactionUserUpdate = asyncStub({ id: "user-1" });
const transactionUserDelete = asyncStub({ id: "user-1" });
const sessionDeleteMany = asyncStub({ count: 1 });
const deletionRequestCreate = asyncStub({ id: "request-1" });
const deletionRequestUpdate = asyncStub({ id: "request-1" });
const deletionRequestFindUnique = asyncStub({ status: "COMPLETED" });
const deletionRequestUpdateMany = asyncStub({ count: 1 });
const verificationTokenDeleteMany = asyncStub({ count: 0 });
const queryRaw = asyncStub([{ id: "user-1" }]);

const transaction = {
  $queryRaw: queryRaw,
  user: {
    findUnique: transactionUserFindUnique,
    update: transactionUserUpdate,
    delete: transactionUserDelete,
  },
  session: { deleteMany: sessionDeleteMany },
  accountDeletionRequest: {
    create: deletionRequestCreate,
    update: deletionRequestUpdate,
    findUnique: deletionRequestFindUnique,
  },
  verificationToken: { deleteMany: verificationTokenDeleteMany },
};

const prisma = {
  user: { findUnique: userFindUnique },
  accountDeletionRequest: { updateMany: deletionRequestUpdateMany },
  $transaction: mock.fn(async (work) => work(transaction)),
};

const bcryptCompare = asyncStub(false);
mock.module("server-only", { defaultExport: {} });
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module("bcrypt", {
  defaultExport: { compare: bcryptCompare },
});
mock.module(new URL("../src/lib/uploadthing-files.ts", import.meta.url), {
  namedExports: {
    deleteUploadThingFiles: asyncStub(),
  },
});

const {
  accountDeletionFileKeys,
  deleteAccount,
  isRecentAuthentication,
} = await import("../src/lib/account-deletion.ts");

beforeEach(() => {
  for (const stub of [
    userFindUnique,
    transactionUserFindUnique,
    transactionUserUpdate,
    transactionUserDelete,
    sessionDeleteMany,
    deletionRequestCreate,
    deletionRequestUpdate,
    deletionRequestFindUnique,
    deletionRequestUpdateMany,
    verificationTokenDeleteMany,
    queryRaw,
    bcryptCompare,
    prisma.$transaction,
  ]) {
    stub.mock.resetCalls();
  }

  queryRaw.mock.mockImplementation(async () => [{ id: "user-1" }]);
  transactionUserUpdate.mock.mockImplementation(async () => ({ id: "user-1" }));
  transactionUserDelete.mock.mockImplementation(async () => ({ id: "user-1" }));
  sessionDeleteMany.mock.mockImplementation(async () => ({ count: 1 }));
  deletionRequestCreate.mock.mockImplementation(async () => ({ id: "request-1" }));
  deletionRequestUpdate.mock.mockImplementation(async () => ({ id: "request-1" }));
  deletionRequestUpdateMany.mock.mockImplementation(async () => ({ count: 1 }));
  prisma.$transaction.mock.mockImplementation(async (work) => work(transaction));
});

test("recent authentication is bounded to ten minutes", () => {
  const now = Date.parse("2026-08-16T13:30:00.000Z");
  assert.equal(
    isRecentAuthentication("2026-08-16T13:20:00.000Z", now),
    true
  );
  assert.equal(
    isRecentAuthentication("2026-08-16T13:19:59.999Z", now),
    false
  );
  assert.equal(isRecentAuthentication("invalid", now), false);
});

test("file inventory keeps only unique verified provider keys", () => {
  assert.deepEqual(
    accountDeletionFileKeys({
      visionImages: [
        { providerFileKey: "profile" },
        { providerFileKey: null },
        { providerFileKey: "profile" },
        { providerFileKey: "vision" },
      ],
    }),
    ["profile", "vision"]
  );
});

test("credentials identity must match before deletion starts", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    email: "owner@example.com",
    password: "stored-hash",
  }));
  bcryptCompare.mock.mockImplementation(async () => false);

  assert.deepEqual(
    await deleteAccount({
      userId: "user-1",
      email: "owner@example.com",
      password: "wrong-password",
    }),
    { status: "invalid-identity" }
  );
  assert.equal(prisma.$transaction.mock.callCount(), 0);
});

test("successful deletion cleans remote files before deleting the user", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    email: "owner@example.com",
    password: "stored-hash",
  }));
  bcryptCompare.mock.mockImplementation(async () => true);
  transactionUserFindUnique.mock.mockImplementation(async (query) => ({
    visionImages: [{ providerFileKey: "vision" }],
    ...(query.select.deletionRequest ? { deletionRequest: null } : {}),
  }));
  const deleteFiles = asyncStub();

  assert.deepEqual(
    await deleteAccount(
      {
        userId: "user-1",
        email: "OWNER@example.com",
        password: "valid-password",
      },
      deleteFiles
    ),
    { status: "deleted" }
  );
  assert.deepEqual(deleteFiles.mock.calls[0].arguments, [["vision"]]);
  assert.match(
    deletionRequestCreate.mock.calls[0].arguments[0].data.subjectHash,
    /^[a-f0-9]{64}$/
  );
  assert.equal(sessionDeleteMany.mock.callCount(), 1);
  assert.equal(transactionUserDelete.mock.callCount(), 1);
  assert.equal(verificationTokenDeleteMany.mock.callCount(), 1);
  assert.deepEqual(
    verificationTokenDeleteMany.mock.calls[0].arguments[0].where.OR,
    [
      { identifier: { startsWith: "email-verification:user-1:" } },
      { identifier: { startsWith: "password-recovery:user-1:" } },
      { identifier: { startsWith: "email-change:user-1:" } },
    ]
  );
});

test("provider failure preserves the account and records a retryable state", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    email: "owner@example.com",
    password: null,
  }));
  transactionUserFindUnique.mock.mockImplementation(async () => ({
    visionImages: [{ providerFileKey: "profile" }],
    deletionRequest: null,
  }));

  assert.deepEqual(
    await deleteAccount(
      {
        userId: "user-1",
        email: "owner@example.com",
        authenticatedAt: new Date().toISOString(),
      },
      async () => {
        throw new Error("provider unavailable");
      }
    ),
    { status: "remote-cleanup-pending" }
  );
  assert.equal(sessionDeleteMany.mock.callCount(), 1);
  assert.equal(deletionRequestUpdateMany.mock.callCount(), 1);
  assert.equal(transactionUserDelete.mock.callCount(), 0);
});
