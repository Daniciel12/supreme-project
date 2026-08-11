import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("finances v3 preserves financial data endpoints and summary logic", () => {
  const page = read("src/app/financas/page.tsx");

  assert.match(page, /fetch\("\/api\/finances\/accounts"\)/);
  assert.match(page, /fetch\("\/api\/finances\/transactions"\)/);
  assert.match(page, /summarizeTransactionsForMonth\(transactions, currentMonthKey\)/);
  assert.match(page, /accounts\.reduce\(\(sum, account\) => sum \+ account\.balance, 0\)/);
  assert.match(page, /filterFinanceTransactions/);
  assert.match(page, /transactionStatusRequest\(transaction\)/);
});

test("finances v3 keeps existing create flows", () => {
  const page = read("src/app/financas/page.tsx");

  assert.match(page, /handleCreateAccount/);
  assert.match(page, /handleCreateTransaction/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /isPaid: transactionStatus === "PAID"/);
});

test("finances v3 consumes canonical design tokens and remains responsive", () => {
  const css = read("src/app/financas/finances.module.css");

  for (const token of [
    "--ds-surface",
    "--ds-surface-elevated",
    "--ds-border",
    "--ds-text-primary",
    "--ds-text-secondary",
    "--ds-accent",
    "--ds-success",
    "--ds-danger",
    "--ds-motion-fast",
    "--ds-shadow-card",
  ]) {
    assert.match(css, new RegExp(token));
  }

  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
