import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function runMonitor(
  healthBody,
  healthExit = "0",
  successSignalExit = "0"
) {
  const directory = mkdtempSync(join(tmpdir(), "supreme-app-monitor-"));
  const curlPath = join(directory, "curl");
  const curlLog = join(directory, "curl.log");
  const argvLog = join(directory, "argv.log");
  const monitorPath = fileURLToPath(
    new URL("../scripts/app-health-monitor.sh", import.meta.url)
  );

  writeFileSync(
    curlPath,
    `#!/usr/bin/env bash
set -Eeuo pipefail
output=""
url="\${!#}"
config_from_stdin=false
printf '%s\n' "$*" >>"$FAKE_ARGV_LOG"
while [[ "$#" -gt 0 ]]; do
  if [[ "$1" == "--output" ]]; then
    output="$2"
    shift 2
  elif [[ "$1" == "--config" && "$2" == "-" ]]; then
    config_from_stdin=true
    shift 2
  else
    shift
  fi
done
if [[ "$config_from_stdin" == true ]]; then
  IFS= read -r config_line
  url="\${config_line#url = \"}"
  url="\${url%\"}"
fi
if [[ "$url" == https://monitor.example/* ]]; then
  printf '%s\n' "$url" >>"$FAKE_CURL_LOG"
  if [[ "$url" == "https://monitor.example/check-id" ]]; then
    exit "$FAKE_SUCCESS_SIGNAL_EXIT"
  fi
  exit 0
fi
if [[ -n "$output" ]]; then
  printf '%s' "$FAKE_HEALTH_BODY" >"$output"
fi
exit "$FAKE_HEALTH_EXIT"
`,
    "utf8"
  );
  chmodSync(curlPath, 0o755);

  try {
    const result = spawnSync("bash", [monitorPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        APP_HEALTH_URL: "https://app.example/api/health",
        APP_MONITOR_PING_URL: "https://monitor.example/check-id",
        FAKE_CURL_LOG: curlLog,
        FAKE_ARGV_LOG: argvLog,
        FAKE_HEALTH_BODY: healthBody,
        FAKE_HEALTH_EXIT: healthExit,
        FAKE_SUCCESS_SIGNAL_EXIT: successSignalExit,
      },
    });

    return {
      result,
      curlLog: readFileSync(curlLog, "utf8"),
      argvLog: readFileSync(argvLog, "utf8"),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("application monitor validates public health and reports every outcome", () => {
  const script = read("scripts/app-health-monitor.sh");

  assert.match(script, /set -Eeuo pipefail/);
  assert.match(script, /umask 077/);
  assert.match(script, /APP_HEALTH_URL is required/);
  assert.match(script, /APP_MONITOR_PING_URL is required/);
  assert.match(script, /must be an HTTPS URL/);
  assert.match(script, /send_signal "\/start"/);
  assert.match(script, /send_signal "\/fail"/);
  assert.match(script, /"status".*"ok"/);
  assert.match(script, /--connect-timeout 3/);
  assert.match(script, /--max-time 10/);
  assert.match(script, /--max-filesize 1024/);
  assert.match(script, /--config -/);
  assert.match(script, /public health and monitoring confirmation completed/);
  assert.doesNotMatch(
    script,
    /printf[^\n]*(APP_HEALTH_URL|APP_MONITOR_PING_URL)|echo[^\n]*(APP_HEALTH_URL|APP_MONITOR_PING_URL)/
  );
});

test(
  "application monitor reports success only after validating the response",
  { skip: process.platform !== "linux" },
  () => {
    const { result, curlLog, argvLog } = runMonitor('{"status":"ok"}\n');

    assert.equal(result.status, 0, result.stderr);
    assert.match(curlLog, /\/check-id\/start/);
    assert.match(curlLog, /\/check-id\n/);
    assert.doesNotMatch(curlLog, /\/fail/);
    assert.doesNotMatch(argvLog, /check-id|monitor\.example/);
  }
);

test(
  "application monitor reports transport failures without leaking URLs",
  { skip: process.platform !== "linux" },
  () => {
    const { result, curlLog } = runMonitor("", "22");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /did not return HTTP success/);
    assert.match(curlLog, /\/check-id\/fail/);
    assert.doesNotMatch(result.stderr, /monitor\.example|app\.example/);
  }
);

test(
  "application monitor reports a missing success confirmation as failure",
  { skip: process.platform !== "linux" },
  () => {
    const { result, curlLog } = runMonitor('{"status":"ok"}\n', "0", "22");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /success confirmation failed/);
    assert.match(curlLog, /\/check-id\/fail/);
  }
);

test(
  "application monitor fails closed and reports an unexpected response",
  { skip: process.platform !== "linux" },
  () => {
    const { result, curlLog } = runMonitor('{"status":"degraded"}\n');

    assert.equal(result.status, 1);
    assert.match(result.stderr, /unexpected response/);
    assert.match(curlLog, /\/check-id\/start/);
    assert.match(curlLog, /\/check-id\/fail/);
    assert.doesNotMatch(result.stderr, /monitor\.example|app\.example/);
  }
);

test("application monitor service is non-root and hardened", () => {
  const service = read("deploy/systemd/supreme-app-health.service");

  assert.match(service, /User=deploy/);
  assert.match(service, /Group=deploy/);
  assert.match(service, /EnvironmentFile=\/etc\/supreme\/app-monitor\.env/);
  assert.match(service, /ExecStart=.*app-health-monitor\.sh/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /ProtectHome=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /CapabilityBoundingSet=/);
  assert.doesNotMatch(service, /DATABASE_URL|NEXTAUTH_SECRET|docker\.sock/);
});

test("application monitor timer detects missed executions", () => {
  const timer = read("deploy/systemd/supreme-app-health.timer");

  assert.match(timer, /OnCalendar=\*:0\/5/);
  assert.match(timer, /Persistent=true/);
  assert.match(timer, /RandomizedDelaySec=30s/);
  assert.match(timer, /FixedRandomDelay=true/);
});

test("production compose bounds application log storage", () => {
  const compose = read("compose.production.example.yml");

  assert.match(compose, /logging:\s+driver: json-file/);
  assert.match(compose, /max-size: "10m"/);
  assert.match(compose, /max-file: "5"/);
});

test("application monitoring runbook requires protected secrets and email alerts", () => {
  const runbook = read("docs/APP_MONITORING.md");

  assert.match(runbook, /período de 10 minutos/);
  assert.match(runbook, /tolerância de 10 minutos/);
  assert.match(runbook, /aproximadamente quatro execuções perdidas/);
  assert.match(runbook, /notificação por e-mail ativa/);
  assert.match(runbook, /stdout.*stderr/);
  assert.match(runbook, /logs --since 30m --tail 200 app/);
  assert.match(runbook, /max-size=10m/);
  assert.match(runbook, /sudoedit \/opt\/supreme\/runtime\/compose\.yml/);
  assert.match(runbook, /\(\n  set -Eeuo pipefail/);
  assert.match(runbook, /trap rollback_on_error EXIT/);
  assert.match(runbook, /config --quiet/);
  assert.match(runbook, /up -d --no-deps --no-build app/);
  assert.match(runbook, /compose\.yml\.before-app-logging/);
  assert.match(runbook, /ROLLBACK: OK/);
  assert.match(runbook, /LOG_ROTATION: OK/);
  assert.match(runbook, /rede externa independente/);
  assert.match(runbook, /root:deploy/);
  assert.match(runbook, /chmod 640/);
  assert.match(runbook, /systemd-analyze verify/);
  assert.match(runbook, /Result=success/);
  assert.match(runbook, /não derrube o app/);
  assert.match(runbook, /disable --now supreme-app-health\.timer/);
});
