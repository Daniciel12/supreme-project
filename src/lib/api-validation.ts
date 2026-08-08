import { z } from "zod";

const dateSchema = z.iso.date();
const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const checkInPayloadSchema = z.strictObject({
  habitId: z.cuid(),
  date: dateSchema.optional(),
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
  date: dateSchema.optional(),
  isPaid: z.boolean().optional(),
});

export const registerPayloadSchema = z.strictObject({
  email: z.string().email().max(254),
  password: z.string().min(6),
  name: z.string().trim().max(100).optional(),
});