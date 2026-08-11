import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/metas/page.tsx", "utf8");
const css = fs.readFileSync("src/app/metas/goals-v3.module.css", "utf8");

test("goals v3 preserves goal and task endpoints", () => {
  assert.match(page, /fetch\("\/api\/goals"/);
  assert.match(page, /fetch\("\/api\/tasks"/);
  assert.match(page, /fetch\(`\/api\/tasks\/\$\{task\.id\}`/);
  assert.match(page, /method: "PATCH"/);
});

test("goals v3 preserves progress and deadline semantics", () => {
  assert.match(page, /Math\.round\(\(completedTasks \/ totalTasks\) \* 100\)/);
  assert.match(page, /deadlineKey < todayKey/);
  assert.match(page, /deadlineKey === todayKey/);
  assert.match(page, /progress \?\? 0/);
});

test("goals v3 keeps optimistic task update and rollback", () => {
  assert.match(page, /const nextCompleted = !task\.isCompleted/);
  assert.match(page, /isCompleted: nextCompleted/);
  assert.match(page, /isCompleted: task\.isCompleted/);
});

test("goals v3 preserves legacy goal classes while adding isolated styles", () => {
  assert.match(page, /goal-category-block \$\{styles\.categoryBlock\}/);
  assert.match(page, /goal-card \$\{styles\.goalCard\}/);
  assert.match(page, /goal-card-header \$\{styles\.goalHeader\}/);
  assert.match(page, /progress-bar-track \$\{styles\.progressTrack\}/);
  assert.match(page, /goal-task-add \$\{styles\.taskAdd\}/);
});

test("goals v3 remains accessible and responsive", () => {
  assert.match(page, /role="alert"/);
  assert.match(page, /aria-label=\{`\$\{task\.isCompleted \? "Reabrir" : "Concluir"\} tarefa \$\{task\.title\}`\}/);
  assert.match(css, /@media \(max-width: 1040px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("goals v3 consumes semantic design-system tokens", () => {
  assert.match(css, /var\(--ds-accent\)/);
  assert.match(css, /var\(--ds-surface-elevated\)/);
  assert.match(css, /var\(--ds-text-primary\)/);
  assert.match(css, /var\(--ds-text-secondary\)/);
});
