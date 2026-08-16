import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("settings offers a POST download and explains its sensitive-data boundary", () => {
  const settings = source("src/app/configuracoes/page.tsx");

  assert.ok(settings.includes('fetch("/api/account/export", { method: "POST" })'));
  assert.match(settings, /URL\.createObjectURL/);
  assert.match(settings, /download\.download = filename/);
  assert.match(settings, /Exportar meus dados/);
  assert.match(settings, /Senhas, sessões e tokens nunca entram no arquivo/);
});

test("account export is a non-cacheable attachment scoped to the session id", () => {
  const route = source("src/app/api/account/export/route.ts");

  assert.match(route, /where: \{ id: session\.user\.id \}/);
  assert.match(route, /accountDataExportSelect\(session\.user\.id\)/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /X-Content-Type-Options/);
  assert.match(route, /X-Robots-Tag/);
});

test("lifecycle documentation records export exclusions and deletion gates", () => {
  const lifecycle = source("docs/DATA_LIFECYCLE.md");
  const roadmap = source("docs/ROADMAP.md");

  assert.match(lifecycle, /hash da senha e corte interno de sessões/);
  assert.match(lifecycle, /tokens de verificação ou recuperação/);
  assert.match(lifecycle, /Backups PostgreSQL \| 30 dias/);
  assert.match(lifecycle, /confirmação recente da identidade/);
  assert.match(lifecycle, /remover arquivos UploadThing com retentativa idempotente/);
  assert.match(roadmap, /\[x\].*exportação de dados/i);
  assert.match(roadmap, /\[x\].*baseline técnica de retenção e privacidade/i);
});
