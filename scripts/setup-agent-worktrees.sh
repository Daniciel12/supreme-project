#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PARENT="$(dirname "$ROOT")"
ORIGIN_URL="$(git remote get-url origin)"
REPO_NAME="$(basename "${ORIGIN_URL%.git}")"

if [ -z "$REPO_NAME" ]; then
  echo "Unable to determine repository name from origin remote URL: $ORIGIN_URL" >&2
  exit 1
fi

CODEX_DIR="${PARENT}/${REPO_NAME}-codex"
CLAUDE_DIR="${PARENT}/${REPO_NAME}-claude"

cd "$ROOT"

echo "Fetching origin..."
git fetch origin

if [ -e "$CODEX_DIR" ]; then
  echo "Skipping Codex worktree: $CODEX_DIR already exists."
else
  echo "Creating Codex worktree at $CODEX_DIR"
  git worktree add "$CODEX_DIR" -b codex/workspace origin/main
fi

if [ -e "$CLAUDE_DIR" ]; then
  echo "Skipping Claude worktree: $CLAUDE_DIR already exists."
else
  echo "Creating Claude worktree at $CLAUDE_DIR"
  git worktree add "$CLAUDE_DIR" -b claude/workspace origin/main
fi

cat <<EOF

Agent worktrees are ready:

  Main:   $ROOT
  Codex:  $CODEX_DIR
  Claude: $CLAUDE_DIR

Recommended usage:

  cd "$CODEX_DIR" && codex
  cd "$CLAUDE_DIR" && claude

For real tasks, create a task-specific branch from origin/main instead of reusing the workspace branch indefinitely.
EOF
