import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("workouts v3 preserves workout and physical-record API contracts", () => {
  const page = read("src/app/treinos/page.tsx");

  assert.match(page, /fetch\("\/api\/physical-records"\)/);
  assert.match(page, /fetch\(`\/api\/workouts\?date=\$\{selectedDate\}`\)/);
  assert.match(page, /fetch\(`\/api\/workouts\/summary\?date=\$\{selectedDate\}`\)/);
  assert.match(page, /fetch\("\/api\/workouts", \{/);
  assert.match(page, /fetch\(`\/api\/workouts\/\$\{workout\.id\}\/completion`, \{/);
});

test("workouts v3 keeps completion scoped to the selected date", () => {
  const page = read("src/app/treinos/page.tsx");

  assert.match(page, /date: selectedDate/);
  assert.match(page, /completed: !workout\.completed/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /await refreshWorkoutSummary\(\)/);
  assert.match(page, /dayForDate\(selectedDate\)/);
});

test("workouts v3 preserves physical evolution calculations", () => {
  const page = read("src/app/treinos/page.tsx");

  assert.match(page, /const latestRecord = records\[0\] \?\? null/);
  assert.match(page, /const previousRecord = records\[1\] \?\? null/);
  assert.match(page, /latestRecord\.weight - previousRecord\.weight/);
  assert.match(page, /latestRecord\.imc/);
  assert.match(page, /latestRecord\.bodyFat/);
});

test("workouts v3 consumes canonical Design System v2 tokens", () => {
  const css = read("src/app/treinos/treinos.module.css");

  for (const token of [
    "--ds-surface",
    "--ds-surface-elevated",
    "--ds-border",
    "--ds-text-primary",
    "--ds-text-secondary",
    "--ds-accent",
    "--ds-motion-fast",
    "--ds-shadow-card",
  ]) {
    assert.match(css, new RegExp(token));
  }
});

test("workouts v3 remains responsive and respects reduced motion", () => {
  const css = read("src/app/treinos/treinos.module.css");

  assert.match(css, /@media \(max-width: 1080px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
  assert.match(css, /transform: none/);
});

test("workouts v3 preserves loading, error and empty states", () => {
  const page = read("src/app/treinos/page.tsx");

  assert.match(page, /<LoadingState/);
  assert.match(page, /<ErrorState/);
  assert.match(page, /<EmptyState/);
  assert.match(page, /workoutError/);
  assert.match(page, /recordError/);
});
