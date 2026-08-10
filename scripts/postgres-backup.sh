#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

log() {
  printf '[postgres-backup] %s\n' "$*" >&2
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_value() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "$name is required"
}

validate_single_line() {
  local name="$1"
  local value="${!name}"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || fail "$name must be a single line"
}

require_command date
require_command docker
require_command mktemp
require_command rclone
require_command sha256sum

require_value DATABASE_URL
require_value POSTGRES_DOCKER_NETWORK
require_value RCLONE_DESTINATION

POSTGRES_CLIENT_IMAGE="${POSTGRES_CLIENT_IMAGE:-postgres:16}"

validate_single_line DATABASE_URL
validate_single_line POSTGRES_DOCKER_NETWORK
validate_single_line POSTGRES_CLIENT_IMAGE
validate_single_line RCLONE_DESTINATION

[[ "$POSTGRES_DOCKER_NETWORK" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] ||
  fail "POSTGRES_DOCKER_NETWORK contains unsupported characters"
[[ "$POSTGRES_CLIENT_IMAGE" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]] ||
  fail "POSTGRES_CLIENT_IMAGE contains unsupported characters"
[[ "$RCLONE_DESTINATION" =~ ^[A-Za-z0-9._-]+:.+ ]] ||
  fail "RCLONE_DESTINATION must use an rclone remote, for example remote:supreme/postgres"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_filename="supreme-${timestamp}.dump"
checksum_filename="${backup_filename}.sha256"
temporary_directory="$(mktemp -d)"
dump_path="${temporary_directory}/${backup_filename}"
checksum_path="${temporary_directory}/${checksum_filename}"
remote_base="${RCLONE_DESTINATION%/}"
remote_dump="${remote_base}/${backup_filename}"
remote_checksum="${remote_base}/${checksum_filename}"

cleanup() {
  local status=$?
  if [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf -- "$temporary_directory"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

log "creating a PostgreSQL dump in a private temporary directory"
if ! docker run --rm \
  --network "$POSTGRES_DOCKER_NETWORK" \
  --env DATABASE_URL \
  "$POSTGRES_CLIENT_IMAGE" \
  sh -Eeuc 'exec pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 --no-owner --no-privileges' \
  >"$dump_path"; then
  fail "pg_dump failed"
fi

[[ -s "$dump_path" ]] || fail "pg_dump produced an empty artifact"

log "validating archive structure before upload"
docker run --rm --interactive "$POSTGRES_CLIENT_IMAGE" \
  pg_restore --list <"$dump_path" >/dev/null || fail "pg_restore rejected the dump archive"

dump_hash="$(sha256sum "$dump_path")"
dump_hash="${dump_hash%% *}"
[[ "$dump_hash" =~ ^[a-f0-9]{64}$ ]] || fail "could not calculate a SHA-256 checksum"
printf '%s  %s\n' "$dump_hash" "$backup_filename" >"$checksum_path"

log "uploading the dump and checksum to external storage"
rclone copyto --immutable "$dump_path" "$remote_dump"
rclone copyto --immutable "$checksum_path" "$remote_checksum"

verification_directory="${temporary_directory}/roundtrip"
mkdir "$verification_directory"
rclone copyto "$remote_dump" "${verification_directory}/${backup_filename}"
rclone copyto "$remote_checksum" "${verification_directory}/${checksum_filename}"

read -r uploaded_hash uploaded_name <"${verification_directory}/${checksum_filename}"
uploaded_name="${uploaded_name#\*}"
[[ "$uploaded_name" == "$backup_filename" ]] || fail "uploaded checksum references an unexpected object"
[[ "$uploaded_hash" == "$dump_hash" ]] || fail "uploaded checksum changed during transfer"

roundtrip_hash="$(sha256sum "${verification_directory}/${backup_filename}")"
roundtrip_hash="${roundtrip_hash%% *}"
[[ "$roundtrip_hash" == "$dump_hash" ]] || fail "external storage round-trip checksum failed"

log "backup upload and round-trip verification completed"
printf '%s\n' "$backup_filename"
