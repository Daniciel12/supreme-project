import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("settings requests an email change without accepting a client user id", async () => {
  const settings = await read("src/app/configuracoes/page.tsx");

  assert.match(settings, /api\/account\/email-change\/request/);
  assert.match(settings, /Alterar e-mail/);
  assert.match(settings, /Senha atual/);
  assert.match(settings, /login realizado nos últimos 10 minutos/);
  assert.match(settings, /newEmail: normalizedNewEmail/);
  assert.doesNotMatch(settings, /userId:\s*profile/);
  assert.match(settings, /encerra as sessões anteriores/);
});

test("public confirmation keeps the token in the fragment until explicit POST", async () => {
  const page = await read("src/app/alterar-email/page.tsx");
  const proxy = await read("src/proxy.ts");

  assert.match(page, /window\.location\.hash/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /Confirmar novo e-mail/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /api\/account\/email-change\/confirm/);
  assert.match(page, /onClick=\{confirmChange\}/);
  assert.doesNotMatch(page, /useSearchParams/);

  const matcherSource = proxy.match(/matcher:\s*\[\s*"([^"]+)"/u)?.[1];
  assert.ok(matcherSource);
  const matcher = new RegExp(`^${matcherSource}$`, "u");
  assert.equal(matcher.test("/alterar-email"), false);
  assert.equal(matcher.test("/api/account/email-change/confirm"), false);
  assert.equal(matcher.test("/api/account/email-change/request"), true);
  assert.equal(matcher.test("/configuracoes"), true);
});

test("login explains the session reset after a successful change", async () => {
  const login = await read("src/app/login/page.tsx");

  assert.match(login, /searchParams\.has\("emailChanged"\)/);
  assert.match(login, /Entre novamente usando o novo endereço/);
});

test("migration enforces case-insensitive uniqueness without deleting rows", async () => {
  const migration = await read(
    "prisma/migrations/20260816180000_add_case_insensitive_email_uniqueness/migration.sql"
  );

  assert.match(migration, /CREATE UNIQUE INDEX/);
  assert.match(migration, /LOWER\("email"\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
});
