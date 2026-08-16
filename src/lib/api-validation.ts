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
export const workoutDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;

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

export const dashboardDateSchema = z.iso.date();

export const createHabitPayloadSchema = z.strictObject({
  name: requiredText(120),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(64).optional(),
  color: z.string().trim().max(64).optional(),
});

export const checkInPayloadSchema = z.strictObject({
  habitId: z.cuid(),
  date: isoDateSchema.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const createGoalPayloadSchema = z.strictObject({
  title: requiredText(200),
  category: requiredText(80),
  deadline: z.iso.date().optional(),
});

export const createTaskPayloadSchema = z.strictObject({
  title: requiredText(200),
  goalId: z.uuid(),
});

export const taskIdSchema = z.uuid();

export const updateTaskStatusPayloadSchema = z.strictObject({
  isCompleted: z.boolean(),
});

export const createWorkoutPayloadSchema = z.strictObject({
  name: requiredText(120),
  dayOfWeek: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.enum(workoutDays)),
  notes: z.string().trim().max(1000).optional(),
});

export const workoutIdSchema = z.cuid();

export const workoutCompletionPayloadSchema = z.strictObject({
  date: z.iso.date(),
  completed: z.boolean(),
});

export const createPhysicalRecordPayloadSchema = z.strictObject({
  weight: z.number().finite().positive().max(500),
  height: z.number().finite().min(0.5).max(2.8),
  bodyFat: z.number().finite().min(1).max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  photoUrl: z.url().max(2048).optional(),
  date: z.iso.date().optional(),
});

export const createBookPayloadSchema = z.strictObject({
  title: requiredText(200),
  author: requiredText(160),
  totalPages: z.number().int().positive().max(100000),
});

export const bookIdSchema = z.uuid();

export const updateBookProgressPayloadSchema = z.strictObject({
  readPages: z.number().int().min(0).max(100000),
});

export const createVisionImagePayloadSchema = z.strictObject({
  imageUrl: z.url().max(2048),
});

export const visionImageIdSchema = z.uuid();

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

export const transactionIdSchema = z.uuid();

export const updateTransactionStatusPayloadSchema = z.strictObject({
  isPaid: z.boolean(),
});

export const registerPayloadSchema = z.strictObject({
  email: z.string().email().max(254),
  password: passwordSchema,
  name: z.string().trim().max(100).optional(),
});

export const updateAccountProfilePayloadSchema = z.strictObject({
  name: requiredText(100).refine((value) => value.length >= 2),
});

export const accountDeletionPayloadSchema = z.strictObject({
  email: z.string().trim().email().max(254),
  confirmation: z.literal("EXCLUIR MINHA CONTA"),
  acknowledgedBackupRetention: z.literal(true),
  password: z
    .string()
    .min(1)
    .max(72)
    .refine((value) => new TextEncoder().encode(value).length <= 72)
    .optional(),
});

export const confirmEmailVerificationPayloadSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export const requestPasswordRecoveryPayloadSchema = z.strictObject({
  email: z.string().trim().email().max(254),
});

export const confirmPasswordRecoveryPayloadSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: passwordSchema,
});
