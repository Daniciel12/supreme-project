import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/habitos/page.tsx", "utf8");
const css = fs.readFileSync("src/app/habitos/habits-v3.module.css", "utf8");

test("habits v3 preserves data and mutation endpoints", () => {
  assert.match(page, /\/api\/habits\/summary\?date=/);
  assert.match(page, /fetch\("\/api\/habits"/);
  assert.match(page, /fetch\("\/api\/checkins"/);
  assert.match(page, /body: JSON\.stringify\(\{ habitId, date: todayKey \}\)/);
});

test("habits v3 preserves summary and refresh behavior", () => {
  assert.match(page, /completedToday/);
  assert.match(page, /totalActive/);
  assert.match(page, /activeDays7/);
  assert.match(page, /await refreshSummary\(\)/);
  assert.match(page, /Math\.min\(100, Math\.max\(0,/);
});

test("habits editorial refinement prioritizes today's real rhythm", () => {
  assert.match(page, /Ritmo de hoje/);
  assert.match(page, /const todayPercent =/);
  assert.match(page, /const remainingToday = Math\.max/);
  assert.match(page, /const summaryUnavailable =/);
  assert.match(page, /Lendo o ritmo de hoje/);
  assert.match(page, /const todayNarrative =/);
  assert.match(page, /O combinado de hoje está em dia/);
  assert.match(page, /A rotina já ganhou movimento/);
  assert.match(page, /Presença recente/);
  assert.match(page, /dias com pelo menos um check-in/);
  assert.doesNotMatch(page, /sequência|streak atual/i);
});

test("habits editorial overview exposes both progress measures accessibly", () => {
  assert.match(page, /aria-labelledby="habit-rhythm-title"/);
  assert.match(page, /aria-label="Hábitos concluídos hoje"/);
  assert.match(
    page,
    /aria-valuenow=\{summaryUnavailable \? undefined : todayPercent\}/
  );
  assert.match(page, /aria-label="Dias com check-in nos últimos sete dias"/);
  assert.match(
    page,
    /aria-valuenow=\{summaryUnavailable \? undefined : summary\.activeDays7\}/
  );
});

test("habits v3 keeps legacy classes while adding isolated styles", () => {
  assert.match(page, /dashboard-grid \$\{styles\.layout\}/);
  assert.match(page, /streak-card \$\{styles\.summaryCard\}/);
  assert.match(page, /habit-list \$\{styles\.habitList\}/);
  assert.match(page, /habit-item \$\{styles\.habitItem\}/);
  assert.match(page, /habit-item-name \$\{styles\.habitName\}/);
});

test("habits v3 keeps accessible errors and responsive presentation", () => {
  assert.match(page, /role="alert"/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("habits v3 consumes semantic design-system tokens", () => {
  assert.match(css, /var\(--ds-accent\)/);
  assert.match(css, /var\(--ds-surface-elevated\)/);
  assert.match(css, /var\(--ds-text-primary\)/);
  assert.match(css, /var\(--ds-text-secondary\)/);
});
