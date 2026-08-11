import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("dashboard v3 preserves existing data and check-in contracts", () => {
  const page = read("src/app/page.tsx");

  assert.match(page, /fetch\(`\/api\/dashboard\?date=\$\{date\}`/);
  assert.match(page, /fetch\("\/api\/checkins"/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /JSON\.stringify\(\{ habitId, date: dateKey \}\)/);
  assert.match(page, /setDashboard\(\(current\) =>/);
  assert.match(page, /habitsCompleted: current\.today\.habitsCompleted \+ 1/);
});

test("dashboard v3 keeps links to every represented domain", () => {
  const page = read("src/app/page.tsx");

  for (const href of ["/habitos", "/treinos", "/metas", "/financas"]) {
    assert.match(page, new RegExp(`href=\\"${href}\\"`));
  }
});

test("dashboard v3 consumes canonical Design System v2 tokens", () => {
  const css = read("src/app/dashboard.module.css");

  for (const token of [
    "--ds-surface",
    "--ds-surface-elevated",
    "--ds-border",
    "--ds-text-primary",
    "--ds-text-secondary",
    "--ds-accent",
    "--ds-danger",
    "--ds-warning",
    "--ds-motion-fast",
    "--ds-shadow-card",
  ]) {
    assert.match(css, new RegExp(token));
  }
});

test("dashboard v3 remains responsive and respects reduced motion", () => {
  const css = read("src/app/dashboard.module.css");

  assert.match(css, /@media \(max-width: 1080px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
});

test("dashboard v3 preserves loading, error, retry and check-in feedback", () => {
  const page = read("src/app/page.tsx");

  assert.match(page, /<LoadingState/);
  assert.match(page, /<ErrorState/);
  assert.match(page, /onClick=\{retryDashboard\}/);
  assert.match(page, /checkinError/);
  assert.match(page, /isLoading=\{checkingHabitId === habit\.id\}/);
  assert.match(page, /loadingLabel="Registrando\.\.\."/);
});
