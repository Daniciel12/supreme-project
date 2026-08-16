import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const userFindUnique = createAsyncStub();
const userFindFirst = createAsyncStub();
const bcryptCompare = createAsyncStub();
const adapterLinkAccount = createAsyncStub();
const prisma = {
  user: { findUnique: userFindUnique, findFirst: userFindFirst },
};
const credentialsProviderModule = await import(
  "next-auth/providers/credentials"
);
const googleProviderModule = await import("next-auth/providers/google");

mock.module("server-only", { defaultExport: {} });
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma },
});
mock.module("@auth/prisma-adapter", {
  namedExports: { PrismaAdapter: () => ({ linkAccount: adapterLinkAccount }) },
});
mock.module("bcrypt", {
  defaultExport: { compare: bcryptCompare },
});
mock.module("next-auth/providers/credentials", {
  defaultExport: credentialsProviderModule.default.default,
});
mock.module("next-auth/providers/google", {
  defaultExport: googleProviderModule.default.default,
});

const { createAuthOptions } = await import("../src/lib/auth.ts");
const parseProvidersModule = await import(
  "../node_modules/next-auth/core/lib/providers.js"
);
const publicProvidersModule = await import(
  "../node_modules/next-auth/core/routes/providers.js"
);
const parseProviders = parseProvidersModule.default.default;
const publicProviders = publicProvidersModule.default.default;

beforeEach(() => {
  userFindUnique.reset();
  userFindFirst.reset();
  bcryptCompare.reset();
  adapterLinkAccount.reset();
});

function provider(options, id) {
  return options.providers.find((candidate) => candidate.id === id);
}

function credentialsAuthorize(options) {
  return provider(options, "credentials").options.authorize;
}

const credentials = {
  email: "daniel@example.com",
  password: "valid-password",
};

test("Credentials returns null for an unknown user", async () => {
  const authorize = credentialsAuthorize(createAuthOptions({}));

  assert.equal(await authorize(credentials), null);
  assert.equal(bcryptCompare.calls.length, 0);
});

test("Credentials rejects an OAuth-only user without calling bcrypt", async () => {
  userFindFirst.implementation = async () => ({
    id: "oauth-user",
    email: credentials.email,
    name: "Daniel",
    password: null,
  });
  const authorize = credentialsAuthorize(createAuthOptions({}));

  assert.equal(await authorize(credentials), null);
  assert.equal(bcryptCompare.calls.length, 0);
});

test("Credentials returns null for an invalid password", async () => {
  userFindFirst.implementation = async () => ({
    id: "credentials-user",
    email: credentials.email,
    name: "Daniel",
    password: "stored-hash",
  });
  bcryptCompare.implementation = async () => false;
  const authorize = credentialsAuthorize(createAuthOptions({}));

  assert.equal(await authorize(credentials), null);
  assert.deepEqual(bcryptCompare.calls[0], ["valid-password", "stored-hash"]);
});

test("Credentials authenticates a valid password", async () => {
  userFindFirst.implementation = async () => ({
    id: "credentials-user",
    email: credentials.email,
    name: "Daniel",
    password: "stored-hash",
  });
  bcryptCompare.implementation = async () => true;
  const authorize = credentialsAuthorize(createAuthOptions({}));

  assert.deepEqual(await authorize(credentials), {
    id: "credentials-user",
    email: credentials.email,
    name: "Daniel",
  });
  assert.deepEqual(userFindFirst.calls[0][0], {
    where: {
      email: { equals: "daniel@example.com", mode: "insensitive" },
    },
  });
});

test("Credentials normalizes mixed-case email before lookup", async () => {
  userFindFirst.implementation = async () => ({
    id: "credentials-user",
    email: credentials.email,
    name: "Daniel",
    password: "stored-hash",
  });
  bcryptCompare.implementation = async () => true;
  const authorize = credentialsAuthorize(createAuthOptions({}));

  await authorize({ ...credentials, email: "  DANIEL@EXAMPLE.COM  " });
  assert.deepEqual(userFindFirst.calls[0][0], {
    where: {
      email: { equals: "daniel@example.com", mode: "insensitive" },
    },
  });
});

test("Google is absent without both server environment variables", () => {
  const incompleteEnvironments = [
    {},
    { GOOGLE_CLIENT_ID: "test-google-client-id" },
    { GOOGLE_CLIENT_SECRET: "test-google-client-secret" },
  ];

  for (const environment of incompleteEnvironments) {
    const options = createAuthOptions(environment);
    assert.deepEqual(
      options.providers.map(({ id }) => id),
      ["credentials"]
    );
    assert.equal(options.session?.strategy, "jwt");
  }
});

test("Google is registered without exposing its secret to provider data", () => {
  const clientSecret = "test-google-secret-not-for-client";
  const options = createAuthOptions({
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: clientSecret,
  });
  const parsed = parseProviders({
    providers: options.providers,
    providerId: undefined,
    url: "http://localhost/api/auth",
  }).providers;
  const clientData = publicProviders(parsed).body;

  assert.deepEqual(
    options.providers.map(({ id }) => id),
    ["credentials", "google"]
  );
  assert.equal(clientData.google.id, "google");
  assert.equal(clientData.google.type, "oauth");
  assert.doesNotMatch(JSON.stringify(clientData), new RegExp(clientSecret));
  const google = provider(options, "google");
  assert.equal("allowDangerousEmailAccountLinking" in google, false);
  assert.equal("allowDangerousEmailAccountLinking" in google.options, false);
});

test("OAuth adapter links the first account for a new OAuth-only user", async () => {
  const account = {
    userId: "new-oauth-user",
    type: "oauth",
    provider: "google",
    providerAccountId: "google-account",
  };
  userFindUnique.implementation = async () => ({
    password: null,
    accounts: [],
  });
  adapterLinkAccount.implementation = async () => account;
  const options = createAuthOptions({});

  assert.deepEqual(await options.adapter.linkAccount(account), account);
  assert.equal(adapterLinkAccount.calls.length, 1);
  assert.deepEqual(userFindUnique.calls[0][0], {
    where: { id: account.userId },
    select: {
      password: true,
      accounts: { select: { id: true }, take: 1 },
    },
  });
});

test("OAuth adapter refuses linking to a Credentials identity", async () => {
  userFindUnique.implementation = async () => ({
    password: "stored-hash",
    accounts: [],
  });
  const options = createAuthOptions({});

  await assert.rejects(
    options.adapter.linkAccount({
      userId: "credentials-user",
      type: "oauth",
      provider: "google",
      providerAccountId: "google-account",
    }),
    /account linking is disabled/i
  );
  assert.equal(adapterLinkAccount.calls.length, 0);
});

test("OAuth adapter refuses adding another account to an OAuth identity", async () => {
  userFindUnique.implementation = async () => ({
    password: null,
    accounts: [{ id: "existing-account" }],
  });
  const options = createAuthOptions({});

  await assert.rejects(
    options.adapter.linkAccount({
      userId: "oauth-user",
      type: "oauth",
      provider: "google",
      providerAccountId: "second-google-account",
    }),
    /account linking is disabled/i
  );
  assert.equal(adapterLinkAccount.calls.length, 0);
});

test("auth errors return to the Supreme login page", () => {
  const options = createAuthOptions({});
  assert.equal(options.pages?.signIn, "/login");
  assert.equal(options.pages?.error, "/login");
});

test("JWT callback copies OAuth user.id to token.sub", async () => {
  const options = createAuthOptions({});
  const token = { name: "Daniel" };

  const result = await options.callbacks.jwt({
    token,
    user: { id: "oauth-user", name: "Daniel" },
  });

  assert.equal(result.sub, "oauth-user");
  assert.equal(typeof result.sessionIssuedAt, "number");
});

test("JWT callback rejects a session older than the persisted cutoff", async () => {
  userFindUnique.implementation = async () => ({
    sessionsValidAfter: new Date(1_700_000_001_000),
  });
  const options = createAuthOptions({});

  await assert.rejects(
    options.callbacks.jwt({
      token: { sub: "credentials-user", iat: 1_700_000_000 },
    }),
    /no longer valid/i
  );
});

test("JWT callback keeps a session created after the persisted cutoff", async () => {
  userFindUnique.implementation = async () => ({
    sessionsValidAfter: new Date(1_700_000_000_000),
  });
  const options = createAuthOptions({});
  const token = {
    sub: "credentials-user",
    iat: 1_700_000_001,
    sessionIssuedAt: 1_700_000_001_250,
  };

  assert.equal(await options.callbacks.jwt({ token }), token);
});

test("session callback copies token.sub to session.user.id", async () => {
  const options = createAuthOptions({});
  const session = {
    user: { id: "", name: "Daniel", email: "daniel@example.com" },
    expires: "2099-01-01T00:00:00.000Z",
  };

  const result = await options.callbacks.session({
    session,
    token: { sub: "oauth-user" },
  });

  assert.equal(result.user.id, "oauth-user");
});

test("session callback exposes the server-issued authentication time", async () => {
  const options = createAuthOptions({});
  const session = {
    user: { id: "", email: "owner@example.com" },
    expires: "2099-01-01T00:00:00.000Z",
  };

  const result = await options.callbacks.session({
    session,
    token: { sub: "user-1", sessionIssuedAt: 1_700_000_000_250 },
  });

  assert.equal(result.authenticatedAt, "2023-11-14T22:13:20.250Z");
});

test("Prisma schema and migration support OAuth users without data loss", async () => {
  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8"
  );
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260808211500_support_google_oauth_users/migration.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(schema, /emailVerified\s+DateTime\?/);
  assert.match(schema, /image\s+String\?/);
  assert.match(schema, /password\s+String\?/);
  assert.match(migration, /ALTER COLUMN "password" DROP NOT NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|UPDATE "users"/i);
});

test("email uniqueness is case-insensitive without enabling OAuth linking", async () => {
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260816180000_add_case_insensitive_email_uniqueness/migration.sql",
      import.meta.url
    ),
    "utf8"
  );
  const auth = await readFile(
    new URL("../src/lib/auth.ts", import.meta.url),
    "utf8"
  );

  assert.match(migration, /UNIQUE INDEX[\s\S]*LOWER\("email"\)/i);
  assert.match(auth, /mode: "insensitive"/);
  assert.doesNotMatch(auth, /allowDangerousEmailAccountLinking:\s*true/);
});

test("login UI discovers Google through getProviders without client secrets", async () => {
  const loginPage = await readFile(
    new URL("../src/app/login/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(loginPage, /getProviders\(\)/);
  assert.match(loginPage, /providers\?\.google/);
  assert.match(loginPage, /Continuar com Google/);
  assert.doesNotMatch(loginPage, /GOOGLE_CLIENT_SECRET|NEXT_PUBLIC_GOOGLE/);
});

test("login UI handles OAuth redirect errors without exposing provider details", async () => {
  const loginPage = await readFile(
    new URL("../src/app/login/page.tsx", import.meta.url),
    "utf8"
  );

  assert.match(loginPage, /useSearchParams\(\)/);
  assert.match(loginPage, /searchParams\.get\("error"\)/);
  assert.match(loginPage, /OAuthAccountNotLinked/);
  assert.match(loginPage, /outro método de acesso/);
  assert.match(loginPage, /AccessDenied/);
  assert.match(loginPage, /Não foi possível concluir o acesso com Google/);
  assert.doesNotMatch(loginPage, /OAuthCallbackError|client_secret|access_token/);
});
