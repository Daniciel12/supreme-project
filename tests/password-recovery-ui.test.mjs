import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("login exposes password recovery only as a deliberate navigation", async () => {
  const login = await read("src/app/login/page.tsx");

  assert.match(login, /href="\/recuperar-senha"/);
  assert.match(login, /Esqueci minha senha/);
  assert.doesNotMatch(login, /SMTP_PASSWORD|password-recovery\/request[\s\S]*useEffect/);
});

test("recovery request keeps account existence private", async () => {
  const page = await read("src/app/recuperar-senha/page.tsx");
  const route = await read(
    "src/app/api/auth/password-recovery/request/route.ts"
  );

  assert.match(page, /api\/auth\/password-recovery\/request/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /exista ou não uma conta compatível/);
  assert.match(route, /GENERIC_RESPONSE/);
  assert.match(route, /user\?\.password/);
  assert.doesNotMatch(route, /Conta não encontrada|OAuth-only/);
  assert.doesNotMatch(route, /console\.error\([^\n]*(email|token)/i);
});

test("reset page removes the fragment and never mutates on page load", async () => {
  const page = await read("src/app/redefinir-senha/page.tsx");
  const cleanupEffect = page.match(
    /useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/
  )?.[0];

  assert.ok(cleanupEffect);
  assert.match(cleanupEffect, /window\.location\.hash/);
  assert.match(cleanupEffect, /window\.history\.replaceState/);
  assert.doesNotMatch(cleanupEffect, /fetch\(/);
  assert.match(page, /onSubmit=\{resetPassword\}/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /autoComplete="new-password"/);
  assert.match(page, /sessões anteriores foram encerradas/);
});

test("recovery pages are public while protected routes remain proxied", async () => {
  const proxy = await read("src/proxy.ts");
  const shell = await read("src/components/application-shell.tsx");
  const matcherSource = proxy.match(/matcher:\s*\[\s*"([^"]+)"/u)?.[1];
  assert.ok(matcherSource);

  const matcher = new RegExp(`^${matcherSource}$`, "u");
  assert.equal(matcher.test("/recuperar-senha"), false);
  assert.equal(matcher.test("/redefinir-senha"), false);
  assert.equal(matcher.test("/configuracoes"), true);
  assert.match(shell, /"\/recuperar-senha"/);
  assert.match(shell, /"\/redefinir-senha"/);
  assert.match(proxy, /isSessionTokenCurrent/);
});

test("migration and runbook preserve data and require real invalidation checks", async () => {
  const migration = await read(
    "prisma/migrations/20260815021000_add_password_recovery_session_cutoff/migration.sql"
  );
  const runbook = await read("docs/PASSWORD_RECOVERY.md");

  assert.match(migration, /ADD COLUMN "sessionsValidAfter" TIMESTAMP\(3\)/);
  assert.doesNotMatch(migration, /DROP|DELETE|TRUNCATE|UPDATE "users"/i);
  assert.match(runbook, /\/opt\/supreme\/runtime\/\.env\.production/);
  assert.match(runbook, /sessionsValidAfter/);
  assert.match(runbook, /sessão antiga/i);
  assert.match(runbook, /senha antiga falha/i);
  assert.match(runbook, /smoke/i);
  assert.match(runbook, /Rollback/);
  assert.doesNotMatch(runbook, /SMTP_PASSWORD=(?!replace-at-runtime)/);
  assert.doesNotMatch(runbook, /prisma migrate reset|restore.*produção/i);
});
