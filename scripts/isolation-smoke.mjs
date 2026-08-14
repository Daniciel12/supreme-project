const requiredEnvironment = [
  "BASE_URL",
  "ISOLATION_A_EMAIL",
  "ISOLATION_A_PASSWORD",
  "ISOLATION_B_EMAIL",
  "ISOLATION_B_PASSWORD",
];

for (const key of requiredEnvironment) {
  if (!process.env[key]) {
    console.error(`[isolation] Missing required environment variable: ${key}`);
    process.exit(2);
  }
}

const baseUrl = new URL(process.env.BASE_URL);
if (!/^https?:$/.test(baseUrl.protocol)) {
  console.error("[isolation] BASE_URL must use http or https");
  process.exit(2);
}

function createClient() {
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

  async function json(path, init = {}) {
    const response = await request(path, init);
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : null;
    return { response, body };
  }

  return { request, json };
}

async function authenticate(client, email, password) {
  const csrfResult = await client.json("/api/auth/csrf");
  if (csrfResult.response.status !== 200 || !csrfResult.body?.csrfToken) {
    throw new Error("NextAuth CSRF token was not returned");
  }

  const body = new URLSearchParams({
    csrfToken: csrfResult.body.csrfToken,
    email,
    password,
    callbackUrl: new URL("/", baseUrl).toString(),
    json: "true",
  });

  const callback = await client.request(
    "/api/auth/callback/credentials?json=true",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (![200, 302, 303].includes(callback.status)) {
    throw new Error(`Credentials callback returned HTTP ${callback.status}`);
  }

  const sessionResult = await client.json("/api/auth/session");
  if (sessionResult.response.status !== 200 || !sessionResult.body?.user?.id) {
    throw new Error("Credentials login did not establish an authenticated session");
  }

  if (sessionResult.body.user.email !== email) {
    throw new Error("Authenticated session email does not match requested account");
  }

  return sessionResult.body;
}

async function expectStatus(client, path, expected, init = {}) {
  const response = await client.request(path, init);
  if (response.status !== expected) {
    throw new Error(`${path} returned HTTP ${response.status}; expected ${expected}`);
  }
  return response;
}

async function run() {
  console.log(`[isolation] Target: ${baseUrl.origin}`);

  const clientA = createClient();
  const clientB = createClient();

  const sessionA = await authenticate(
    clientA,
    process.env.ISOLATION_A_EMAIL,
    process.env.ISOLATION_A_PASSWORD
  );
  const sessionB = await authenticate(
    clientB,
    process.env.ISOLATION_B_EMAIL,
    process.env.ISOLATION_B_PASSWORD
  );

  if (sessionA.user.id === sessionB.user.id) {
    throw new Error("Accounts A and B resolved to the same user id");
  }
  console.log("[isolation] Independent sessions established");

  const profileA = await clientA.json("/api/account/profile");
  const profileB = await clientB.json("/api/account/profile");

  if (
    profileA.response.status !== 200 ||
    profileA.body?.email !== process.env.ISOLATION_A_EMAIL
  ) {
    throw new Error("Account A profile did not resolve to its own identity");
  }
  if (
    profileB.response.status !== 200 ||
    profileB.body?.email !== process.env.ISOLATION_B_EMAIL
  ) {
    throw new Error("Account B profile did not resolve to its own identity");
  }
  if (
    "password" in profileA.body ||
    "password" in profileB.body ||
    "accounts" in profileA.body ||
    "accounts" in profileB.body
  ) {
    throw new Error("Account profile exposed credential material");
  }
  console.log("[isolation] Account profile identity isolation passed");

  const marker = `Isolation ${Date.now()}`;
  let bookId = null;

  try {
    const createResult = await clientA.json("/api/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: marker,
        author: "Supreme Isolation Smoke",
        totalPages: 10,
      }),
    });

    if (createResult.response.status !== 201 || !createResult.body?.id) {
      throw new Error(
        `/api/books creation returned HTTP ${createResult.response.status}; expected 201`
      );
    }
    bookId = createResult.body.id;
    console.log("[isolation] Account A created disposable marker");

    const booksA = await clientA.json("/api/books");
    if (booksA.response.status !== 200 || !Array.isArray(booksA.body)) {
      throw new Error("Account A could not list books");
    }
    if (!booksA.body.some((book) => book.id === bookId)) {
      throw new Error("Account A cannot see its own marker");
    }

    const booksB = await clientB.json("/api/books");
    if (booksB.response.status !== 200 || !Array.isArray(booksB.body)) {
      throw new Error("Account B could not list books");
    }
    if (booksB.body.some((book) => book.id === bookId)) {
      throw new Error("ISOLATION FAILURE: Account B can list Account A marker");
    }
    console.log("[isolation] Cross-account list isolation passed");

    await expectStatus(clientB, `/api/books/${bookId}`, 404, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ readPages: 1 }),
    });

    await expectStatus(clientB, `/api/books/${bookId}`, 404, {
      method: "DELETE",
    });
    console.log("[isolation] Cross-account mutation isolation passed");

    console.log("[isolation] PASS");
  } finally {
    if (bookId) {
      const cleanup = await clientA.request(`/api/books/${bookId}`, {
        method: "DELETE",
      });
      if (cleanup.status !== 200 && cleanup.status !== 404) {
        console.error(
          `[isolation] Cleanup warning: HTTP ${cleanup.status}; remove disposable marker manually`
        );
      }
    }
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `[isolation] FAIL: ${error instanceof Error ? error.message : "unknown error"}`
  );
  process.exitCode = 1;
}
