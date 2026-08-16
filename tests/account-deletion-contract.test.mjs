import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account deletion migration is additive and preserves completion evidence", async () => {
  const migration = await read(
    "prisma/migrations/20260816133000_add_account_deletion_requests/migration.sql"
  );
  const schema = await read("prisma/schema.prisma");

  assert.match(migration, /CREATE TABLE "account_deletion_requests"/);
  assert.match(migration, /"subjectHash" TEXT NOT NULL/);
  assert.match(migration, /ADD COLUMN "providerFileKey" TEXT/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE FROM|UPDATE\s)/im);
  assert.match(schema, /status\s+AccountDeletionStatus/);
  assert.match(schema, /subjectHash\s+String\s+@unique/);
  assert.match(schema, /providerFileKey\s+String\?\s+@unique/);
  assert.match(schema, /user User\?[^\n]+onDelete: SetNull/);
});

test("all owned data is deleted through declared relational cascades", async () => {
  const schema = await read("prisma/schema.prisma");
  const relations = schema.match(/@relation\([^\n]+onDelete: Cascade\)/g) ?? [];

  assert.ok(relations.length >= 13);
  for (const model of [
    "Account",
    "Session",
    "Habit",
    "CheckIn",
    "PhysicalRecord",
    "Workout",
    "WorkoutCompletion",
    "FinancialAccount",
    "Transaction",
    "Goal",
    "Task",
    "VisionImage",
    "Book",
  ]) {
    const block = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.match(block ?? "", /onDelete: Cascade/);
  }
});

test("settings UI requires reinforced confirmation without a client user id", async () => {
  const settings = await read("src/app/configuracoes/page.tsx");
  const login = await read("src/app/login/page.tsx");

  assert.match(settings, /EXCLUIR MINHA CONTA/);
  assert.match(settings, /acknowledgedBackupRetention/);
  assert.match(settings, /profile\.accessMethods\.credentials/);
  assert.match(settings, /method: "DELETE"/);
  assert.doesNotMatch(settings, /JSON\.stringify\(\{[\s\S]{0,400}userId/);
  assert.match(login, /accountDeleted/);
  assert.match(login, /deletionPending/);
});

test("upload completion serializes against account deletion", async () => {
  const core = await read("src/app/api/uploadthing/core.ts");

  assert.match(core, /isSessionTokenCurrent/);
  assert.match(core, /PENDING_REMOTE_CLEANUP/);
  assert.match(core, /FOR UPDATE/);
  assert.match(core, /isolationLevel: "Serializable"/);
  assert.match(core, /deleteUploadThingFiles\(\[file\.key\]\)/);
  assert.match(core, /accountDeletionSubjectHash\(metadata\.userId\)/);
  assert.match(core, /cleanupRequestId/);
});
