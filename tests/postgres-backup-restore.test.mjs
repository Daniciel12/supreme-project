import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("backup creates a validated custom dump and verifies the external round trip", () => {
  const backup = read("scripts/postgres-backup.sh");

  assert.match(backup, /set -Eeuo pipefail/);
  assert.match(backup, /umask 077/);
  assert.match(backup, /pg_dump[\s\S]*--format=custom/);
  assert.match(backup, /--no-owner --no-privileges/);
  assert.match(backup, /pg_restore --list/);
  assert.match(backup, /sha256sum/);
  assert.match(backup, /rclone copyto --immutable/);
  assert.match(backup, /external storage round-trip checksum failed/);
  assert.doesNotMatch(backup, /printf[^\n]*DATABASE_URL|echo[^\n]*DATABASE_URL/);
});

test("restore is structurally unable to target production", () => {
  const restore = read("scripts/postgres-restore-test.sh");

  assert.match(restore, /--network none/);
  assert.match(restore, /--tmpfs/);
  assert.match(restore, /restore_database="supreme_restore_test"/);
  assert.match(restore, /pg_restore[\s\S]*--exit-on-error/);
  assert.match(restore, /_prisma_migrations/);
  assert.match(restore, /docker rm --force/);
  assert.doesNotMatch(restore, /DATABASE_URL|RESTORE_DATABASE_URL|TARGET_DATABASE_URL/);
});

test("Docker CI exercises backup and disposable restore scripts", () => {
  const workflow = read(".github/workflows/docker.yml");

  assert.match(workflow, /Install external backup client/);
  assert.match(workflow, /bash scripts\/postgres-backup\.sh/);
  assert.match(workflow, /bash scripts\/postgres-restore-test\.sh/);
  assert.match(workflow, /RCLONE_DESTINATION/);
});
