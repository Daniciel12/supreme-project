import assert from "node:assert/strict";
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
const habitFindMany = createAsyncStub();
const taskFindMany = createAsyncStub();
const goalFindMany = createAsyncStub();
const workoutFindMany = createAsyncStub();
const physicalRecordFindFirst = createAsyncStub();
const financialAccountAggregate = createAsyncStub();
const transactionAggregate = createAsyncStub();
const transactionCount = createAsyncStub();

const prisma = {
  habit: { findMany: habitFindMany },
  task: { findMany: taskFindMany },
  goal: { findMany: goalFindMany },
  workout: { findMany: workoutFindMany },
  physicalRecord: { findFirst: physicalRecordFindFirst },
  financialAccount: { aggregate: financialAccountAggregate },
  transaction: { aggregate: transactionAggregate, count: transactionCount },
};

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });

const { NextRequest } = await import("next/server");
const { GET: getDashboard } = await import("../src/app/api/dashboard/route.ts");

const USER_ID = "user-1";
const stubs = [
  getServerSession,
  habitFindMany,
  taskFindMany,
  goalFindMany,
  workoutFindMany,
  physicalRecordFindFirst,
  financialAccountAggregate,
  transactionAggregate,
  transactionCount,
];

beforeEach(() => {
  for (const stub of stubs) stub.reset();
});

function money(value) {
  return { toString: () => value };
}

function request(date = "2026-08-09") {
  return new NextRequest(`http://localhost/api/dashboard?date=${date}`);
}

function authenticate(userId = USER_ID) {
  getServerSession.implementation = async () => ({ user: { id: userId } });
}

async function bodyWithStatus(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

function assertNoDatabaseCalls() {
  for (const stub of stubs.slice(1)) {
    assert.equal(stub.calls.length, 0);
  }
}

test("dashboard returns 401 without an authenticated session", async () => {
  const response = await getDashboard(request());
  await bodyWithStatus(response, 401);
  assertNoDatabaseCalls();
});

test("dashboard rejects an invalid local date before querying Prisma", async () => {
  authenticate();
  const response = await getDashboard(request("09-08-2026"));
  await bodyWithStatus(response, 400);
  assertNoDatabaseCalls();
});

test("dashboard aggregates only the authenticated user's data", async () => {
  authenticate();
  habitFindMany.implementation = async () => [
    {
      id: "habit-1",
      name: "Ler",
      description: "20 minutos",
      checkIns: [{ id: "checkin-1" }],
    },
    {
      id: "habit-2",
      name: "Meditar",
      description: null,
      checkIns: [],
    },
  ];
  taskFindMany.implementation = async () => [
    {
      id: "task-1",
      title: "Preparar proposta",
      goal: { id: "goal-1", title: "Crescer profissionalmente" },
    },
  ];
  goalFindMany.implementation = async () => [
    {
      id: "goal-1",
      title: "Crescer profissionalmente",
      category: "Profissional",
      deadline: new Date("2026-08-10T00:00:00.000Z"),
      tasks: [{ isCompleted: true }, { isCompleted: false }],
    },
  ];
  workoutFindMany.implementation = async () => [
    { id: "workout-1", name: "Corrida", completed: false, notes: null },
  ];
  physicalRecordFindFirst.implementation = async () => ({
    id: "record-1",
    date: new Date("2026-08-08T12:00:00.000Z"),
    weight: 78.4,
    bodyFat: 15.2,
    imc: 23.4,
    shapeStatus: "Evoluindo",
  });
  financialAccountAggregate.implementation = async () => ({
    _sum: { initialBalance: money("1000.00") },
  });
  transactionAggregate.implementation = async ({ where }) => {
    const monthly = Boolean(where.date);
    if (where.type === "INCOME") {
      return { _sum: { amount: money(monthly ? "200.00" : "300.10") } };
    }
    return { _sum: { amount: money(monthly ? "40.00" : "50.05") } };
  };
  transactionCount.implementation = async () => 2;

  const response = await getDashboard(request());
  const body = await bodyWithStatus(response, 200);

  assert.equal(body.date, "2026-08-09");
  assert.equal(body.today.habitsCompleted, 1);
  assert.equal(body.today.habitsTotal, 2);
  assert.equal(body.today.habits[0].checkedToday, true);
  assert.equal(body.today.habits[1].checkedToday, false);
  assert.equal(body.today.pendingTasks[0].goal.id, "goal-1");
  assert.equal(body.today.workouts[0].name, "Corrida");
  assert.equal(body.finances.balance, 1250.05);
  assert.equal(body.finances.monthlyIncome, 200);
  assert.equal(body.finances.monthlyExpense, 40);
  assert.equal(body.finances.monthlyPendingCount, 2);
  assert.equal(body.goals[0].progress, 50);
  assert.equal(body.goals[0].isOverdue, false);
  assert.equal(body.evolution.weight, 78.4);

  assert.equal(habitFindMany.calls[0][0].where.userId, USER_ID);
  assert.equal(taskFindMany.calls[0][0].where.goal.userId, USER_ID);
  assert.equal(goalFindMany.calls[0][0].where.userId, USER_ID);
  assert.equal(workoutFindMany.calls[0][0].where.userId, USER_ID);
  assert.equal(workoutFindMany.calls[0][0].where.dayOfWeek, "DOM");
  assert.equal(physicalRecordFindFirst.calls[0][0].where.userId, USER_ID);
  assert.equal(financialAccountAggregate.calls[0][0].where.userId, USER_ID);
  for (const [args] of transactionAggregate.calls) {
    assert.equal(args.where.userId, USER_ID);
  }
  assert.equal(transactionCount.calls[0][0].where.userId, USER_ID);
});

test("dashboard returns deliberate empty states and zero financial totals", async () => {
  authenticate();
  habitFindMany.implementation = async () => [];
  taskFindMany.implementation = async () => [];
  goalFindMany.implementation = async () => [];
  workoutFindMany.implementation = async () => [];
  physicalRecordFindFirst.implementation = async () => null;
  financialAccountAggregate.implementation = async () => ({
    _sum: { initialBalance: null },
  });
  transactionAggregate.implementation = async () => ({
    _sum: { amount: null },
  });
  transactionCount.implementation = async () => 0;

  const response = await getDashboard(request("2026-08-10"));
  const body = await bodyWithStatus(response, 200);

  assert.deepEqual(body.today.habits, []);
  assert.deepEqual(body.today.pendingTasks, []);
  assert.deepEqual(body.today.workouts, []);
  assert.deepEqual(body.goals, []);
  assert.equal(body.today.habitsCompleted, 0);
  assert.equal(body.today.habitsTotal, 0);
  assert.equal(body.finances.balance, 0);
  assert.equal(body.finances.monthlyIncome, 0);
  assert.equal(body.finances.monthlyExpense, 0);
  assert.equal(body.finances.monthlyPendingCount, 0);
  assert.equal(body.evolution, null);
});
