import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public verification page requires an explicit POST confirmation", async () => {
  const page = await read("src/app/verificar-email/page.tsx");

  assert.match(page, /Confirmar meu e-mail/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /api\/auth\/email-verification\/confirm/);
  assert.match(page, /window\.location\.hash/);
  assert.match(page, /window\.history\.replaceState/);
  const cleanupEffect = page.match(
    /useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/
  )?.[0];
  assert.ok(cleanupEffect);
  assert.doesNotMatch(cleanupEffect, /fetch\(/);
  assert.match(page, /onClick=\{confirmEmail\}/);
  assert.match(page, /role=\{state === "success" \? "status" : "alert"\}/);
  assert.match(page, /aria-busy/);
  assert.doesNotMatch(page, /useSearchParams/);
});

test("verification page is public but API authorization remains route-local", async () => {
  const proxy = await read("src/proxy.ts");
  const matcherSource = proxy.match(/matcher:\s*\[\s*"([^"]+)"/u)?.[1];
  assert.ok(matcherSource);

  const matcher = new RegExp(`^${matcherSource}$`, "u");
  assert.equal(matcher.test("/verificar-email"), false);
  assert.equal(matcher.test("/configuracoes"), true);

  const requestRoute = await read(
    "src/app/api/auth/email-verification/request/route.ts"
  );
  assert.match(requestRoute, /getServerSession\(authOptions\)/);
  assert.match(requestRoute, /where: \{ id: session\.user\.id \}/);
  assert.doesNotMatch(requestRoute, /request\.json\(\)/);
});

test("account settings exposes verification without permitting email edits", async () => {
  const settings = await read("src/app/configuracoes/page.tsx");

  assert.match(settings, /api\/auth\/email-verification\/request/);
  assert.match(settings, /Enviar verificação/);
  assert.match(settings, /profile\.emailVerified/);
  assert.match(settings, /id="account-email"[\s\S]*readOnly/);
});

test("activation runbook keeps secrets on the VPS and requires rollback gates", async () => {
  const runbook = await read("docs/EMAIL_VERIFICATION.md");

  assert.match(runbook, /\/opt\/supreme\/runtime\/\.env\.production/);
  assert.match(runbook, /SMTP_SECURE=false/);
  assert.match(runbook, /STARTTLS/);
  assert.match(runbook, /TLS 1\.2/);
  assert.match(runbook, /--force-recreate app/);
  assert.match(runbook, /Rollback/);
  assert.match(runbook, /smoke autenticado/);
  assert.match(runbook, /não cole os valores nesta conversa/i);
  assert.doesNotMatch(runbook, /SMTP_PASSWORD=(?!replace-at-runtime)/);
  assert.doesNotMatch(runbook, /prisma migrate reset|restore.*produção/i);
});
