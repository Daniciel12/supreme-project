#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

log() {
  printf '[postgres-backup-job] %s\n' "$*" >&2
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_command bash
require_command curl

[[ -n "${HEALTHCHECKS_PING_URL:-}" ]] || fail "HEALTHCHECKS_PING_URL is required"
[[ "$HEALTHCHECKS_PING_URL" != *$'\n'* && "$HEALTHCHECKS_PING_URL" != *$'\r'* ]] ||
  fail "HEALTHCHECKS_PING_URL must be a single line"
[[ "$HEALTHCHECKS_PING_URL" =~ ^https://[^[:space:]]+$ ]] ||
  fail "HEALTHCHECKS_PING_URL must be an HTTPS URL"

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ping_base="${HEALTHCHECKS_PING_URL%/}"

send_signal() {
  local suffix="$1"
  local message="$2"

  curl --fail --silent --show-error \
    --retry 2 \
    --connect-timeout 5 \
    --max-time 15 \
    --request POST \
    --data-raw "$message" \
    "${ping_base}${suffix}" >/dev/null 2>&1
}

if ! send_signal "/start" "Supreme PostgreSQL backup started"; then
  log "WARNING: monitoring start signal failed; backup will still run"
fi

backup_status=0
backup_object="$(bash "${script_directory}/postgres-backup.sh")" || backup_status=$?

if [[ "$backup_status" -ne 0 ]]; then
  if ! send_signal "/fail" "Supreme PostgreSQL backup failed"; then
    log "WARNING: monitoring failure signal also failed"
  fi
  fail "backup command failed with status $backup_status"
fi

[[ "$backup_object" =~ ^supreme-[0-9]{8}T[0-9]{6}Z\.dump$ ]] || {
  send_signal "/fail" "Supreme PostgreSQL backup returned an invalid object name" || true
  fail "backup returned an unexpected object name"
}

send_signal "" "Supreme PostgreSQL backup completed" ||
  fail "backup completed, but monitoring success confirmation failed"

log "backup and monitoring confirmation completed"
printf '%s\n' "$backup_object"
