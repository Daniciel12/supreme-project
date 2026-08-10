import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("scheduled backup reports start, failure and success without sending secrets", () => {
  const job = read("scripts/postgres-backup-job.sh");

  assert.match(job, /set -Eeuo pipefail/);
  assert.match(job, /umask 077/);
  assert.match(job, /HEALTHCHECKS_PING_URL is required/);
  assert.match(job, /send_signal "\/start"/);
  assert.match(job, /send_signal "\/fail"/);
  assert.match(job, /bash "\$\{script_directory\}\/postgres-backup\.sh"/);
  assert.match(job, /backup completed, but monitoring success confirmation failed/);
  assert.doesNotMatch(job, /printf[^\n]*HEALTHCHECKS_PING_URL|echo[^\n]*HEALTHCHECKS_PING_URL/);
});

test("systemd timer runs daily in UTC and catches missed executions", () => {
  const timer = read("deploy/systemd/supreme-postgres-backup.timer");

  assert.match(timer, /OnCalendar=\*-\*-\* 03:00:00 UTC/);
  assert.match(timer, /Persistent=true/);
  assert.match(timer, /RandomizedDelaySec=15m/);
  assert.match(timer, /FixedRandomDelay=true/);
});

test("systemd service is non-root, protected and never restores", () => {
  const service = read("deploy/systemd/supreme-postgres-backup.service");

  assert.match(service, /User=deploy/);
  assert.match(service, /EnvironmentFile=\/opt\/supreme\/runtime\/\.env\.production/);
  assert.match(service, /EnvironmentFile=\/etc\/supreme\/backup-monitor\.env/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ExecStart=.*postgres-backup-job\.sh/);
  assert.doesNotMatch(service, /restore|DATABASE_URL=/);
});

test("runbook requires email monitoring and scoped 30-day retention", () => {
  const runbook = read("docs/POSTGRES_BACKUP_SCHEDULING.md");

  assert.match(runbook, /notificação por e-mail/);
  assert.match(runbook, /systemd-analyze verify/);
  assert.match(runbook, /lock-postgres-backups-7d/);
  assert.match(runbook, /lock por 7 dias/);
  assert.match(runbook, /expire-postgres-backups-30d/);
  assert.match(runbook, /expirar objetos após 30 dias/);
  assert.match(runbook, /Exclusões por lifecycle são permanentes/);
  assert.match(runbook, /não automatize restore de produção/i);
});
