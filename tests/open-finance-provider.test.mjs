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

mock.module("server-only", { defaultExport: {} });

const {
  OpenFinanceProviderError,
  OpenFinanceProviderInputError,
  createValidatedOpenFinanceProvider,
  openFinanceExternalKey,
} = await import("../src/lib/open-finance/provider.ts");
const { OpenFinanceProviderRegistry } = await import(
  "../src/lib/open-finance/registry.ts"
);

const connection = {
  externalConnectionId: "connection-1",
  externalConsentId: "consent-1",
  status: "ACTIVE",
  consentStatus: "AUTHORISED",
  permissions: ["ACCOUNTS", "BALANCES", "TRANSACTIONS"],
  consentExpiresAt: "2026-11-17T12:00:00.000Z",
  lastSyncedAt: "2026-08-17T12:00:00.000Z",
  revokedAt: null,
  raw: { providerStatus: "ready" },
};

const account = {
  externalAccountId: "account-1",
  name: "Conta principal",
  type: "CHECKING",
  currency: "BRL",
  balance: { current: "1250.35", available: "1200.00" },
  raw: { accountId: "account-1", branchCode: "0001" },
};

const transaction = {
  externalTransactionId: "transaction-1",
  externalAccountId: "account-1",
  direction: "DEBIT",
  status: "POSTED",
  amount: "49.90",
  currency: "BRL",
  description: "Compra",
  occurredAt: "2026-08-16T14:30:00.000Z",
  postedAt: "2026-08-16T15:00:00.000Z",
  updatedAt: "2026-08-16T15:00:00.000Z",
  raw: { transactionId: "transaction-1", type: "PIX" },
};

function createAdapter(overrides = {}) {
  return {
    id: "sandbox-provider",
    label: "Sandbox Provider",
    async startConsent() {
      return {
        authorizationUrl: "https://provider.example/authorize",
        connection: {
          ...connection,
          status: "PENDING_AUTHORISATION",
          consentStatus: "AWAITING_AUTHORISATION",
          lastSyncedAt: null,
        },
      };
    },
    async getConnection() {
      return connection;
    },
    async revokeConnection() {
      return {
        ...connection,
        status: "REVOKED",
        consentStatus: "REJECTED",
        revokedAt: "2026-08-17T13:00:00.000Z",
      };
    },
    async listAccounts() {
      return { items: [account], nextCursor: null, hasMore: false };
    },
    async listTransactions() {
      return { items: [transaction], nextCursor: null, hasMore: false };
    },
    ...overrides,
  };
}

test("validated provider keeps consent and connection lifecycle explicit", async () => {
  const provider = createValidatedOpenFinanceProvider(createAdapter());
  const authorization = await provider.startConsent({
    requestId: "request-1",
    callbackUrl: "https://app.supremeproject.tech/api/open-finance/callback",
    permissions: ["ACCOUNTS", "BALANCES", "TRANSACTIONS"],
  });

  assert.equal(authorization.connection.status, "PENDING_AUTHORISATION");
  assert.equal(
    authorization.connection.consentStatus,
    "AWAITING_AUTHORISATION"
  );
  assert.equal(authorization.connection.lastSyncedAt, null);

  const revoked = await provider.revokeConnection({
    externalConnectionId: "connection-1",
  });
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.consentStatus, "REJECTED");
  assert.ok(revoked.revokedAt);
});

test("provider output preserves raw account and transaction data", async () => {
  const provider = createValidatedOpenFinanceProvider(createAdapter());
  const accounts = await provider.listAccounts({
    externalConnectionId: "connection-1",
  });
  const transactions = await provider.listTransactions({
    externalConnectionId: "connection-1",
    externalAccountId: "account-1",
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-17T23:59:59.000Z",
  });

  assert.equal(accounts.items[0].balance.current, "1250.35");
  assert.equal(accounts.items[0].externalAccountId, "account-1");
  assert.deepEqual(accounts.items[0].raw, account.raw);
  assert.equal(transactions.items[0].amount, "49.90");
  assert.equal(
    transactions.items[0].externalTransactionId,
    "transaction-1"
  );
  assert.deepEqual(transactions.items[0].raw, transaction.raw);
});

test("invalid inputs fail before calling a provider", async () => {
  let calls = 0;
  const provider = createValidatedOpenFinanceProvider(
    createAdapter({
      async startConsent() {
        calls += 1;
        return {};
      },
      async listTransactions() {
        calls += 1;
        return {};
      },
    })
  );

  await assert.rejects(
    provider.startConsent({
      requestId: "request-1",
      callbackUrl: "http://insecure.example/callback",
      permissions: ["ACCOUNTS"],
    }),
    OpenFinanceProviderInputError
  );
  await assert.rejects(
    provider.listTransactions({
      externalConnectionId: "connection-1",
      externalAccountId: "account-1",
      from: "2026-08-18T00:00:00.000Z",
      to: "2026-08-17T00:00:00.000Z",
    }),
    OpenFinanceProviderInputError
  );
  assert.equal(calls, 0);
});

test("invalid provider payload is replaced by a sanitized contract error", async () => {
  const provider = createValidatedOpenFinanceProvider(
    createAdapter({
      async listTransactions() {
        return {
          items: [{ ...transaction, amount: 49.9 }],
          nextCursor: null,
          hasMore: false,
        };
      },
    })
  );

  await assert.rejects(
    provider.listTransactions({
      externalConnectionId: "connection-1",
      externalAccountId: "account-1",
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-17T00:00:00.000Z",
    }),
    (error) => {
      assert.ok(error instanceof OpenFinanceProviderError);
      assert.equal(error.code, "INVALID_RESPONSE");
      assert.equal(error.retryable, false);
      assert.doesNotMatch(error.message, /49\.9|transaction-1/);
      return true;
    }
  );
});

test("pagination cannot claim more data without a cursor", async () => {
  const provider = createValidatedOpenFinanceProvider(
    createAdapter({
      async listAccounts() {
        return { items: [account], nextCursor: null, hasMore: true };
      },
    })
  );

  await assert.rejects(
    provider.listAccounts({ externalConnectionId: "connection-1" }),
    (error) => {
      assert.ok(error instanceof OpenFinanceProviderError);
      assert.equal(error.code, "INVALID_RESPONSE");
      return true;
    }
  );
});

test("unexpected adapter failures do not leak provider details", async () => {
  const provider = createValidatedOpenFinanceProvider(
    createAdapter({
      async getConnection() {
        throw new Error("upstream body with client_secret=do-not-leak");
      },
    })
  );

  await assert.rejects(
    provider.getConnection({ externalConnectionId: "connection-1" }),
    (error) => {
      assert.ok(error instanceof OpenFinanceProviderError);
      assert.equal(error.code, "UNKNOWN");
      assert.equal(error.retryable, true);
      assert.doesNotMatch(error.message, /client_secret|do-not-leak/);
      return true;
    }
  );
});

test("external keys are stable and delimiter-safe for idempotent sync", () => {
  const base = {
    providerId: "sandbox-provider",
    externalConnectionId: "connection:one",
    resourceType: "TRANSACTION",
    externalId: "transaction:one",
  };

  const first = openFinanceExternalKey(base);
  const repeated = openFinanceExternalKey({ ...base });
  const ambiguousDelimiterVariant = openFinanceExternalKey({
    ...base,
    externalConnectionId: "connection",
    externalId: "one:transaction:one",
  });

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, repeated);
  assert.notEqual(first, ambiguousDelimiterVariant);
});

test("registry rejects duplicates and exposes descriptors without adapters", () => {
  const provider = createValidatedOpenFinanceProvider(createAdapter());
  const second = createValidatedOpenFinanceProvider(
    createAdapter({ id: "other-provider", label: "Outro Provider" })
  );
  const registry = new OpenFinanceProviderRegistry([provider, second]);

  assert.deepEqual(registry.list(), [
    { id: "other-provider", label: "Outro Provider" },
    { id: "sandbox-provider", label: "Sandbox Provider" },
  ]);
  assert.equal(registry.get("sandbox-provider"), provider);
  assert.throws(
    () => registry.get("missing-provider"),
    /provider is unavailable/
  );
  assert.throws(
    () => new OpenFinanceProviderRegistry([provider, provider]),
    /registered more than once/
  );
});
