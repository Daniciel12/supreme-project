import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const runbook = readFileSync(
  new URL("../docs/GOOGLE_OAUTH.md", import.meta.url),
  "utf8"
);

test("Google OAuth runbook matches the production runtime", () => {
  assert.match(runbook, /\/opt\/supreme\/app/);
  assert.match(runbook, /\/opt\/supreme\/runtime\/\.env\.production/);
  assert.match(runbook, /\/opt\/supreme\/runtime\/compose\.yml/);
  assert.match(runbook, /https:\/\/app\.supremeproject\.tech\/api\/health/);
  assert.match(
    runbook,
    /https:\/\/app\.supremeproject\.tech\/api\/auth\/callback\/google/
  );

  assert.doesNotMatch(runbook, /compose\.production\.yml/);
  assert.doesNotMatch(runbook, /\/api\/health\/ready/);
});

test("Google OAuth activation preserves the immutable image and rollback", () => {
  assert.match(runbook, /CURRENT_TAG="\$\{CURRENT_IMAGE##\*:\}"/);
  assert.match(runbook, /SUPREME_IMAGE_TAG="\$CURRENT_TAG"/);
  assert.match(runbook, /up -d --force-recreate app/);
  assert.match(runbook, /\.env\.production\.before-google-oauth/);
  assert.match(runbook, /sudo test -e "\$ENV_BACKUP"/);
  assert.match(runbook, /ROLLBACK: OK/);
  assert.match(runbook, /ROLLBACK DO AMBIENTE: OK/);
  assert.match(runbook, /não executa build nem migrations/i);
});

test("Google OAuth validation checks provider availability without exposing secrets", () => {
  assert.match(runbook, /\/api\/auth\/providers/);
  assert.match(runbook, /GOOGLE_PROVIDER: OK/);
  assert.match(runbook, /providers.*!=.*GOOGLE_CLIENT_SECRET/s);
  assert.match(runbook, /Não use `cat`, `grep`, `echo`/);
  assert.match(runbook, /Não altere `NEXTAUTH_SECRET`/);
});
