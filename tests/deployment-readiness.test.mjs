import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { once } from "node:events";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function startSmokeServer() {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const cookie = request.headers.cookie ?? "";
    const authenticated = cookie.includes("smoke-session=valid");

    if (url.pathname === "/api/health") {
      json(response, 200, { status: "ok" });
      return;
    }

    if (url.pathname === "/api/auth/csrf") {
      json(
        response,
        200,
        { csrfToken: "smoke-csrf" },
        { "set-cookie": "smoke-csrf-cookie=valid; Path=/; HttpOnly" }
      );
      return;
    }

    if (url.pathname === "/api/auth/callback/credentials") {
      let body = "";
      for await (const chunk of request) body += chunk;

      if (
        !body.includes("csrfToken=smoke-csrf") ||
        !body.includes("email=smoke%40example.com") ||
        !body.includes("password=top-secret-smoke-password")
      ) {
        json(response, 401, { error: "invalid" });
        return;
      }

      json(
        response,
        200,
        { url: "/" },
        { "set-cookie": "smoke-session=valid; Path=/; HttpOnly" }
      );
      return;
    }

    if (url.pathname === "/api/auth/session") {
      json(
        response,
        200,
        authenticated ? { user: { id: "smoke-user" } } : { user: null }
      );
      return;
    }

    if (!authenticated) {
      response.writeHead(307, { location: "/login" });
      response.end();
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      json(response, 200, { ok: true });
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Supreme smoke</title>");
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function runSmoke(environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/smoke.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("health route is public, database-backed and deliberately generic", () => {
  const health = read("src/app/api/health/route.ts");
  const proxy = read("src/proxy.ts");

  assert.match(health, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(health, /status: "ok"/);
  assert.match(health, /status: "unavailable"/);
  assert.match(health, /status: 503/);
  assert.doesNotMatch(health, /DATABASE_URL|error\.message|stack/);

  assert.match(proxy, /api\/health/);
});

test("authenticated smoke harness exercises the real session shape without leaking credentials", async (t) => {
  const { server, baseUrl } = await startSmokeServer();
  t.after(() => server.close());

  const secret = "top-secret-smoke-password";
  const result = await runSmoke({
    BASE_URL: baseUrl,
    SMOKE_EMAIL: "smoke@example.com",
    SMOKE_PASSWORD: secret,
    SMOKE_DATE: "2026-08-09",
  });

  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Health check passed/);
  assert.match(result.stdout, /Credentials authentication passed/);
  assert.match(result.stdout, /7 authenticated pages passed/);
  assert.match(result.stdout, /11 authenticated API checks passed/);
  assert.match(result.stdout, /\[smoke\] PASS/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(secret));
});

test("smoke harness fails closed when required operator credentials are absent", async () => {
  const result = await runSmoke({
    BASE_URL: "http://127.0.0.1:1",
    SMOKE_EMAIL: "",
    SMOKE_PASSWORD: "",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /SMOKE_EMAIL|SMOKE_PASSWORD/);
});

test("Docker baseline keeps migrations separate and runtime non-root", () => {
  const dockerfile = read("Dockerfile");
  const compose = read("compose.production.example.yml");
  const nextConfig = read("next.config.ts");
  const workflow = read(".github/workflows/docker.yml");
  const dockerignore = read(".dockerignore");

  assert.match(nextConfig, /output: "standalone"/);
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS base/);
  assert.match(dockerfile, /FROM base AS migrator/);
  assert.match(dockerfile, /FROM base AS runner/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/api\/health/);
  assert.match(dockerfile, /ENTRYPOINT \["\.\/node_modules\/\.bin\/prisma"\]/);
  assert.match(dockerfile, /CMD \["migrate", "deploy"\]/);
  assert.doesNotMatch(dockerfile, /COPY .*\.env\.production/);

  assert.match(compose, /127\.0\.0\.1:3000:3000/);
  assert.match(compose, /profiles:[\s\S]*- ops/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /cap_drop:[\s\S]*- ALL/);

  assert.match(workflow, /permissions:[\s\S]*contents: read/);
  assert.match(workflow, /docker build --target migrator/);
  assert.match(workflow, /docker build --target runner/);
  assert.match(workflow, /Run authenticated smoke test/);
  assert.match(workflow, /npm run smoke/);

  assert.match(dockerignore, /^\.env\*/m);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.next$/m);
});
