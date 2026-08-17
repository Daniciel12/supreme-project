import "server-only";

import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  openFinanceAccountQuerySchema,
  openFinanceAccountSchema,
  openFinanceAuthorizationSchema,
  openFinanceConnectionReferenceSchema,
  openFinanceConnectionSchema,
  openFinanceExternalKeyInputSchema,
  openFinancePageSchema,
  openFinanceProviderDescriptorSchema,
  openFinanceStartConsentInputSchema,
  openFinanceTransactionQuerySchema,
  openFinanceTransactionSchema,
  type OpenFinanceAccount,
  type OpenFinanceAccountQuery,
  type OpenFinanceAuthorization,
  type OpenFinanceConnection,
  type OpenFinanceConnectionReference,
  type OpenFinanceExternalKeyInput,
  type OpenFinancePage,
  type OpenFinanceProviderDescriptor,
  type OpenFinanceStartConsentInput,
  type OpenFinanceTransaction,
  type OpenFinanceTransactionQuery,
} from "@/lib/open-finance/contracts";

export type OpenFinanceProviderOperation =
  | "startConsent"
  | "getConnection"
  | "revokeConnection"
  | "listAccounts"
  | "listTransactions";

export type OpenFinanceProviderFailureCode =
  | "UNAVAILABLE"
  | "UNAUTHORIZED"
  | "CONSENT_REQUIRED"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class OpenFinanceProviderError extends Error {
  readonly name = "OpenFinanceProviderError";
  readonly providerId: string;
  readonly operation: OpenFinanceProviderOperation;
  readonly code: OpenFinanceProviderFailureCode;
  readonly retryable: boolean;

  constructor(
    providerId: string,
    operation: OpenFinanceProviderOperation,
    code: OpenFinanceProviderFailureCode,
    retryable: boolean
  ) {
    super("Open Finance provider operation failed.");
    this.providerId = providerId;
    this.operation = operation;
    this.code = code;
    this.retryable = retryable;
  }
}

export class OpenFinanceProviderInputError extends Error {
  readonly name = "OpenFinanceProviderInputError";
  readonly operation: OpenFinanceProviderOperation;

  constructor(operation: OpenFinanceProviderOperation) {
    super("Open Finance provider input is invalid.");
    this.operation = operation;
  }
}

export interface OpenFinanceProviderAdapter
  extends OpenFinanceProviderDescriptor {
  startConsent(
    input: OpenFinanceStartConsentInput
  ): Promise<OpenFinanceAuthorization>;
  getConnection(
    input: OpenFinanceConnectionReference
  ): Promise<OpenFinanceConnection>;
  revokeConnection(
    input: OpenFinanceConnectionReference
  ): Promise<OpenFinanceConnection>;
  listAccounts(
    input: OpenFinanceAccountQuery
  ): Promise<OpenFinancePage<OpenFinanceAccount>>;
  listTransactions(
    input: OpenFinanceTransactionQuery
  ): Promise<OpenFinancePage<OpenFinanceTransaction>>;
}

export type ValidatedOpenFinanceProvider = Readonly<
  OpenFinanceProviderAdapter
>;

function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  operation: OpenFinanceProviderOperation
): z.infer<Schema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new OpenFinanceProviderInputError(operation);
  return parsed.data;
}

function parseResponse<Schema extends z.ZodType>(
  schema: Schema,
  response: unknown,
  providerId: string,
  operation: OpenFinanceProviderOperation
): z.infer<Schema> {
  const parsed = schema.safeParse(response);
  if (!parsed.success) {
    throw new OpenFinanceProviderError(
      providerId,
      operation,
      "INVALID_RESPONSE",
      false
    );
  }
  return parsed.data;
}

async function callProvider<Result>(
  providerId: string,
  operation: OpenFinanceProviderOperation,
  call: () => Promise<Result>
) {
  try {
    return await call();
  } catch (error) {
    if (
      error instanceof OpenFinanceProviderError ||
      error instanceof OpenFinanceProviderInputError
    ) {
      throw error;
    }

    throw new OpenFinanceProviderError(
      providerId,
      operation,
      "UNKNOWN",
      true
    );
  }
}

export function createValidatedOpenFinanceProvider(
  adapter: OpenFinanceProviderAdapter
): ValidatedOpenFinanceProvider {
  const descriptor = openFinanceProviderDescriptorSchema.safeParse({
    id: adapter.id,
    label: adapter.label,
  });
  if (!descriptor.success) {
    throw new Error("Open Finance provider descriptor is invalid.");
  }

  const { id, label } = descriptor.data;

  return Object.freeze({
    id,
    label,

    async startConsent(input: OpenFinanceStartConsentInput) {
      const safeInput = parseInput(
        openFinanceStartConsentInputSchema,
        input,
        "startConsent"
      );
      return callProvider(id, "startConsent", async () => {
        const response = await adapter.startConsent(safeInput);
        return parseResponse(
          openFinanceAuthorizationSchema,
          response,
          id,
          "startConsent"
        );
      });
    },

    async getConnection(input: OpenFinanceConnectionReference) {
      const safeInput = parseInput(
        openFinanceConnectionReferenceSchema,
        input,
        "getConnection"
      );
      return callProvider(id, "getConnection", async () => {
        const response = await adapter.getConnection(safeInput);
        return parseResponse(
          openFinanceConnectionSchema,
          response,
          id,
          "getConnection"
        );
      });
    },

    async revokeConnection(input: OpenFinanceConnectionReference) {
      const safeInput = parseInput(
        openFinanceConnectionReferenceSchema,
        input,
        "revokeConnection"
      );
      return callProvider(id, "revokeConnection", async () => {
        const response = await adapter.revokeConnection(safeInput);
        return parseResponse(
          openFinanceConnectionSchema,
          response,
          id,
          "revokeConnection"
        );
      });
    },

    async listAccounts(input: OpenFinanceAccountQuery) {
      const safeInput = parseInput(
        openFinanceAccountQuerySchema,
        input,
        "listAccounts"
      );
      return callProvider(id, "listAccounts", async () => {
        const response = await adapter.listAccounts(safeInput);
        return parseResponse(
          openFinancePageSchema(openFinanceAccountSchema),
          response,
          id,
          "listAccounts"
        );
      });
    },

    async listTransactions(input: OpenFinanceTransactionQuery) {
      const safeInput = parseInput(
        openFinanceTransactionQuerySchema,
        input,
        "listTransactions"
      );
      return callProvider(id, "listTransactions", async () => {
        const response = await adapter.listTransactions(safeInput);
        return parseResponse(
          openFinancePageSchema(openFinanceTransactionSchema),
          response,
          id,
          "listTransactions"
        );
      });
    },
  });
}

export function openFinanceExternalKey(input: OpenFinanceExternalKeyInput) {
  const parsed = openFinanceExternalKeyInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Open Finance external key input is invalid.");
  }

  return createHash("sha256")
    .update(JSON.stringify(parsed.data), "utf8")
    .digest("hex");
}
