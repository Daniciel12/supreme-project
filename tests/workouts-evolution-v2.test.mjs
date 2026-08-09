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
const workoutFindFirst = createAsyncStub();
const completionUpsert = createAsyncStub();
const completionDeleteMany = createAsyncStub();
const completionFindMany = createAsyncStub();

const prisma = {
  workout: { findFirst: workoutFindFirst },
  workoutCompletion: {
    upsert: completionUpsert,
    deleteMany: completionDeleteMany,
    findMany: completionFindMany,
  },
};

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });

const { NextRequest } = await import("next/server");
const { PATCH: updateCompletion } = await import(
  "../src/app/api/workouts/[id]/completion/route.ts"
);
const { GET: getWorkoutSummary } = await import(
  "../src/app/api/workouts/summary/route.ts"
);
const {
  createPhysicalRecordPayloadSchema,
  createWorkoutPayloadSchema,
  workoutCompletionPayloadSchema,
} = await import("../src/lib/api-validation.ts");

const USER_ID = "user-1";
const WORKOUT_ID = "cm12345678901234567890123";
const DATE = "2026-08-09";
const stubs = [
  getServerSession,
  workoutFindFirst,
  completionUpsert,
  completionDeleteMany,
  completionFindMany,
];

beforeEach(() => {
  for (const stub of stubs) stub.reset();
});

function authenticate(userId = USER_ID) {
  getServerSession.implementation = async () => ({ user: { id: userId } });
}

function patchRequest(payload, id = WORKOUT_ID) {
  return new NextRequest(`http://localhost/api/workouts/${id}/completion`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function bodyWithStatus(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

test("workout and physical record payloads are strict", () => {
  assert.equal(
    createWorkoutPayloadSchema.safeParse({
      name: "Peito",
      dayOfWeek: "seg",
      userId: "attacker",
    }).success,
    false
  );
  assert.equal(
    createWorkoutPayloadSchema.safeParse({
      name: "Peito",
      dayOfWeek: "INVALID",
    }).success,
    false
  );
  assert.deepEqual(
    createWorkoutPayloadSchema.parse({ name: "Peito", dayOfWeek: "seg" }),
    { name: "Peito", dayOfWeek: "SEG" }
  );

  assert.equal(
    createPhysicalRecordPayloadSchema.safeParse({
      weight: 80,
      height: 1.8,
      userId: "attacker",
    }).success,
    false
  );
  assert.equal(
    createPhysicalRecordPayloadSchema.safeParse({ weight: -1, height: 1.8 }).success,
    false
  );
  assert.equal(
    createPhysicalRecordPayloadSchema.safeParse({ weight: 80, height: 0.2 }).success,
    false
  );
  assert.equal(
    createPhysicalRecordPayloadSchema.safeParse({
      weight: 80,
      height: 1.8,
      bodyFat: 15.2,
      date: DATE,
    }).success,
    true
  );
});

test("workout completion payload rejects injected ownership and extra fields", () => {
  assert.equal(
    workoutCompletionPayloadSchema.safeParse({
      date: DATE,
      completed: true,
      userId: "attacker",
    }).success,
    false
  );
  assert.equal(
    workoutCompletionPayloadSchema.safeParse({ date: DATE, completed: true }).success,
    true
  );
});

test("workout completion returns 401 without a session", async () => {
  const response = await updateCompletion(
    patchRequest({ date: DATE, completed: true }),
    { params: Promise.resolve({ id: WORKOUT_ID }) }
  );
  await bodyWithStatus(response, 401);
  assert.equal(workoutFindFirst.calls.length, 0);
});

test("workout completion validates id and body before ownership lookup", async () => {
  authenticate();
  const response = await updateCompletion(
    patchRequest({ date: DATE, completed: true }, "invalid-id"),
    { params: Promise.resolve({ id: "invalid-id" }) }
  );
  await bodyWithStatus(response, 400);
  assert.equal(workoutFindFirst.calls.length, 0);
});

test("workout completion returns 404 outside ownership", async () => {
  authenticate();
  workoutFindFirst.implementation = async () => null;

  const response = await updateCompletion(
    patchRequest({ date: DATE, completed: true }),
    { params: Promise.resolve({ id: WORKOUT_ID }) }
  );
  await bodyWithStatus(response, 404);
  assert.deepEqual(workoutFindFirst.calls[0][0], {
    where: { id: WORKOUT_ID, userId: USER_ID },
    select: { id: true },
  });
  assert.equal(completionUpsert.calls.length, 0);
});

test("marking a workout completed is idempotent and session scoped", async () => {
  authenticate();
  workoutFindFirst.implementation = async () => ({ id: WORKOUT_ID });
  completionUpsert.implementation = async () => ({ id: "completion-1" });

  const response = await updateCompletion(
    patchRequest({ date: DATE, completed: true }),
    { params: Promise.resolve({ id: WORKOUT_ID }) }
  );
  const body = await bodyWithStatus(response, 200);

  assert.equal(body.completed, true);
  assert.equal(body.date, DATE);
  assert.deepEqual(completionUpsert.calls[0][0], {
    where: {
      workout_date_unique: {
        workoutId: WORKOUT_ID,
        date: new Date("2026-08-09T00:00:00.000Z"),
      },
    },
    update: { userId: USER_ID },
    create: {
      workoutId: WORKOUT_ID,
      userId: USER_ID,
      date: new Date("2026-08-09T00:00:00.000Z"),
    },
  });
});

test("unmarking a workout is idempotent and date scoped", async () => {
  authenticate();
  workoutFindFirst.implementation = async () => ({ id: WORKOUT_ID });
  completionDeleteMany.implementation = async () => ({ count: 1 });

  const response = await updateCompletion(
    patchRequest({ date: DATE, completed: false }),
    { params: Promise.resolve({ id: WORKOUT_ID }) }
  );
  const body = await bodyWithStatus(response, 200);

  assert.equal(body.completed, false);
  assert.deepEqual(completionDeleteMany.calls[0][0], {
    where: {
      workoutId: WORKOUT_ID,
      userId: USER_ID,
      date: new Date("2026-08-09T00:00:00.000Z"),
    },
  });
});

test("workout summary uses only the authenticated user's completion history", async () => {
  authenticate();
  completionFindMany.implementation = async () => [
    { date: new Date("2026-08-05T00:00:00.000Z") },
    { date: new Date("2026-08-09T00:00:00.000Z") },
    { date: new Date("2026-08-09T00:00:00.000Z") },
  ];

  const response = await getWorkoutSummary(
    new NextRequest(`http://localhost/api/workouts/summary?date=${DATE}`)
  );
  const body = await bodyWithStatus(response, 200);

  assert.equal(body.activeDaysLast7, 2);
  assert.equal(body.completionsLast7, 3);
  assert.equal(completionFindMany.calls[0][0].where.userId, USER_ID);
  assert.deepEqual(completionFindMany.calls[0][0].where.date, {
    gte: new Date("2026-08-03T00:00:00.000Z"),
    lte: new Date("2026-08-09T00:00:00.000Z"),
  });
});

test("workout history migration is additive and date unique", () => {
  const schema = readFileSync(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8"
  );
  const migration = readFileSync(
    new URL(
      "../prisma/migrations/20260809204000_workout_daily_completions/migration.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(schema, /model WorkoutCompletion/);
  assert.match(schema, /date\s+DateTime\s+@db\.Date/);
  assert.match(schema, /@@unique\(\[workoutId, date\], name: "workout_date_unique"\)/);
  assert.match(schema, /completed Boolean\s+@default\(false\)/);
  assert.match(migration, /CREATE TABLE "workout_completions"/);
  assert.match(migration, /UNIQUE INDEX "workout_completions_workoutId_date_key"/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM "workouts"/i);
});

test("workouts page uses dated completion and foundation components", () => {
  const page = readFileSync(
    new URL("../src/app/treinos/page.tsx", import.meta.url),
    "utf8"
  );
  const dashboard = readFileSync(
    new URL("../src/app/api/dashboard/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(page, /PageHeader/);
  assert.match(page, /LoadingState/);
  assert.match(page, /\/api\/workouts\?date=/);
  assert.match(page, /\/completion/);
  assert.match(page, /activeDaysLast7/);
  assert.match(page, /weightDelta/);
  assert.match(dashboard, /completions:\s*\{/);
  assert.match(dashboard, /completed:\s*completions\.length > 0/);
  assert.doesNotMatch(dashboard, /completed:\s*true,/);
});
