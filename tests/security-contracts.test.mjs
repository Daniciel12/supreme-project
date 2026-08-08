import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("check-in creation verifies parent habit ownership before create", () => {
  const source = read("src/app/api/checkins/route.ts");
  const ownershipIndex = source.indexOf("prisma.habit.findFirst");
  const createIndex = source.indexOf("prisma.checkIn.create");

  assert.notEqual(ownershipIndex, -1, "expected Habit ownership lookup");
  assert.ok(createIndex > ownershipIndex, "ownership check must happen before CheckIn creation");

  const authorizationBlock = source.slice(ownershipIndex, createIndex);
  assert.match(authorizationBlock, /id:\s*habitId/);
  assert.match(authorizationBlock, /userId:\s*session\.user\.id/);
  assert.match(authorizationBlock, /status:\s*404/);
});

test("Next.js 16 proxy entrypoint is explicit and old middleware entrypoint is absent", () => {
  assert.equal(existsSync(new URL("../src/middleware.ts", import.meta.url)), false);

  const source = read("src/proxy.ts");
  assert.match(source, /export function proxy/);
  assert.match(source, /api\/auth\|login/);
  assert.match(source, /withAuth/);
});
