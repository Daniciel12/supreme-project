#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

log() {
  printf '[postgres-restore-test] %s\n' "$*" >&2
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

validate_single_line() {
  local name="$1"
  local value="${!name}"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || fail "$name must be a single line"
}

[[ $# -le 1 ]] || fail "usage: postgres-restore-test.sh [backup-object]"

BACKUP_OBJECT="${1:-${BACKUP_OBJECT:-}}"
POSTGRES_CLIENT_IMAGE="${POSTGRES_CLIENT_IMAGE:-postgres:16}"
RCLONE_DESTINATION="${RCLONE_DESTINATION:-}"
RESTORE_TMPFS_SIZE="${RESTORE_TMPFS_SIZE:-2g}"

[[ -n "$BACKUP_OBJECT" ]] || fail "BACKUP_OBJECT is required"
[[ -n "$RCLONE_DESTINATION" ]] || fail "RCLONE_DESTINATION is required"

require_command date
require_command docker
require_command mktemp
require_command rclone
require_command sha256sum

validate_single_line BACKUP_OBJECT
validate_single_line POSTGRES_CLIENT_IMAGE
validate_single_line RCLONE_DESTINATION
validate_single_line RESTORE_TMPFS_SIZE

[[ "$BACKUP_OBJECT" =~ ^supreme-[0-9]{8}T[0-9]{6}Z\.dump$ ]] ||
  fail "BACKUP_OBJECT must be an exact Supreme backup filename"
[[ "$POSTGRES_CLIENT_IMAGE" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]] ||
  fail "POSTGRES_CLIENT_IMAGE contains unsupported characters"
[[ "$RCLONE_DESTINATION" =~ ^[A-Za-z0-9._-]+:.+ ]] ||
  fail "RCLONE_DESTINATION must use an rclone remote"
[[ "$RESTORE_TMPFS_SIZE" =~ ^[1-9][0-9]*[mMgG]$ ]] ||
  fail "RESTORE_TMPFS_SIZE must use a value such as 512m or 2g"

checksum_object="${BACKUP_OBJECT}.sha256"
temporary_directory="$(mktemp -d)"
dump_path="${temporary_directory}/${BACKUP_OBJECT}"
checksum_path="${temporary_directory}/${checksum_object}"
remote_base="${RCLONE_DESTINATION%/}"
container_name="supreme-restore-test-$(date -u +%Y%m%d%H%M%S)-$$"
restore_database="supreme_restore_test"
container_started=0

cleanup() {
  local status=$?
  if [[ "$container_started" -eq 1 ]]; then
    docker rm --force "$container_name" >/dev/null 2>&1 || true
  fi
  if [[ -n "${temporary_directory:-}" && -d "$temporary_directory" ]]; then
    rm -rf -- "$temporary_directory"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

log "downloading the selected dump and checksum from external storage"
rclone copyto "${remote_base}/${BACKUP_OBJECT}" "$dump_path"
rclone copyto "${remote_base}/${checksum_object}" "$checksum_path"

read -r expected_hash expected_name <"$checksum_path"
expected_name="${expected_name#\*}"
[[ "$expected_hash" =~ ^[a-f0-9]{64}$ ]] || fail "checksum file is invalid"
[[ "$expected_name" == "$BACKUP_OBJECT" ]] || fail "checksum references an unexpected object"

actual_hash="$(sha256sum "$dump_path")"
actual_hash="${actual_hash%% *}"
[[ "$actual_hash" == "$expected_hash" ]] || fail "downloaded dump checksum does not match"

log "validating archive structure before restore"
docker run --rm --interactive "$POSTGRES_CLIENT_IMAGE" \
  pg_restore --list <"$dump_path" >/dev/null || fail "pg_restore rejected the dump archive"

log "starting an isolated PostgreSQL container with disposable storage"
docker run --detach \
  --name "$container_name" \
  --network none \
  --tmpfs "/var/lib/postgresql/data:rw,nosuid,nodev,size=${RESTORE_TMPFS_SIZE}" \
  --volume "${temporary_directory}:/backup:ro" \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  "$POSTGRES_CLIENT_IMAGE" >/dev/null
container_started=1

ready=0
for _attempt in $(seq 1 60); do
  if docker exec "$container_name" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" -eq 1 ]] || fail "disposable PostgreSQL did not become ready"

docker exec "$container_name" createdb \
  --username postgres \
  --template template0 \
  --encoding UTF8 \
  "$restore_database"

log "restoring only into the disposable database"
docker exec "$container_name" pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --username postgres \
  --dbname "$restore_database" \
  "/backup/${BACKUP_OBJECT}"

prisma_table_present="$(docker exec "$container_name" psql \
  --username postgres \
  --dbname "$restore_database" \
  --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command "SELECT to_regclass('public.\"_prisma_migrations\"') IS NOT NULL;")"
prisma_table_present="${prisma_table_present//$'\r'/}"
[[ "$prisma_table_present" == "t" ]] || fail "restored database is missing Prisma migration history"

application_table_count="$(docker exec "$container_name" psql \
  --username postgres \
  --dbname "$restore_database" \
  --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command "SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';")"
application_table_count="${application_table_count//$'\r'/}"
[[ "$application_table_count" =~ ^[1-9][0-9]*$ ]] || fail "restored database has no application tables"

incomplete_migration_count="$(docker exec "$container_name" psql \
  --username postgres \
  --dbname "$restore_database" \
  --tuples-only --no-align --set ON_ERROR_STOP=1 \
  --command 'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;')"
incomplete_migration_count="${incomplete_migration_count//$'\r'/}"
[[ "$incomplete_migration_count" == "0" ]] || fail "restored database contains an incomplete migration"

log "restore, schema checks and cleanup completed successfully"
