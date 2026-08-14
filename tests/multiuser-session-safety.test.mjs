import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("credentials login performs a full document navigation after identity change", () => {
  const source = read("src/app/login/page.tsx");

  assert.match(source, /window\.location\.replace\("\/"\)/);
  assert.doesNotMatch(source, /router\.push\("\/"\)/);
});

test("application shell exposes identity and explicit logout with full reset", () => {
  const source = read("src/components/application-shell.tsx");

  assert.match(source, /getSession\(\)/);
  assert.match(source, /sessionUser\?\.email/);
  assert.match(source, /signOut\(\{ redirect: false \}\)/);
  assert.match(source, /window\.location\.replace\("\/login"\)/);
  assert.match(source, /signingOut \? "Saindo\.\.\." : "Sair"/);
});

test("isolation smoke uses independent sessions and verifies cross-account ownership", () => {
  const source = read("scripts/isolation-smoke.mjs");

  assert.match(source, /const clientA = createClient\(\)/);
  assert.match(source, /const clientB = createClient\(\)/);
  assert.match(source, /sessionA\.user\.id === sessionB\.user\.id/);
  assert.match(source, /Account profile identity isolation passed/);
  assert.match(source, /profileA\.body\?\.email !== process\.env\.ISOLATION_A_EMAIL/);
  assert.match(source, /Account profile exposed credential material/);
  assert.match(source, /ISOLATION FAILURE: Account B can list Account A marker/);
  assert.match(source, /expectStatus\(clientB, `\/api\/books\/\$\{bookId\}`, 404/);
  assert.match(source, /\[isolation\] PASS/);
});

test("package exposes the isolation smoke command", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["smoke:isolation"], "node scripts/isolation-smoke.mjs");
});
