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

test("validation runs before ownership and does not replace it", () => {
  const routes = [
    {
      path: "src/app/api/checkins/route.ts",
      validation: "checkInPayloadSchema.safeParse",
      ownership: "prisma.habit.findFirst",
    },
    {
      path: "src/app/api/tasks/route.ts",
      validation: "createTaskPayloadSchema.safeParse",
      ownership: "prisma.goal.findFirst",
    },
    {
      path: "src/app/api/finances/transactions/route.ts",
      validation: "createTransactionPayloadSchema.safeParse",
      ownership: "prisma.financialAccount.findFirst",
    },
  ];

  for (const route of routes) {
    const source = read(route.path);
    const validationIndex = source.indexOf(route.validation);
    const ownershipIndex = source.indexOf(route.ownership);
    const createIndex = source.indexOf(".create(", ownershipIndex);

    assert.notEqual(validationIndex, -1, "expected validation in " + route.path);
    assert.ok(ownershipIndex > validationIndex, "ownership must follow validation in " + route.path);
    assert.ok(createIndex > ownershipIndex, "create must follow ownership in " + route.path);
    assert.match(source, /getServerSession\(authOptions\)/);
    assert.match(source.slice(ownershipIndex, createIndex), /userId:\s*session\.user\.id/);
  }
});

test("Next.js 16 proxy entrypoint is explicit and only public boundaries bypass auth", () => {
  assert.equal(existsSync(new URL("../src/middleware.ts", import.meta.url)), false);

  const source = read("src/proxy.ts");
  assert.match(source, /export function proxy/);
  assert.match(source, /api\/auth/);
  assert.match(source, /api\/health/);
  assert.match(source, /login/);
  assert.match(source, /withAuth/);
});
