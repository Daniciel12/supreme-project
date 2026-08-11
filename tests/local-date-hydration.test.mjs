import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { localDateKey } from "../src/lib/local-date.ts";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("local date keys use the injected calendar date", () => {
  assert.equal(localDateKey(new Date(2026, 7, 10, 23, 59, 59)), "2026-08-10");
  assert.equal(localDateKey(new Date(2026, 7, 11, 0, 0, 0)), "2026-08-11");
});

test("local date hydration starts from a stable server snapshot", () => {
  const source = read("src/lib/local-date.ts");

  assert.match(source, /useSyncExternalStore/);
  assert.match(source, /function getServerDateSnapshot\(\) \{\s*return null;/);
  assert.match(source, /subscribeToLocalDate/);
  assert.match(source, /scheduleNextMidnight/);
});

test("date-sensitive pages defer browser-local today until hydration", () => {
  for (const page of [
    "src/app/page.tsx",
    "src/app/habitos/page.tsx",
    "src/app/metas/page.tsx",
    "src/app/treinos/page.tsx",
  ]) {
    const source = read(page);

    assert.match(source, /useLocalDateKey/);
    assert.doesNotMatch(source, /function localDateKey/);
    assert.doesNotMatch(source, /useState\([^\n]*localDateKey/);
  }
});
