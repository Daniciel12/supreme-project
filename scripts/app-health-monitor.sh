#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

log() {
  printf '[app-health-monitor] %s\n' "$*" >&2
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_command curl
require_command grep
require_command mktemp
require_command rm

[[ -n "${APP_HEALTH_URL:-}" ]] || fail "APP_HEALTH_URL is required"
[[ -n "${APP_MONITOR_PING_URL:-}" ]] || fail "APP_MONITOR_PING_URL is required"

for variable_name in APP_HEALTH_URL APP_MONITOR_PING_URL; do
  variable_value="${!variable_name}"
  [[ "$variable_value" != *$'\n'* && "$variable_value" != *$'\r'* ]] ||
    fail "$variable_name must be a single line"
  [[ "$variable_value" =~ ^https://[^[:space:]]+$ ]] ||
    fail "$variable_name must be an HTTPS URL"
  [[ "$variable_value" != *\"* && "$variable_value" != *\\* ]] ||
    fail "$variable_name contains unsupported URL characters"
done

ping_base="${APP_MONITOR_PING_URL%/}"
response_file="$(mktemp)"
completed=false

send_signal() {
  local suffix="$1"
  local message="$2"

  printf 'url = "%s"\n' "${ping_base}${suffix}" | \
    curl --fail --silent --show-error \
      --config - \
      --retry 1 \
      --retry-all-errors \
      --connect-timeout 3 \
      --max-time 10 \
      --request POST \
      --data-raw "$message" >/dev/null 2>&1
}

cleanup() {
  local status=$?
  rm -f -- "$response_file"

  if [[ "$status" -ne 0 && "$completed" != true ]]; then
    if ! send_signal "/fail" "Supreme application health check failed"; then
      log "WARNING: monitoring failure signal also failed"
    fi
  fi
}

trap cleanup EXIT

if ! send_signal "/start" "Supreme application health check started"; then
  log "WARNING: monitoring start signal failed; public health will still be checked"
fi

if ! curl --fail --silent --show-error \
  --retry 2 \
  --retry-all-errors \
  --retry-delay 2 \
  --connect-timeout 3 \
  --max-time 10 \
  --max-filesize 1024 \
  --output "$response_file" \
  "$APP_HEALTH_URL"; then
  fail "public health endpoint did not return HTTP success"
fi

if ! grep --extended-regexp --quiet \
  '^[[:space:]]*\{[[:space:]]*"status"[[:space:]]*:[[:space:]]*"ok"[[:space:]]*\}[[:space:]]*$' \
  "$response_file"; then
  fail "public health endpoint returned an unexpected response"
fi

send_signal "" "Supreme application health check completed" ||
  fail "public health passed, but monitoring success confirmation failed"

completed=true
log "public health and monitoring confirmation completed"
