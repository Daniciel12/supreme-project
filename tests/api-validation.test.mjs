import assert from "node:assert/strict";
import test from "node:test";

import {
  checkInPayloadSchema,
  createTaskPayloadSchema,
  createTransactionPayloadSchema,
  registerPayloadSchema,
  taskIdSchema,
} from "../src/lib/api-validation.ts";

test("check-in rejects a missing habitId", () => {
  assert.equal(checkInPayloadSchema.safeParse({}).success, false);
});

test("check-in rejects a non-string habitId", () => {
  assert.equal(checkInPayloadSchema.safeParse({ habitId: 123 }).success, false);
});

test("task rejects invalid payload and relational identifiers", () => {
  assert.equal(
    createTaskPayloadSchema.safeParse({ title: "", goalId: "not-an-id" }).success,
    false
  );
  assert.equal(taskIdSchema.safeParse("not-an-id").success, false);
});

test("transaction rejects invalid payload", () => {
  assert.equal(
    createTransactionPayloadSchema.safeParse({
      accountId: "not-an-id",
      title: "Compra",
      type: "TRANSFER",
      amount: "10.50",
    }).success,
    false
  );
});

test("registration rejects invalid email", () => {
  assert.equal(
    registerPayloadSchema.safeParse({
      email: "invalid-email",
      password: "123456",
    }).success,
    false
  );
});

test("registration bounds passwords to bcrypt's 72-byte limit", () => {
  const registrationWithPassword = (password) =>
    registerPayloadSchema.safeParse({
      email: "daniel@example.com",
      password,
    }).success;

  assert.equal(registrationWithPassword("valid-password"), true);
  assert.equal(registrationWithPassword("a".repeat(72)), true);
  assert.equal(registrationWithPassword("a".repeat(73)), false);
  assert.equal(registrationWithPassword("á".repeat(37)), false);
});

test("valid payloads are accepted and normalized", () => {
  assert.equal(
    checkInPayloadSchema.safeParse({
      habitId: "cm12345678901234567890123",
      date: "2026-08-08",
      note: "Concluído",
    }).success,
    true
  );

  assert.equal(
    createTaskPayloadSchema.safeParse({
      title: "Planejar a semana",
      goalId: "550e8400-e29b-41d4-a716-446655440000",
    }).success,
    true
  );

  const transaction = createTransactionPayloadSchema.parse({
    accountId: "550e8400-e29b-41d4-a716-446655440000",
    title: "Salário",
    type: "income",
    amount: 1000,
  });
  assert.equal(transaction.type, "INCOME");

  const registration = registerPayloadSchema.parse({
    name: "",
    email: "DANIEL@EXAMPLE.COM",
    password: "123456",
  });
  assert.equal(registration.email, "DANIEL@EXAMPLE.COM");
  assert.equal(registration.name, "");
});

test("check-in and transaction accept ISO dates and timezone-aware datetimes", () => {
  const dates = [
    "2026-08-08",
    "2026-08-08T15:30:00.000Z",
    "2026-08-08T15:30:00+03:00",
  ];

  for (const date of dates) {
    assert.equal(
      checkInPayloadSchema.safeParse({
        habitId: "cm12345678901234567890123",
        date,
      }).success,
      true
    );
    assert.equal(
      createTransactionPayloadSchema.safeParse({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        title: "Compra",
        type: "expense",
        amount: 10.5,
        date,
      }).success,
      true
    );
  }

  for (const date of ["2026-02-30", "not-a-date"]) {
    assert.equal(
      checkInPayloadSchema.safeParse({
        habitId: "cm12345678901234567890123",
        date,
      }).success,
      false
    );
    assert.equal(
      createTransactionPayloadSchema.safeParse({
        accountId: "550e8400-e29b-41d4-a716-446655440000",
        title: "Compra",
        type: "expense",
        amount: 10.5,
        date,
      }).success,
      false
    );
  }
});
