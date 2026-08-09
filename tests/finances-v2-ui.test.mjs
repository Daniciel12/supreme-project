import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  filterFinanceTransactions,
  formatTransactionDate,
  localDateKey,
  summarizeTransactionsForMonth,
  transactionStatusRequest,
} from "../src/lib/finance-view.ts";

const transactions = [
  {
    id: "paid-income",
    type: "INCOME",
    amount: 100,
    date: "2026-08-02T00:00:00.000Z",
    isPaid: true,
    accountId: "account-a",
  },
  {
    id: "pending-income",
    type: "INCOME",
    amount: 40,
    date: "2026-08-03T00:00:00.000Z",
    isPaid: false,
    accountId: "account-a",
  },
  {
    id: "paid-expense",
    type: "EXPENSE",
    amount: 25,
    date: "2026-08-04T00:00:00.000Z",
    isPaid: true,
    accountId: "account-a",
  },
  {
    id: "pending-expense",
    type: "EXPENSE",
    amount: 10,
    date: "2026-08-05T00:00:00.000Z",
    isPaid: false,
    accountId: "account-b",
  },
  {
    id: "next-month-income",
    type: "INCOME",
    amount: 999,
    date: "2026-09-01T00:00:00.000Z",
    isPaid: true,
    accountId: "account-b",
  },
];

test("finances v2 monthly summary includes only paid values as realized", () => {
  assert.deepEqual(summarizeTransactionsForMonth(transactions, "2026-08"), {
    income: 100,
    expense: 25,
    pendingCount: 2,
    pendingIncome: 40,
    pendingExpense: 10,
  });
});

test("finances v2 filters paid and pending transactions", () => {
  const paid = filterFinanceTransactions(transactions, {
    status: "PAID",
    type: "ALL",
    accountId: "ALL",
  });
  const pending = filterFinanceTransactions(transactions, {
    status: "PENDING",
    type: "ALL",
    accountId: "ALL",
  });

  assert.deepEqual(
    paid.map((transaction) => transaction.id),
    ["paid-income", "paid-expense", "next-month-income"]
  );
  assert.deepEqual(
    pending.map((transaction) => transaction.id),
    ["pending-income", "pending-expense"]
  );
});

test("finances v2 filters income and expense transactions", () => {
  const income = filterFinanceTransactions(transactions, {
    status: "ALL",
    type: "INCOME",
    accountId: "ALL",
  });
  const expense = filterFinanceTransactions(transactions, {
    status: "ALL",
    type: "EXPENSE",
    accountId: "ALL",
  });

  assert.deepEqual(
    income.map((transaction) => transaction.id),
    ["paid-income", "pending-income", "next-month-income"]
  );
  assert.deepEqual(
    expense.map((transaction) => transaction.id),
    ["paid-expense", "pending-expense"]
  );
});

test("finances v2 combines status type and account filters", () => {
  const result = filterFinanceTransactions(transactions, {
    status: "PENDING",
    type: "EXPENSE",
    accountId: "account-b",
  });

  assert.deepEqual(
    result.map((transaction) => transaction.id),
    ["pending-expense"]
  );
});

test("finances v2 exposes friendly labels for every canonical account type", () => {
  assert.deepEqual(ACCOUNT_TYPES, [
    { value: "CHECKING", label: "Conta corrente" },
    { value: "SAVINGS", label: "Poupança" },
    { value: "CASH", label: "Dinheiro" },
    { value: "INVESTMENT", label: "Investimento" },
    { value: "CREDIT", label: "Crédito" },
    { value: "OTHER", label: "Outro" },
  ]);
  assert.equal(ACCOUNT_TYPE_LABELS.CHECKING, "Conta corrente");
  assert.equal(ACCOUNT_TYPE_LABELS.CREDIT, "Crédito");
});

test("finances v2 keeps selected calendar dates stable", () => {
  assert.equal(localDateKey(new Date(2026, 7, 9, 12)), "2026-08-09");
  assert.equal(formatTransactionDate("2026-08-09T00:00:00.000Z"), "09/08/2026");
});

test("finances v2 status action builds the scoped endpoint and toggled payload", () => {
  const markPaid = transactionStatusRequest({ id: "transaction-1", isPaid: false });
  const markPending = transactionStatusRequest({ id: "transaction-1", isPaid: true });

  assert.equal(markPaid.url, "/api/finances/transactions/transaction-1");
  assert.equal(markPaid.init.method, "PATCH");
  assert.deepEqual(JSON.parse(markPaid.init.body), { isPaid: true });
  assert.deepEqual(JSON.parse(markPending.init.body), { isPaid: false });
});

test("finances v2 page wires date status filters and foundation states", () => {
  const page = readFileSync(
    new URL("../src/app/financas/page.tsx", import.meta.url),
    "utf8"
  );

  for (const contract of [
    /type="date"/,
    /setTransactionStatus\("PENDING"\)/,
    /transactionStatusRequest\(transaction\)/,
    /<option value="PAID">Pagas<\/option>/,
    /Marcar como pendente/,
    /Marcar como pago/,
    /LoadingState/,
    /EmptyState/,
    /ErrorState/,
  ]) {
    assert.match(page, contract);
  }
});
