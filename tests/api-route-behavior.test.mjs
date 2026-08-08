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
const bcryptHash = createAsyncStub();
const userFindUnique = createAsyncStub();
const userCreate = createAsyncStub();
const habitFindFirst = createAsyncStub();
const checkInCreate = createAsyncStub();
const goalFindFirst = createAsyncStub();
const taskCreate = createAsyncStub();
const taskFindFirst = createAsyncStub();
const taskUpdate = createAsyncStub();
const financialAccountFindFirst = createAsyncStub();
const transactionCreate = createAsyncStub();

const prisma = {
  user: { findUnique: userFindUnique, create: userCreate },
  habit: { findFirst: habitFindFirst },
  checkIn: { create: checkInCreate },
  goal: { findFirst: goalFindFirst },
  task: { create: taskCreate, findFirst: taskFindFirst, update: taskUpdate },
  financialAccount: { findFirst: financialAccountFindFirst },
  transaction: { create: transactionCreate },
};

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });
mock.module("bcrypt", { defaultExport: { hash: bcryptHash } });

const { NextRequest } = await import("next/server");
const { POST: register } = await import(
  "../src/app/api/auth/register/route.ts"
);
const { POST: createCheckIn } = await import(
  "../src/app/api/checkins/route.ts"
);
const { POST: createTask } = await import("../src/app/api/tasks/route.ts");
const { PATCH: updateTask } = await import(
  "../src/app/api/tasks/[id]/route.ts"
);
const { POST: createTransaction } = await import(
  "../src/app/api/finances/transactions/route.ts"
);

const USER_ID = "user-1";
const HABIT_ID = "cm12345678901234567890123";
const GOAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const TASK_ID = "e7b4181f-4f80-4936-a77b-8146a8c1652d";
const ACCOUNT_ID = "a53bd3f0-bdf0-4f86-9a48-3cbfdf915277";
const stubs = [
  getServerSession,
  bcryptHash,
  userFindUnique,
  userCreate,
  habitFindFirst,
  checkInCreate,
  goalFindFirst,
  taskCreate,
  taskFindFirst,
  taskUpdate,
  financialAccountFindFirst,
  transactionCreate,
];

beforeEach(() => {
  for (const stub of stubs) stub.reset();
  bcryptHash.implementation = async () => "hashed-password";
});

function authenticate(userId = USER_ID) {
  getServerSession.implementation = async () => ({ user: { id: userId } });
}

function jsonRequest(path, method, payload) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function malformedJsonRequest(path) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
}

async function responseBody(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

async function assertGenericError(response, status) {
  const body = await responseBody(response, status);
  assert.equal(typeof body.error, "string");
  assert.doesNotMatch(
    JSON.stringify(body),
    /Zod|Prisma|stack|issues|connection secret/i
  );
  return body;
}

test("registration returns 400 for malformed JSON", async () => {
  const response = await register(malformedJsonRequest("/api/auth/register"));
  await assertGenericError(response, 400);
  assert.equal(userFindUnique.calls.length, 0);
  assert.equal(userCreate.calls.length, 0);
});

test("registration returns 400 for an invalid email before Prisma", async () => {
  const response = await register(
    jsonRequest("/api/auth/register", "POST", {
      email: "invalid-email",
      password: "valid-password",
    })
  );
  await assertGenericError(response, 400);
  assert.equal(userFindUnique.calls.length, 0);
  assert.equal(userCreate.calls.length, 0);
});

test("registration returns 400 for a password over 72 UTF-8 bytes", async () => {
  const response = await register(
    jsonRequest("/api/auth/register", "POST", {
      email: "daniel@example.com",
      password: "á".repeat(37),
    })
  );
  await assertGenericError(response, 400);
  assert.equal(userFindUnique.calls.length, 0);
  assert.equal(userCreate.calls.length, 0);
});

test("registration valid payload reaches bcrypt and user creation", async () => {
  userCreate.implementation = async ({ data }) => ({
    id: USER_ID,
    email: data.email,
    name: data.name,
  });
  const response = await register(
    jsonRequest("/api/auth/register", "POST", {
      email: "daniel@example.com",
      password: "valid-password",
      name: "Daniel",
    })
  );
  const body = await responseBody(response, 201);
  assert.deepEqual(bcryptHash.calls[0], ["valid-password", 10]);
  assert.deepEqual(userCreate.calls[0][0], {
    data: {
      email: "daniel@example.com",
      password: "hashed-password",
      name: "Daniel",
    },
  });
  assert.deepEqual(body, {
    id: USER_ID,
    email: "daniel@example.com",
    name: "Daniel",
  });
  assert.equal("password" in body, false);
});

test("registration hides internal Prisma errors", async (t) => {
  t.mock.method(console, "error", () => {});
  userFindUnique.implementation = async () => {
    throw new Error("Prisma connection secret");
  };
  const response = await register(
    jsonRequest("/api/auth/register", "POST", {
      email: "daniel@example.com",
      password: "valid-password",
    })
  );
  await assertGenericError(response, 500);
  assert.equal(userCreate.calls.length, 0);
});

test("check-in returns 401 without a session", async () => {
  const response = await createCheckIn(
    jsonRequest("/api/checkins", "POST", { habitId: HABIT_ID })
  );
  await responseBody(response, 401);
  assert.equal(habitFindFirst.calls.length, 0);
  assert.equal(checkInCreate.calls.length, 0);
});

test("check-in rejects an invalid habitId before ownership query", async () => {
  authenticate();
  const response = await createCheckIn(
    jsonRequest("/api/checkins", "POST", { habitId: "not-a-cuid" })
  );
  await assertGenericError(response, 400);
  assert.equal(habitFindFirst.calls.length, 0);
  assert.equal(checkInCreate.calls.length, 0);
});

test("check-in returns 404 when the habit is not owned", async () => {
  authenticate();
  const response = await createCheckIn(
    jsonRequest("/api/checkins", "POST", { habitId: HABIT_ID })
  );
  await responseBody(response, 404);
  assert.deepEqual(habitFindFirst.calls[0][0], {
    where: { id: HABIT_ID, userId: USER_ID },
    select: { id: true },
  });
  assert.equal(checkInCreate.calls.length, 0);
});

test("check-in valid payload uses the authenticated user", async () => {
  authenticate();
  habitFindFirst.implementation = async () => ({ id: HABIT_ID });
  checkInCreate.implementation = async ({ data }) => ({
    id: "check-in-1",
    ...data,
  });
  const response = await createCheckIn(
    jsonRequest("/api/checkins", "POST", {
      habitId: HABIT_ID,
      date: "2026-08-08",
      note: "Concluído",
    })
  );
  const body = await responseBody(response, 201);
  const createData = checkInCreate.calls[0][0].data;
  assert.equal(createData.userId, USER_ID);
  assert.equal(createData.habitId, HABIT_ID);
  assert.equal(createData.note, "Concluído");
  assert.equal(createData.date.toISOString(), "2026-08-08T00:00:00.000Z");
  assert.equal(body.userId, USER_ID);
});

test("task creation returns 401 without a session", async () => {
  const response = await createTask(
    jsonRequest("/api/tasks", "POST", { title: "Planejar", goalId: GOAL_ID })
  );
  await responseBody(response, 401);
  assert.equal(goalFindFirst.calls.length, 0);
  assert.equal(taskCreate.calls.length, 0);
});

test("task creation rejects invalid goalId before Prisma", async () => {
  authenticate();
  const response = await createTask(
    jsonRequest("/api/tasks", "POST", {
      title: "Planejar",
      goalId: "not-a-uuid",
    })
  );
  await assertGenericError(response, 400);
  assert.equal(goalFindFirst.calls.length, 0);
  assert.equal(taskCreate.calls.length, 0);
});

test("task creation returns 404 when the goal is not owned", async () => {
  authenticate();
  const response = await createTask(
    jsonRequest("/api/tasks", "POST", { title: "Planejar", goalId: GOAL_ID })
  );
  await responseBody(response, 404);
  assert.deepEqual(goalFindFirst.calls[0][0], {
    where: { id: GOAL_ID, userId: USER_ID },
  });
  assert.equal(taskCreate.calls.length, 0);
});

test("task creation links only an owned goal", async () => {
  authenticate();
  goalFindFirst.implementation = async () => ({ id: GOAL_ID, userId: USER_ID });
  taskCreate.implementation = async ({ data }) => ({ id: TASK_ID, ...data });
  const response = await createTask(
    jsonRequest("/api/tasks", "POST", { title: "Planejar", goalId: GOAL_ID })
  );
  const body = await responseBody(response, 201);
  assert.deepEqual(goalFindFirst.calls[0][0], {
    where: { id: GOAL_ID, userId: USER_ID },
  });
  assert.deepEqual(taskCreate.calls[0][0], {
    data: { title: "Planejar", goalId: GOAL_ID },
  });
  assert.equal(body.id, TASK_ID);
});

function taskPatchRequest(id = TASK_ID) {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    method: "PATCH",
  });
}

test("task update returns 401 without a session", async () => {
  const response = await updateTask(taskPatchRequest(), {
    params: Promise.resolve({ id: TASK_ID }),
  });
  await responseBody(response, 401);
  assert.equal(taskFindFirst.calls.length, 0);
  assert.equal(taskUpdate.calls.length, 0);
});

test("task update rejects an invalid id before Prisma", async () => {
  authenticate();
  const response = await updateTask(taskPatchRequest("not-a-uuid"), {
    params: Promise.resolve({ id: "not-a-uuid" }),
  });
  await assertGenericError(response, 400);
  assert.equal(taskFindFirst.calls.length, 0);
  assert.equal(taskUpdate.calls.length, 0);
});

test("task update returns 404 outside ownership", async () => {
  authenticate();
  const response = await updateTask(taskPatchRequest(), {
    params: Promise.resolve({ id: TASK_ID }),
  });
  await responseBody(response, 404);
  assert.deepEqual(taskFindFirst.calls[0][0], {
    where: { id: TASK_ID, goal: { userId: USER_ID } },
  });
  assert.equal(taskUpdate.calls.length, 0);
});

test("task update changes only a task owned by the session user", async () => {
  authenticate();
  taskFindFirst.implementation = async () => ({
    id: TASK_ID,
    isCompleted: false,
  });
  taskUpdate.implementation = async ({ data }) => ({
    id: TASK_ID,
    isCompleted: data.isCompleted,
  });
  const response = await updateTask(taskPatchRequest(), {
    params: Promise.resolve({ id: TASK_ID }),
  });
  const body = await responseBody(response, 200);
  assert.deepEqual(taskFindFirst.calls[0][0], {
    where: { id: TASK_ID, goal: { userId: USER_ID } },
  });
  assert.deepEqual(taskUpdate.calls[0][0], {
    where: { id: TASK_ID },
    data: { isCompleted: true },
  });
  assert.equal(body.isCompleted, true);
});

function validTransaction(overrides = {}) {
  return {
    accountId: ACCOUNT_ID,
    title: "Mercado",
    type: "expense",
    amount: 42.5,
    ...overrides,
  };
}

test("transaction creation returns 401 without a session", async () => {
  const response = await createTransaction(
    jsonRequest("/api/finances/transactions", "POST", validTransaction())
  );
  await responseBody(response, 401);
  assert.equal(financialAccountFindFirst.calls.length, 0);
  assert.equal(transactionCreate.calls.length, 0);
});

test("transaction rejects invalid payload before ownership and create", async () => {
  authenticate();
  const response = await createTransaction(
    jsonRequest(
      "/api/finances/transactions",
      "POST",
      validTransaction({ amount: "42.50" })
    )
  );
  await assertGenericError(response, 400);
  assert.equal(financialAccountFindFirst.calls.length, 0);
  assert.equal(transactionCreate.calls.length, 0);
});

test("transaction returns 404 when the account is not owned", async () => {
  authenticate();
  const response = await createTransaction(
    jsonRequest("/api/finances/transactions", "POST", validTransaction())
  );
  await responseBody(response, 404);
  assert.deepEqual(financialAccountFindFirst.calls[0][0], {
    where: { id: ACCOUNT_ID, userId: USER_ID },
  });
  assert.equal(transactionCreate.calls.length, 0);
});

test("transaction rejects a client-injected userId", async () => {
  authenticate();
  const response = await createTransaction(
    jsonRequest(
      "/api/finances/transactions",
      "POST",
      validTransaction({ userId: "attacker" })
    )
  );
  await assertGenericError(response, 400);
  assert.equal(financialAccountFindFirst.calls.length, 0);
  assert.equal(transactionCreate.calls.length, 0);
});

test("transaction valid payload uses the authenticated user", async () => {
  authenticate();
  financialAccountFindFirst.implementation = async () => ({
    id: ACCOUNT_ID,
    userId: USER_ID,
  });
  transactionCreate.implementation = async ({ data }) => ({
    id: "transaction-1",
    ...data,
  });
  const response = await createTransaction(
    jsonRequest(
      "/api/finances/transactions",
      "POST",
      validTransaction({ date: "2026-08-08", isPaid: true })
    )
  );
  const body = await responseBody(response, 201);
  const createData = transactionCreate.calls[0][0].data;
  assert.deepEqual(financialAccountFindFirst.calls[0][0], {
    where: { id: ACCOUNT_ID, userId: USER_ID },
  });
  assert.equal(createData.userId, USER_ID);
  assert.equal(createData.accountId, ACCOUNT_ID);
  assert.equal(createData.type, "EXPENSE");
  assert.equal(createData.amount, 42.5);
  assert.equal(createData.date.toISOString(), "2026-08-08T00:00:00.000Z");
  assert.equal(createData.isPaid, true);
  assert.equal(body.userId, USER_ID);
});

test("transaction hides internal errors", async (t) => {
  t.mock.method(console, "error", () => {});
  authenticate();
  financialAccountFindFirst.implementation = async () => {
    throw new Error("Prisma connection secret");
  };
  const response = await createTransaction(
    jsonRequest("/api/finances/transactions", "POST", validTransaction())
  );
  await assertGenericError(response, 500);
  assert.equal(transactionCreate.calls.length, 0);
});
