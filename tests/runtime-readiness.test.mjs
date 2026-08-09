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

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function createAsyncStub() {
  const stub = async (...args) => {
    stub.calls.push(args);
    return stub.implementation(...args);
  };
  stub.calls = [];
  stub.implementation = async () => [{ value: 1 }];
  stub.reset = () => {
    stub.calls = [];
    stub.implementation = async () => [{ value: 1 }];
  };
  return stub;
}

const queryRaw = createAsyncStub();

mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma: { $queryRaw: queryRaw } },
});

const { validateRuntimeEnvironment } = await import(
  "../src/lib/runtime-environment.ts"
);
const { GET: live } = await import("../src/app/api/health/live/route.ts");
const { GET: ready } = await import("../src/app/api/health/ready/route.ts");

const runtimeKeys = [
  "DATABASE_URL",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "UPLOADTHING_TOKEN",
];
const originalEnvironment = Object.fromEntries(
  runtimeKeys.map((key) => [key, process.env[key]])
);

function setRuntimeEnvironment(overrides = {}) {
  const values = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/supreme",
    NEXTAUTH_URL: "https://supreme.example.com",
    NEXTAUTH_SECRET: "a-strong-runtime-secret-with-more-than-32-chars",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    UPLOADTHING_TOKEN: "uploadthing-token",
    ...overrides,
  };

  for (const key of runtimeKeys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  queryRaw.reset();
  setRuntimeEnvironment();
});

process.on("exit", () => {
  for (const key of runtimeKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("runtime environment requires production-critical values", () => {
  assert.deepEqual(validateRuntimeEnvironment({}), { ready: false });
  assert.deepEqual(
    validateRuntimeEnvironment({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/supreme",
      NEXTAUTH_URL: "https://supreme.example.com",
      NEXTAUTH_SECRET: "a-strong-runtime-secret-with-more-than-32-chars",
      UPLOADTHING_TOKEN: "uploadthing-token",
    }),
    { ready: true }
  );
});

test("runtime environment requires Google OAuth credentials as a pair", () => {
  const base = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/supreme",
    NEXTAUTH_URL: "https://supreme.example.com",
    NEXTAUTH_SECRET: "a-strong-runtime-secret-with-more-than-32-chars",
    UPLOADTHING_TOKEN: "uploadthing-token",
  };

  assert.deepEqual(
    validateRuntimeEnvironment({ ...base, GOOGLE_CLIENT_ID: "google-id" }),
    { ready: false }
  );
  assert.deepEqual(
    validateRuntimeEnvironment({
      ...base,
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
    }),
    { ready: true }
  );
});

test("liveness endpoint is public-safe and non-cacheable", async () => {
  const response = await live();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("readiness returns 503 before touching Prisma when config is invalid", async () => {
  setRuntimeEnvironment({ NEXTAUTH_SECRET: undefined });
  const response = await ready();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "not_ready" });
  assert.equal(queryRaw.calls.length, 0);
});

test("readiness returns 200 only when configuration and PostgreSQL are ready", async () => {
  const response = await ready();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ready" });
  assert.equal(queryRaw.calls.length, 1);
});

test("readiness hides database failure details", async (t) => {
  t.mock.method(console, "error", () => {});
  queryRaw.implementation = async () => {
    throw new Error("postgresql://secret-user:secret-password@private-host/db");
  };

  const response = await ready();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.deepEqual(body, { status: "not_ready" });
  assert.doesNotMatch(JSON.stringify(body), /secret|postgres|private-host/i);
});

test("proxy and Next config expose health while keeping standalone output", () => {
  const proxy = read("src/proxy.ts");
  const config = read("next.config.ts");

  assert.match(proxy, /api\/health/);
  assert.match(config, /output: "standalone"/);
});

test("Docker runtime is non-root, OpenSSL-ready and health-checks readiness", () => {
  const dockerfile = read("Dockerfile");
  const dockerignore = read(".dockerignore");

  assert.match(dockerfile, /apt-get install[^\n]*ca-certificates openssl/);
  assert.match(dockerfile, /FROM base AS runner/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /api\/health\/ready/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.match(dockerfile, /AS migrator/);
  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^node_modules$/m);
});
