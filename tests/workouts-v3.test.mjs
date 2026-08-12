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

test("workouts editorial refinement prioritizes the selected session", () => {
  const page = read("src/app/treinos/page.tsx");

  assert.match(page, /Sessão em foco/);
  assert.match(page, /const sessionUnavailable =/);
  assert.match(page, /const sessionPercent =/);
  assert.match(page, /const remainingOnDate = Math\.max/);
  assert.match(page, /const sessionNarrative =/);
  assert.match(page, /O próximo movimento ainda está em aberto/);
  assert.match(page, /A sessão planejada foi cumprida/);
  assert.match(page, /O treino já ganhou movimento/);
  assert.match(page, /Cadência recente/);
});

test("workouts editorial overview exposes execution and cadence accessibly", () => {
  const page = read("src/app/treinos/page.tsx");

  assert.match(page, /aria-labelledby="training-pulse-title"/);
  assert.match(page, /aria-label="Treinos concluídos na data selecionada"/);
  assert.match(
    page,
    /aria-valuenow=\{sessionUnavailable \? undefined : sessionPercent\}/
  );
  assert.match(page, /aria-label="Dias ativos nos últimos sete dias"/);
  assert.match(
    page,
    /aria-valuenow=\{sessionUnavailable \? undefined : summary\.activeDaysLast7\}/
  );
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
    "--ds-brand-gradient",
    "--ds-border-accent",
    "--ds-motion-base",
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
