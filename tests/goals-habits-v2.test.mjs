import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, mock, test } from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier.slice(2)}.ts`, sourceRoot).href,
      };
    }

    if (specifier === "next/server") {
      return nextResolve(`${specifier}.js`, context);
    }

    return nextResolve(specifier, context);
  },
});

function createAsyncStub() {
  const stub = async (...args) => {
    stub.calls.push(args);
    return stub.implementation(...args);
  };
  stub.calls = [];
  stub.implementation = async () => null;
  stub.reset = () => {
    stub.calls = [];
    stub.implementation = async () => null;
  };
  return stub;
}

const getServerSession = createAsyncStub();
const habitCreate = createAsyncStub();
const habitFindMany = createAsyncStub();
const goalCreate = createAsyncStub();

const prisma = {
  habit: { create: habitCreate, findMany: habitFindMany },
  goal: { create: goalCreate },
};

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });

const { NextRequest } = await import("next/server");
const {
  createGoalPayloadSchema,
  createHabitPayloadSchema,
  updateTaskStatusPayloadSchema,
} = await import("../src/lib/api-validation.ts");
const { POST: createHabit } = await import("../src/app/api/habits/route.ts");
const { GET: habitSummary } = await import(
  "../src/app/api/habits/summary/route.ts"
);
const { POST: createGoal } = await import("../src/app/api/goals/route.ts");

const USER_ID = "user-1";
const stubs = [getServerSession, habitCreate, habitFindMany, goalCreate];

beforeEach(() => {
  for (const stub of stubs) stub.reset();
});

function authenticate() {
  getServerSession.implementation = async () => ({ user: { id: USER_ID } });
}

function jsonRequest(path, method, payload) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("goals and habits schemas reject client ownership and extra fields", () => {
  assert.equal(
    createHabitPayloadSchema.safeParse({ name: "Ler", userId: "attacker" }).success,
    false
  );
  assert.equal(
    createGoalPayloadSchema.safeParse({
      title: "Certificação",
      category: "Profissional",
      userId: "attacker",
    }).success,
    false
  );
  assert.equal(
    updateTaskStatusPayloadSchema.safeParse({
      isCompleted: true,
      goalId: "injected",
    }).success,
    false
  );
});

test("goal schema accepts a calendar deadline and task status is explicit", () => {
  const goal = createGoalPayloadSchema.parse({
    title: "Certificação",
    category: "Profissional",
    deadline: "2026-08-31",
  });
  assert.equal(goal.deadline, "2026-08-31");
  assert.deepEqual(updateTaskStatusPayloadSchema.parse({ isCompleted: false }), {
    isCompleted: false,
  });
  assert.equal(updateTaskStatusPayloadSchema.safeParse({}).success, false);
});

test("habit creation rejects injected userId before Prisma", async () => {
  authenticate();
  const response = await createHabit(
    jsonRequest("/api/habits", "POST", {
      name: "Treinar",
      userId: "attacker",
    })
  );

  assert.equal(response.status, 400);
  assert.equal(habitCreate.calls.length, 0);
});

test("goal creation stores deadline at stable UTC midnight for the session user", async () => {
  authenticate();
  goalCreate.implementation = async ({ data }) => ({
    id: "goal-1",
    ...data,
    isCompleted: false,
  });

  const response = await createGoal(
    jsonRequest("/api/goals", "POST", {
      title: "Certificação",
      category: "Profissional",
      deadline: "2026-08-31",
    })
  );

  assert.equal(response.status, 201);
  const createData = goalCreate.calls[0][0].data;
  assert.equal(createData.userId, USER_ID);
  assert.equal(createData.deadline.toISOString(), "2026-08-31T00:00:00.000Z");
});

test("habit summary returns 401 without a session", async () => {
  const response = await habitSummary(
    new NextRequest("http://localhost/api/habits/summary?date=2026-08-09")
  );

  assert.equal(response.status, 401);
  assert.equal(habitFindMany.calls.length, 0);
});

test("habit summary rejects an invalid date before Prisma", async () => {
  authenticate();
  const response = await habitSummary(
    new NextRequest("http://localhost/api/habits/summary?date=09-08-2026")
  );

  assert.equal(response.status, 400);
  assert.equal(habitFindMany.calls.length, 0);
});

test("habit summary restores today's check-ins and recent active days", async () => {
  authenticate();
  habitFindMany.implementation = async () => [
    {
      id: "habit-1",
      name: "Ler",
      description: null,
      icon: null,
      color: null,
      active: true,
      checkIns: [
        { date: new Date("2026-08-09T00:00:00.000Z") },
        { date: new Date("2026-08-07T00:00:00.000Z") },
      ],
    },
    {
      id: "habit-2",
      name: "Treinar",
      description: null,
      icon: null,
      color: null,
      active: true,
      checkIns: [{ date: new Date("2026-08-08T00:00:00.000Z") }],
    },
  ];

  const response = await habitSummary(
    new NextRequest("http://localhost/api/habits/summary?date=2026-08-09")
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(
    body.habits.map((habit) => [habit.id, habit.checkedToday]),
    [
      ["habit-1", true],
      ["habit-2", false],
    ]
  );
  assert.deepEqual(body.summary, {
    completedToday: 1,
    totalActive: 2,
    activeDays7: 3,
  });
  assert.deepEqual(habitFindMany.calls[0][0].where, {
    userId: USER_ID,
    active: true,
  });
  const dateFilter = habitFindMany.calls[0][0].select.checkIns.where.date;
  assert.equal(dateFilter.gte.toISOString(), "2026-08-03T00:00:00.000Z");
  assert.equal(dateFilter.lte.toISOString(), "2026-08-09T00:00:00.000Z");
});

test("habits and goals pages use real daily state and shared foundation", () => {
  const habitsPage = readFileSync(
    new URL("../src/app/habitos/page.tsx", import.meta.url),
    "utf8"
  );
  const goalsPage = readFileSync(
    new URL("../src/app/metas/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(habitsPage, /\/api\/habits\/summary\?date=/);
  assert.match(habitsPage, /body: JSON\.stringify\(\{ habitId, date: todayKey \}\)/);
  assert.doesNotMatch(habitsPage, /const streak = 1/);
  assert.match(habitsPage, /activeDays7/);

  for (const contract of [
    /PageHeader/,
    /LoadingState/,
    /EmptyState/,
    /ErrorState/,
    /type="date"/,
    /JSON\.stringify\(\{ isCompleted: nextCompleted \}\)/,
    /Vencida em/,
  ]) {
    assert.match(goalsPage, contract);
  }

  assert.doesNotMatch(goalsPage, /Fontes de conhecimento|\/api\/books/);
});
