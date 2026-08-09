import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("finances v2 separates realized metrics from pending transactions", () => {
  const page = read("src/app/financas/page.tsx");

  assert.match(page, /const paid = currentMonthTransactions\.filter/);
  assert.match(page, /transaction\.isPaid/);
  assert.match(page, /pendingIncome/);
  assert.match(page, /pendingExpense/);
  assert.match(page, /Receitas realizadas/);
  assert.match(page, /Despesas realizadas/);
  assert.match(page, /Pendências do mês/);
});

test("finances v2 transaction form captures date status and account", () => {
  const page = read("src/app/financas/page.tsx");

  assert.match(page, /type="date"/);
  assert.match(page, /transactionStatus === "PAID"/);
  assert.match(page, /<option value="PAID">Pago \/ realizado<\/option>/);
  assert.match(page, /<option value="PENDING">Pendente<\/option>/);
  assert.match(page, /accountId: selectedAccountId/);
});

test("finances v2 can settle and reopen transactions through the scoped API", () => {
  const page = read("src/app/financas/page.tsx");

  assert.match(page, /\/api\/finances\/transactions\/\$\{transaction\.id\}/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /isPaid: !transaction\.isPaid/);
  assert.match(page, /Marcar como pago/);
  assert.match(page, /Reabrir/);
});

test("finances v2 uses closed account type options and filter controls", () => {
  const page = read("src/app/financas/page.tsx");

  for (const type of [
    "CHECKING",
    "SAVINGS",
    "CASH",
    "INVESTMENT",
    "CREDIT",
    "OTHER",
  ]) {
    assert.match(page, new RegExp(type));
  }

  assert.match(page, /filter-status/);
  assert.match(page, /filter-type/);
  assert.match(page, /filter-account/);
});
