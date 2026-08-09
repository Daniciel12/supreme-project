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

function createAsyncStub() {
  const stub = async (...args) => {
    stub.calls.push(args);
    return stub.implementation(...args);
  };
  stub.calls = [];
  stub.implementation = async () => null;
  stub.reset = () => {
    stub.calls = [];
    stub.implementation = async () => null;
  };
  return stub;
}

const getServerSession = createAsyncStub();
const transactionFindFirst = createAsyncStub();
const transactionUpdate = createAsyncStub();

const prisma = {
  transaction: {
    findFirst: transactionFindFirst,
    update: transactionUpdate,
  },
};

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });

const { NextRequest } = await import("next/server");
const { PATCH: updateTransactionStatus } = await import(
  "../src/app/api/finances/transactions/[id]/route.ts"
);

const USER_ID = "user-1";
const TRANSACTION_ID = "550e8400-e29b-41d4-a716-446655440000";
const stubs = [getServerSession, transactionFindFirst, transactionUpdate];

beforeEach(() => {
  for (const stub of stubs) stub.reset();
});

function authenticate(userId = USER_ID) {
  getServerSession.implementation = async () => ({ user: { id: userId } });
}

function request(payload) {
  return new NextRequest(
    `http://localhost/api/finances/transactions/${TRANSACTION_ID}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

function context(id = TRANSACTION_ID) {
  return { params: Promise.resolve({ id }) };
}

async function bodyWithStatus(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

test("finance transaction status returns 401 without a session", async () => {
  const response = await updateTransactionStatus(request({ isPaid: true }), context());
  await bodyWithStatus(response, 401);
  assert.equal(transactionFindFirst.calls.length, 0);
  assert.equal(transactionUpdate.calls.length, 0);
});

test("finance transaction status rejects an invalid id before Prisma", async () => {
  authenticate();
  const response = await updateTransactionStatus(
    request({ isPaid: true }),
    context("not-a-uuid")
  );
  await bodyWithStatus(response, 400);
  assert.equal(transactionFindFirst.calls.length, 0);
  assert.equal(transactionUpdate.calls.length, 0);
});

test("finance transaction status rejects an invalid payload before Prisma", async () => {
  authenticate();
  const response = await updateTransactionStatus(
    request({ isPaid: "yes" }),
    context()
  );
  await bodyWithStatus(response, 400);
  assert.equal(transactionFindFirst.calls.length, 0);
  assert.equal(transactionUpdate.calls.length, 0);
});

test("finance transaction status rejects extra payload fields", async () => {
  authenticate();
  const response = await updateTransactionStatus(
    request({ isPaid: true, title: "Injected" }),
    context()
  );
  await bodyWithStatus(response, 400);
  assert.equal(transactionFindFirst.calls.length, 0);
  assert.equal(transactionUpdate.calls.length, 0);
});

test("finance transaction status returns 404 for a missing transaction", async () => {
  authenticate();
  transactionFindFirst.implementation = async () => null;

  const response = await updateTransactionStatus(request({ isPaid: true }), context());
  const body = await bodyWithStatus(response, 404);

  assert.deepEqual(transactionFindFirst.calls[0][0], {
    where: { id: TRANSACTION_ID, userId: USER_ID },
    select: { id: true },
  });
  assert.deepEqual(body, { error: "Transação não encontrada." });
  assert.equal(transactionUpdate.calls.length, 0);
});

test("finance transaction status rejects another user's transaction as not found", async () => {
  authenticate("user-2");
  transactionFindFirst.implementation = async () => null;

  const response = await updateTransactionStatus(request({ isPaid: true }), context());
  const body = await bodyWithStatus(response, 404);

  assert.deepEqual(transactionFindFirst.calls[0][0], {
    where: { id: TRANSACTION_ID, userId: "user-2" },
    select: { id: true },
  });
  assert.deepEqual(body, { error: "Transação não encontrada." });
  assert.equal(transactionUpdate.calls.length, 0);
});

function prepareOwnedTransaction() {
  authenticate();
  transactionFindFirst.implementation = async () => ({ id: TRANSACTION_ID });
  transactionUpdate.implementation = async ({ data }) => ({
    id: TRANSACTION_ID,
    title: "Aluguel",
    type: "EXPENSE",
    amount: { toString: () => "850.40" },
    date: new Date("2026-08-09T12:00:00.000Z"),
    isPaid: data.isPaid,
    accountId: "a53bd3f0-bdf0-4f86-9a48-3cbfdf915277",
    userId: USER_ID,
  });
}

test("finance transaction status marks an owned transaction as paid", async () => {
  prepareOwnedTransaction();

  const response = await updateTransactionStatus(request({ isPaid: true }), context());
  const body = await bodyWithStatus(response, 200);

  assert.deepEqual(transactionUpdate.calls[0][0], {
    where: { id: TRANSACTION_ID, userId: USER_ID },
    data: { isPaid: true },
  });
  assert.equal(body.amount, 850.4);
  assert.equal(body.isPaid, true);
});

test("finance transaction status returns an owned transaction to pending", async () => {
  prepareOwnedTransaction();

  const response = await updateTransactionStatus(request({ isPaid: false }), context());
  const body = await bodyWithStatus(response, 200);

  assert.deepEqual(transactionUpdate.calls[0][0], {
    where: { id: TRANSACTION_ID, userId: USER_ID },
    data: { isPaid: false },
  });
  assert.equal(body.amount, 850.4);
  assert.equal(body.isPaid, false);
});

test("finance transaction status hides internal errors", async (t) => {
  t.mock.method(console, "error", () => {});
  authenticate();
  transactionFindFirst.implementation = async () => {
    throw new Error("Prisma connection secret");
  };

  const response = await updateTransactionStatus(request({ isPaid: true }), context());
  const body = await bodyWithStatus(response, 500);

  assert.equal(typeof body.error, "string");
  assert.doesNotMatch(JSON.stringify(body), /Prisma|stack|secret/i);
});
