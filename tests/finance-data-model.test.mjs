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
const financialAccountFindMany = createAsyncStub();
const financialAccountCreate = createAsyncStub();

const prisma = {
  financialAccount: {
    findMany: financialAccountFindMany,
    create: financialAccountCreate,
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
const { GET: listAccounts, POST: createAccount } = await import(
  "../src/app/api/finances/accounts/route.ts"
);

const USER_ID = "user-1";

beforeEach(() => {
  getServerSession.reset();
  financialAccountFindMany.reset();
  financialAccountCreate.reset();
  getServerSession.implementation = async () => ({ user: { id: USER_ID } });
});

function decimal(value) {
  return { toString: () => String(value) };
}

function jsonRequest(payload) {
  return new NextRequest("http://localhost/api/finances/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("account balance is derived from initial balance and paid transactions", async () => {
  financialAccountFindMany.implementation = async () => [
    {
      id: "account-1",
      name: "Principal",
      type: "CHECKING",
      userId: USER_ID,
      initialBalance: decimal("100.00"),
      transactions: [
        { amount: decimal("50.00"), type: "INCOME" },
        { amount: decimal("20.00"), type: "EXPENSE" },
      ],
    },
  ];

  const response = await listAccounts();
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body[0].initialBalance, 100);
  assert.equal(body[0].balance, 130);
  assert.equal("transactions" in body[0], false);
  assert.deepEqual(financialAccountFindMany.calls[0][0], {
    where: { userId: USER_ID },
    orderBy: { name: "asc" },
    include: {
      transactions: {
        where: { isPaid: true },
        select: { amount: true, type: true },
      },
    },
  });
});

test("account creation normalizes friendly type and preserves numeric API contract", async () => {
  financialAccountCreate.implementation = async ({ data }) => ({
    id: "account-1",
    ...data,
    initialBalance: decimal(data.initialBalance),
  });

  const response = await createAccount(
    jsonRequest({ name: "Nubank", type: "Corrente", balance: 1500.25 })
  );
  assert.equal(response.status, 201);
  const body = await response.json();

  assert.equal(financialAccountCreate.calls[0][0].data.type, "CHECKING");
  assert.equal(financialAccountCreate.calls[0][0].data.userId, USER_ID);
  assert.equal(body.initialBalance, 1500.25);
  assert.equal(body.balance, 1500.25);
});

test("account creation rejects client-injected ownership", async () => {
  const response = await createAccount(
    jsonRequest({
      name: "Conta",
      type: "CASH",
      balance: 10,
      userId: "attacker",
    })
  );

  assert.equal(response.status, 400);
  assert.equal(financialAccountCreate.calls.length, 0);
});

test("account creation rejects money with more than two decimal places", async () => {
  const response = await createAccount(
    jsonRequest({ name: "Conta", type: "CASH", balance: 10.001 })
  );

  assert.equal(response.status, 400);
  assert.equal(financialAccountCreate.calls.length, 0);
});
