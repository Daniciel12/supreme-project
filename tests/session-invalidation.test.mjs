import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

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

const userFindUnique = mock.fn();

mock.module("server-only", { defaultExport: {} });
mock.module(new URL("../src/lib/prisma.ts", import.meta.url), {
  namedExports: { prisma: { user: { findUnique: userFindUnique } } },
});

const { isSessionTokenCurrent } = await import(
  "../src/lib/session-invalidation.ts"
);

test("users without a cutoff keep pre-migration JWT sessions", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    sessionsValidAfter: null,
  }));

  assert.equal(
    await isSessionTokenCurrent({ sub: "user-1", iat: 1_700_000_000 }),
    true
  );
});

test("the millisecond sign-in timestamp is compared with the reset cutoff", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    sessionsValidAfter: new Date(1_700_000_000_500),
  }));

  assert.equal(
    await isSessionTokenCurrent({
      sub: "user-1",
      iat: 1_700_000_000,
      sessionIssuedAt: 1_700_000_000_499,
    }),
    false
  );
  assert.equal(
    await isSessionTokenCurrent({
      sub: "user-1",
      iat: 1_700_000_000,
      sessionIssuedAt: 1_700_000_000_500,
    }),
    true
  );
});

test("legacy JWT iat is used when the custom timestamp is absent", async () => {
  userFindUnique.mock.mockImplementation(async () => ({
    sessionsValidAfter: new Date(1_700_000_001_000),
  }));

  assert.equal(
    await isSessionTokenCurrent({ sub: "user-1", iat: 1_700_000_000 }),
    false
  );
  assert.equal(
    await isSessionTokenCurrent({ sub: "user-1", iat: 1_700_000_001 }),
    true
  );
});

test("missing users and malformed tokens fail closed", async () => {
  userFindUnique.mock.mockImplementation(async () => null);
  assert.equal(await isSessionTokenCurrent({ sub: "missing", iat: 1 }), false);
  assert.equal(await isSessionTokenCurrent({ iat: 1 }), false);
});
