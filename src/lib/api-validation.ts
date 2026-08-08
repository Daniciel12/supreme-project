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

export const createTransactionPayloadSchema = z.strictObject({
  accountId: z.uuid(),
  title: requiredText(200),
  type: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(["INCOME", "EXPENSE"])),
  amount: z.number().finite(),
  date: isoDateSchema.optional(),
  isPaid: z.boolean().optional(),
});

export const registerPayloadSchema = z.strictObject({
  email: z.string().email().max(254),
  password: passwordSchema,
  name: z.string().trim().max(100).optional(),
});
