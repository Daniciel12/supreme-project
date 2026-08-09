import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("finance schema and migration keep money decimal-safe and reject ambiguous transaction types", () => {
  const schema = readFileSync(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8"
  );
  const migration = readFileSync(
    new URL(
      "../prisma/migrations/20260809173000_finance_data_model_v2/migration.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(schema, /initialBalance\s+Decimal\s+@db\.Decimal\(19, 2\)/);
  assert.match(schema, /amount\s+Decimal\s+@db\.Decimal\(19, 2\)/);
  assert.doesNotMatch(
    schema.slice(schema.indexOf("model FinancialAccount")),
    /\b(?:balance|amount)\s+Float\b/
  );
  assert.ok(
    migration.indexOf("Cannot migrate unknown transaction type") <
      migration.indexOf('CREATE TYPE "TransactionType"'),
    "unknown transaction types must be rejected before schema changes"
  );
  assert.doesNotMatch(migration, /ELSE\s+'EXPENSE'/);
});

beforeEach(() => {
  getServerSession.reset();
  financialAccountFindMany.reset();
  financialAccountCreate.reset();
  getServerSession.implementation = async () => ({ user: { id: USER_ID } });
});

function decimal(value) {
  const cents = Math.round(Number(value) * 100);
  return decimalFromCents(cents);
}

function decimalFromCents(cents) {
  return {
    plus: (other) =>
      decimalFromCents(cents + Math.round(Number(other.toString()) * 100)),
    minus: (other) =>
      decimalFromCents(cents - Math.round(Number(other.toString()) * 100)),
    toString: () => (cents / 100).toFixed(2),
  };
}

function jsonRequest(payload) {
  return new NextRequest("http://localhost/api/finances/accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function accountBalance(
  initialBalance,
  transactions = [],
  expectedUserId = USER_ID
) {
  financialAccountFindMany.implementation = async () => [
    {
      id: "account-1",
      name: "Principal",
      type: "CHECKING",
      userId: USER_ID,
      initialBalance: decimal(initialBalance),
      transactions,
    },
  ];

  const response = await listAccounts();
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body[0].initialBalance, Number(initialBalance));
  assert.equal("transactions" in body[0], false);
  assert.deepEqual(financialAccountFindMany.calls[0][0], {
    where: { userId: expectedUserId },
    orderBy: { name: "asc" },
    include: {
      transactions: {
        where: { isPaid: true },
        select: { amount: true, type: true },
      },
    },
  });
  return body[0].balance;
}

test("account balance equals its initial balance without transactions", async () => {
  assert.equal(await accountBalance("100.00"), 100);
});

test("paid income increases the account balance", async () => {
  assert.equal(
    await accountBalance("100.00", [
      { amount: decimal("50.00"), type: "INCOME" },
    ]),
    150
  );
});

test("paid expense decreases the account balance", async () => {
  assert.equal(
    await accountBalance("100.00", [
      { amount: decimal("20.00"), type: "EXPENSE" },
    ]),
    80
  );
});

test("multiple paid incomes and expenses use decimal-safe arithmetic", async () => {
  assert.equal(
    await accountBalance("0.10", [
      { amount: decimal("0.20"), type: "INCOME" },
      { amount: decimal("0.05"), type: "EXPENSE" },
      { amount: decimal("10.15"), type: "INCOME" },
      { amount: decimal("2.40"), type: "EXPENSE" },
    ]),
    8
  );
});

test("pending transactions are excluded from the balance query", async () => {
  assert.equal(await accountBalance("100.00"), 100);
  assert.deepEqual(
    financialAccountFindMany.calls[0][0].include.transactions.where,
    { isPaid: true }
  );
});

test("account listing is isolated to the authenticated user", async () => {
  getServerSession.implementation = async () => ({ user: { id: "user-2" } });

  assert.equal(await accountBalance("25.00", [], "user-2"), 25);
  assert.deepEqual(financialAccountFindMany.calls[0][0].where, {
    userId: "user-2",
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

test("account creation maps an unknown legacy-friendly type to OTHER", async () => {
  financialAccountCreate.implementation = async ({ data }) => ({
    id: "account-1",
    ...data,
    initialBalance: decimal(data.initialBalance),
  });

  const response = await createAccount(
    jsonRequest({ name: "Cooperativa", type: "Cooperativa", balance: 10 })
  );

  assert.equal(response.status, 201);
  assert.equal(financialAccountCreate.calls[0][0].data.type, "OTHER");
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
