import "server-only";

import { z } from "zod";

const opaqueIdentifierSchema = z.string().trim().min(1).max(255);
const providerIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{1,39}$/);
const httpsUrlSchema = z.url().refine((value) => {
  return new URL(value).protocol === "https:";
});
const dateTimeSchema = z.iso.datetime({ offset: true });
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const unsignedMoneySchema = z
  .string()
  .regex(/^(?:0|[1-9][0-9]{0,16})(?:\.[0-9]{1,2})?$/);
const signedMoneySchema = z
  .string()
  .regex(/^-?(?:0|[1-9][0-9]{0,16})(?:\.[0-9]{1,2})?$/);
const rawProviderDataSchema = z.record(z.string(), z.json());

export const openFinanceProviderDescriptorSchema = z.strictObject({
  id: providerIdSchema,
  label: z.string().trim().min(1).max(80),
});

export const openFinancePermissionSchema = z.enum([
  "ACCOUNTS",
  "BALANCES",
  "TRANSACTIONS",
]);

const openFinancePermissionsSchema = z
  .array(openFinancePermissionSchema)
  .min(1)
  .max(3)
  .refine((permissions) => new Set(permissions).size === permissions.length);

export const openFinanceConsentStatusSchema = z.enum([
  "AWAITING_AUTHORISATION",
  "AUTHORISED",
  "REJECTED",
]);

export const openFinanceConnectionStatusSchema = z.enum([
  "PENDING_AUTHORISATION",
  "ACTIVE",
  "ATTENTION_REQUIRED",
  "REVOKED",
  "ERROR",
]);

export const openFinanceConnectionSchema = z.strictObject({
  externalConnectionId: opaqueIdentifierSchema,
  externalConsentId: opaqueIdentifierSchema,
  status: openFinanceConnectionStatusSchema,
  consentStatus: openFinanceConsentStatusSchema,
  permissions: openFinancePermissionsSchema,
  consentExpiresAt: dateTimeSchema.nullable(),
  lastSyncedAt: dateTimeSchema.nullable(),
  revokedAt: dateTimeSchema.nullable(),
  raw: rawProviderDataSchema,
});

export const openFinanceStartConsentInputSchema = z.strictObject({
  requestId: opaqueIdentifierSchema,
  callbackUrl: httpsUrlSchema,
  permissions: openFinancePermissionsSchema,
  requestedExpiresAt: dateTimeSchema.optional(),
});

export const openFinanceAuthorizationSchema = z.strictObject({
  authorizationUrl: httpsUrlSchema,
  connection: openFinanceConnectionSchema,
});

export const openFinanceConnectionReferenceSchema = z.strictObject({
  externalConnectionId: opaqueIdentifierSchema,
});

export const openFinanceAccountTypeSchema = z.enum([
  "CHECKING",
  "SAVINGS",
  "PREPAID",
  "CREDIT",
  "INVESTMENT",
  "OTHER",
]);

export const openFinanceBalanceSchema = z
  .strictObject({
    current: signedMoneySchema.nullable(),
    available: signedMoneySchema.nullable(),
  })
  .refine((balance) => {
    return balance.current !== null || balance.available !== null;
  });

export const openFinanceAccountSchema = z.strictObject({
  externalAccountId: opaqueIdentifierSchema,
  name: z.string().trim().min(1).max(160),
  type: openFinanceAccountTypeSchema,
  currency: currencySchema,
  balance: openFinanceBalanceSchema,
  raw: rawProviderDataSchema,
});

export const openFinanceTransactionSchema = z.strictObject({
  externalTransactionId: opaqueIdentifierSchema,
  externalAccountId: opaqueIdentifierSchema,
  direction: z.enum(["CREDIT", "DEBIT"]),
  status: z.enum(["PENDING", "POSTED"]),
  amount: unsignedMoneySchema,
  currency: currencySchema,
  description: z.string().trim().min(1).max(500),
  occurredAt: dateTimeSchema,
  postedAt: dateTimeSchema.nullable(),
  updatedAt: dateTimeSchema,
  raw: rawProviderDataSchema,
});

export const openFinanceAccountQuerySchema = z.strictObject({
  externalConnectionId: opaqueIdentifierSchema,
  cursor: opaqueIdentifierSchema.optional(),
});

export const openFinanceTransactionQuerySchema = z
  .strictObject({
    externalConnectionId: opaqueIdentifierSchema,
    externalAccountId: opaqueIdentifierSchema,
    from: dateTimeSchema,
    to: dateTimeSchema,
    cursor: opaqueIdentifierSchema.optional(),
  })
  .refine((query) => Date.parse(query.from) <= Date.parse(query.to));

export function openFinancePageSchema<Item extends z.ZodType>(
  itemSchema: Item
) {
  return z
    .strictObject({
      items: z.array(itemSchema).max(10_000),
      nextCursor: opaqueIdentifierSchema.nullable(),
      hasMore: z.boolean(),
    })
    .refine((page) => !page.hasMore || page.nextCursor !== null);
}

export const openFinanceExternalKeyInputSchema = z.strictObject({
  providerId: providerIdSchema,
  externalConnectionId: opaqueIdentifierSchema,
  resourceType: z.enum(["ACCOUNT", "TRANSACTION"]),
  externalId: opaqueIdentifierSchema,
});

export type OpenFinanceProviderDescriptor = z.infer<
  typeof openFinanceProviderDescriptorSchema
>;
export type OpenFinancePermission = z.infer<
  typeof openFinancePermissionSchema
>;
export type OpenFinanceConnection = z.infer<
  typeof openFinanceConnectionSchema
>;
export type OpenFinanceStartConsentInput = z.infer<
  typeof openFinanceStartConsentInputSchema
>;
export type OpenFinanceAuthorization = z.infer<
  typeof openFinanceAuthorizationSchema
>;
export type OpenFinanceConnectionReference = z.infer<
  typeof openFinanceConnectionReferenceSchema
>;
export type OpenFinanceAccount = z.infer<typeof openFinanceAccountSchema>;
export type OpenFinanceAccountQuery = z.infer<
  typeof openFinanceAccountQuerySchema
>;
export type OpenFinanceTransaction = z.infer<
  typeof openFinanceTransactionSchema
>;
export type OpenFinanceTransactionQuery = z.infer<
  typeof openFinanceTransactionQuerySchema
>;
export type OpenFinanceExternalKeyInput = z.infer<
  typeof openFinanceExternalKeyInputSchema
>;

export type OpenFinancePage<Item> = {
  items: Item[];
  nextCursor: string | null;
  hasMore: boolean;
};
