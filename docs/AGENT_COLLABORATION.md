# Codex + Claude collaboration

This repository is configured so Codex and Claude Code can work on the same project without sharing the same working tree.

## Shared instructions

Both agents must follow `AGENTS.md`.

Claude reads `CLAUDE.md`, which imports `AGENTS.md`.

Codex reads `AGENTS.md` directly when the repository is trusted.

## Project safety defaults

Codex project configuration lives in `.codex/config.toml` and uses:

- `approval_policy = "on-request"`
- `sandbox_mode = "workspace-write"`

Claude project configuration lives in `.claude/settings.json`. It allows normal validation commands and blocks access to common environment/secret paths, force-pushes, and sudo commands.

These settings are guardrails, not a substitute for reviewing commands that request elevated permissions.

## Initial local setup on Windows / PowerShell

The Supreme repository is currently being used from native Windows/PowerShell, so this is the preferred setup path.

From the main clone:

```powershell
Set-Location C:\path\to\supreme-project
git switch main
git pull --ff-only origin main
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-agent-worktrees.ps1
```

No `chmod` step is required on Windows.

The script creates sibling worktrees:

```text
supreme-project\        main working tree
supreme-project-codex\  Codex workspace
supreme-project-claude\ Claude workspace
```

Start the agents in separate PowerShell terminals:

```powershell
Set-Location ..\supreme-project-codex
codex
```

```powershell
Set-Location ..\supreme-project-claude
claude
```

## Initial local setup on Linux / WSL / macOS

From the main clone:

```bash
cd /path/to/supreme-project
git switch main
git pull --ff-only origin main
chmod +x scripts/setup-agent-worktrees.sh
./scripts/setup-agent-worktrees.sh
```

Start the agents in separate terminals:

```bash
cd ../supreme-project-codex
codex
```

```bash
cd ../supreme-project-claude
claude
```

## Task branches

The permanent `codex/workspace` and `claude/workspace` branches are only bootstrap workspaces. For actual work, start each task from an up-to-date `origin/main`.

Codex example on PowerShell:

```powershell
Set-Location ..\supreme-project-codex
git fetch origin
git switch -C codex/security-checkins origin/main
```

Claude example on PowerShell:

```powershell
Set-Location ..\supreme-project-claude
git fetch origin
git switch -C claude/google-oauth origin/main
```

The equivalent Git commands are the same on Linux/WSL/macOS.

Do not assign the same task to both agents as implementers at the same time.

## Recommended lifecycle

1. Define a small task with acceptance criteria.
2. Choose one implementing agent.
3. Create a task-specific branch from `origin/main`.
4. Let the implementing agent inspect the repository and make the change.
5. Run required validation commands from `AGENTS.md`.
6. Push the task branch and open a pull request.
7. Have the other agent review the diff independently.
8. Address review findings.
9. Merge only after human approval and passing CI when CI is available.

## Handoff format

Every implementation should leave the reviewer these details in the pull request:

```text
Intent:

Key decisions:

Files changed:

Validation performed:

Known risks / follow-up:
```

## Suggested division of work

A useful default is:

- Codex: security, Prisma/domain modeling, API authorization, Open Finance architecture.
- Claude: UI work, Google OAuth implementation, Docker/infrastructure, focused refactors.
- Reviewer: whichever agent did not implement the task.

This is only a default. Task fit matters more than a fixed ownership table.

## First validation

Before giving either agent a real implementation task, verify they both read the project instructions.

Prompt for Codex:

```text
Read AGENTS.md and inspect the repository. Do not change files. Summarize the project, the security rules, Git workflow, and validation commands you must follow.
```

Prompt for Claude:

```text
Read CLAUDE.md and all imported instructions. Do not change files. Summarize the project, the security rules, Git workflow, and validation commands you must follow.
```

Their answers should agree on the important engineering constraints.

## Important boundaries

- Do not give either agent unattended production SSH access.
- Do not commit `.env` files or secrets.
- Do not use `--dangerously-skip-permissions` as the normal Claude workflow.
- Do not use unrestricted Codex sandbox access as the normal workflow.
- Do not let agents merge or deploy to production without explicit human authorization.
