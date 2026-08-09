import { z } from "zod";

const isoDateSchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }),
]);
const passwordSchema = z
  .string()
  .min(6)
  .max(72)
  .refine((value) => new TextEncoder().encode(value).length <= 72);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const moneySchema = z.number().finite().multipleOf(0.01);

export const financialAccountTypes = [
  "CHECKING",
  "SAVINGS",
  "CASH",
  "INVESTMENT",
  "CREDIT",
  "OTHER",
] as const;

export const transactionTypes = ["INCOME", "EXPENSE"] as const;

function normalizeFinancialAccountType(value: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["CHECKING", "CORRENTE", "CONTA CORRENTE"].includes(normalized)) {
    return "CHECKING";
  }
  if (["SAVINGS", "POUPANCA"].includes(normalized)) return "SAVINGS";
  if (["CASH", "DINHEIRO", "CARTEIRA"].includes(normalized)) return "CASH";
  if (["INVESTMENT", "INVESTIMENTO", "INVESTIMENTOS"].includes(normalized)) {
    return "INVESTMENT";
  }
  if (
    [
      "CREDIT",
      "CREDITO",
      "CARTAO",
      "CARTAO DE CREDITO",
      "CREDIT CARD",
    ].includes(normalized)
  ) {
    return "CREDIT";
  }

  return "OTHER";
}

export const checkInPayloadSchema = z.strictObject({
  habitId: z.cuid(),
  date: isoDateSchema.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const createTaskPayloadSchema = z.strictObject({
  title: requiredText(200),
  goalId: z.uuid(),
});

export const taskIdSchema = z.uuid();

export const createFinancialAccountPayloadSchema = z.strictObject({
  name: requiredText(100),
  type: requiredText(50)
    .transform(normalizeFinancialAccountType)
    .pipe(z.enum(financialAccountTypes)),
  balance: moneySchema,
});

export const createTransactionPayloadSchema = z.strictObject({
  accountId: z.uuid(),
  title: requiredText(200),
  type: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(transactionTypes)),
  amount: moneySchema.positive(),
  date: isoDateSchema.optional(),
  isPaid: z.boolean().optional(),
});

export const registerPayloadSchema = z.strictObject({
  email: z.string().email().max(254),
  password: passwordSchema,
  name: z.string().trim().max(100).optional(),
});
