const requiredEnvironment = ["BASE_URL", "SMOKE_EMAIL", "SMOKE_PASSWORD"];

for (const key of requiredEnvironment) {
  if (!process.env[key]) {
    console.error(`[smoke] Missing required environment variable: ${key}`);
    process.exit(2);
  }
}

const baseUrl = new URL(process.env.BASE_URL);
if (!/^https?:$/.test(baseUrl.protocol)) {
  console.error("[smoke] BASE_URL must use http or https");
  process.exit(2);
}

const smokeDate =
  process.env.SMOKE_DATE ?? new Date().toISOString().slice(0, 10);
const cookies = new Map();

function setCookiesFromResponse(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);

  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const name = pair.slice(0, separator).trim();
    const cookieValue = pair.slice(separator + 1).trim();

    if (!cookieValue) cookies.delete(name);
    else cookies.set(name, cookieValue);
  }
}

function cookieHeader() {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers,
    redirect: init.redirect ?? "manual",
  });

  setCookiesFromResponse(response);
  return response;
}

async function expectStatus(path, expected = 200) {
  const response = await request(path);
  if (response.status !== expected) {
    throw new Error(`${path} returned HTTP ${response.status}; expected ${expected}`);
  }
  return response;
}

async function expectJson(path, expected = 200) {
  const response = await expectStatus(path, expected);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${path} did not return JSON`);
  }
  return response.json();
}

async function authenticate() {
  const csrf = await expectJson("/api/auth/csrf");
  if (!csrf.csrfToken) {
    throw new Error("NextAuth CSRF token was not returned");
  }

  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email: process.env.SMOKE_EMAIL,
    password: process.env.SMOKE_PASSWORD,
    callbackUrl: new URL("/", baseUrl).toString(),
    json: "true",
  });

  const response = await request("/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (![200, 302, 303].includes(response.status)) {
    throw new Error(`Credentials callback returned HTTP ${response.status}`);
  }

  const session = await expectJson("/api/auth/session");
  if (!session?.user?.id) {
    throw new Error("Credentials login did not establish an authenticated session");
  }
}

async function run() {
  console.log(`[smoke] Target: ${baseUrl.origin}`);

  const health = await expectJson("/api/health");
  if (health.status !== "ok") {
    throw new Error("Health endpoint is not ready");
  }
  console.log("[smoke] Health check passed");

  await authenticate();
  console.log("[smoke] Credentials authentication passed");

  const pages = [
    "/",
    "/financas",
    "/habitos",
    "/metas",
    "/treinos",
    "/livros",
    "/visao",
    "/configuracoes",
  ];

  for (const page of pages) {
    await expectStatus(page);
  }
  console.log(`[smoke] ${pages.length} authenticated pages passed`);

  const apiChecks = [
    `/api/dashboard?date=${smokeDate}`,
    "/api/finances/accounts",
    "/api/finances/transactions",
    "/api/goals",
    "/api/habits",
    `/api/habits/summary?date=${smokeDate}`,
    `/api/workouts?date=${smokeDate}`,
    `/api/workouts/summary?date=${smokeDate}`,
    "/api/physical-records",
    "/api/books",
    "/api/vision",
    "/api/account/profile",
  ];

  for (const endpoint of apiChecks) {
    await expectJson(endpoint);
  }
  console.log(`[smoke] ${apiChecks.length} authenticated API checks passed`);

  console.log("[smoke] PASS");
}

try {
  await run();
} catch (error) {
  console.error(`[smoke] FAIL: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
