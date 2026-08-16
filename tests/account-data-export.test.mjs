import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);
process.env.NEXTAUTH_URL = "https://supreme.example";

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

const getServerSession = mock.fn();
const userFindUnique = mock.fn();

mock.module("server-only", { defaultExport: {} });
mock.module(new URL("../src/lib/auth.ts", import.meta.url), {
  namedExports: { authOptions: {} },
});
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma: { user: { findUnique: userFindUnique } } },
});
mock.module("next-auth/next", { namedExports: { getServerSession } });

const { NextRequest } = await import("next/server");
const { POST } = await import("../src/app/api/account/export/route.ts");

function request(client = "203.0.113.10") {
  return new NextRequest("https://supreme.example/api/account/export", {
    method: "POST",
    headers: { "x-forwarded-for": client },
  });
}

function decimal(value) {
  return {
    toFixed(places) {
      return Number(value).toFixed(places);
    },
  };
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== "object") return keys;

  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

function sampleUser(id = "owner-user") {
  const createdAt = new Date("2026-01-02T03:04:05.000Z");
  const updatedAt = new Date("2026-02-03T04:05:06.000Z");

  return {
    id,
    name: "Conta proprietária",
    email: "owner@example.test",
    emailVerified: new Date("2026-01-03T00:00:00.000Z"),
    image: "https://cdn.example.test/profile.png",
    createdAt,
    updatedAt,
    habits: [
      {
        id: "habit-1",
        name: "Ler",
        description: "Leitura diária",
        icon: "book",
        color: "blue",
        active: true,
        createdAt,
        updatedAt,
        checkIns: [
          {
            id: "checkin-1",
            date: new Date("2026-02-10T00:00:00.000Z"),
            completed: true,
            note: "Concluído",
            createdAt,
          },
        ],
      },
    ],
    goals: [
      {
        id: "goal-1",
        title: "Meta",
        category: "Pessoal",
        isCompleted: false,
        deadline: new Date("2026-12-31T00:00:00.000Z"),
        tasks: [
          {
            id: "task-1",
            title: "Primeiro passo",
            isCompleted: true,
            createdAt,
          },
        ],
      },
    ],
    workouts: [
      {
        id: "workout-1",
        name: "Treino A",
        dayOfWeek: 1,
        completed: true,
        notes: "Leve",
        createdAt,
        updatedAt,
        completions: [
          {
            id: "completion-1",
            date: new Date("2026-02-11T00:00:00.000Z"),
            createdAt,
          },
        ],
      },
    ],
    physicalRecords: [
      {
        id: "physical-1",
        date: new Date("2026-02-12T00:00:00.000Z"),
        weight: 80.5,
        height: 180,
        bodyFat: 15.2,
        imc: 24.85,
        shapeStatus: "Em evolução",
        photoUrl: "https://cdn.example.test/physical.png",
        notes: "Registro",
        createdAt,
      },
    ],
    financialAccounts: [
      {
        id: "financial-account-1",
        name: "Conta principal",
        type: "CHECKING",
        initialBalance: decimal("100"),
        transactions: [
          {
            id: "transaction-1",
            title: "Compra",
            type: "EXPENSE",
            amount: decimal("12.3"),
            date: new Date("2026-02-13T00:00:00.000Z"),
            isPaid: true,
          },
        ],
      },
    ],
    books: [
      {
        id: "book-1",
        title: "Livro",
        author: "Autoria",
        totalPages: 300,
        readPages: 120,
      },
    ],
    visionImages: [
      {
        id: "vision-1",
        imageUrl: "https://cdn.example.test/vision.png",
        createdAt,
      },
    ],
  };
}

test("account export requires an authenticated session", async () => {
  const baselineQueries = userFindUnique.mock.callCount();
  getServerSession.mock.mockImplementation(async () => null);

  const response = await POST(request());

  assert.equal(response.status, 401);
  assert.equal(userFindUnique.mock.callCount(), baselineQueries);
  assert.deepEqual(await response.json(), { error: "Não autenticado." });
});

test("account export selects and returns only the session user's product data", async () => {
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "owner-user" },
  }));
  userFindUnique.mock.mockImplementation(async () => sampleUser());

  const response = await POST(request("203.0.113.11"));
  const query = userFindUnique.mock.calls.at(-1).arguments[0];
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(query.where, { id: "owner-user" });
  const selectedKeys = collectKeys(query.select);
  for (const forbiddenKey of [
    "password",
    "sessionsValidAfter",
    "accounts",
    "sessions",
    "token",
    "access_token",
    "refresh_token",
  ]) {
    assert.equal(selectedKeys.has(forbiddenKey), false);
  }

  for (const relation of [
    query.select.habits,
    query.select.goals,
    query.select.workouts,
    query.select.physicalRecords,
    query.select.financialAccounts,
    query.select.books,
    query.select.visionImages,
  ]) {
    assert.deepEqual(relation.where, { userId: "owner-user" });
  }
  assert.deepEqual(query.select.habits.select.checkIns.where, {
    userId: "owner-user",
  });
  assert.deepEqual(query.select.workouts.select.completions.where, {
    userId: "owner-user",
  });
  assert.deepEqual(query.select.financialAccounts.select.transactions.where, {
    userId: "owner-user",
  });

  assert.equal(payload.format, "supreme-account-export");
  assert.equal(payload.version, 1);
  assert.equal(payload.account.id, "owner-user");
  assert.equal(payload.account.createdAt, "2026-01-02T03:04:05.000Z");
  assert.equal(payload.data.financialAccounts[0].initialBalance, "100.00");
  assert.equal(
    payload.data.financialAccounts[0].transactions[0].amount,
    "12.30"
  );
  assert.equal(payload.data.visionImages[0].imageUrl, "https://cdn.example.test/vision.png");

  assert.match(
    response.headers.get("content-disposition") ?? "",
    /^attachment; filename="supreme-export-\d{4}-\d{2}-\d{2}\.json"$/
  );
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, noarchive");
  assert.equal(response.headers.get("ratelimit-limit"), "3");

  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    "stored-password-hash",
    "oauth-secret",
    "session-secret",
    "verification-secret",
    "recovery-secret",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test("account export does not expose internal failures", async () => {
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "failing-user" },
  }));
  userFindUnique.mock.mockImplementation(async () => {
    throw new Error("database-secret-detail");
  });

  const response = await POST(request("203.0.113.12"));
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, {
    error: "Não foi possível exportar seus dados agora.",
  });
  assert.doesNotMatch(JSON.stringify(body), /database-secret-detail/);
});

test("account export enforces three downloads per hour", async () => {
  getServerSession.mock.mockImplementation(async () => ({
    user: { id: "limited-user" },
  }));
  userFindUnique.mock.mockImplementation(async () => sampleUser("limited-user"));

  const responses = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    responses.push(await POST(request("203.0.113.13")));
  }

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200, 200, 429]
  );
  assert.equal(responses[3].headers.get("ratelimit-limit"), "3");
  assert.equal(responses[3].headers.get("retry-after") !== null, true);
});
