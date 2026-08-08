# Supreme Engineering Guide

## Product

Supreme is a personal-development platform intended to become a commercial multi-user SaaS. The product combines habits, goals, workouts, books, vision planning, body/physical tracking, and personal finance. Future production deployment is planned on a Linux VPS using Docker. Authentication is expected to support Google OAuth, and the finance module is expected to integrate with Brazilian Open Finance through a provider abstraction rather than coupling business logic to one vendor.

## Shared agent rules

These rules apply to every coding agent working in this repository, including Codex and Claude Code.

### Source of truth

- Read this file before changing code.
- Inspect the current implementation before proposing a rewrite.
- Follow repository code and installed framework documentation over assumptions from model training.
- Keep task-specific decisions in GitHub issues, pull requests, or versioned documentation rather than relying on chat memory.

### Git workflow

- Never commit directly to `main`.
- Use one branch per task.
- Codex branches should use the `codex/` prefix.
- Claude branches should use the `claude/` prefix.
- Keep unrelated changes out of a task branch.
- Do not force-push shared branches unless the user explicitly requests it.
- Prefer a pull request reviewed by an agent other than the implementing agent before merge.
- Do not merge or deploy to production without explicit user authorization.
- Every pull request must include `## Resumo para o time` and `## Impacto` sections in concise, non-technical Portuguese. These sections feed the team-facing Discord notifications.
- Keep implementation details in the technical PR sections rather than putting jargon into the team summary.

### Security

- Treat Supreme as a multi-user product even during local development.
- Never trust a `userId` received from a browser or API client as proof of ownership.
- Scope user-owned reads and writes to the authenticated session.
- For child resources, verify ownership through their parent relationship before mutation.
- Never commit credentials, tokens, `.env` files, private keys, provider secrets, production database URLs, OAuth secrets, or Open Finance credentials.
- Do not read or expose production secrets unless the task explicitly requires it and the user authorizes the access.
- Avoid disabling security controls, TLS verification, authentication, authorization, or permission checks merely to make a test pass.
- Treat finance and personal-development data as sensitive user data.

### API and validation

- Validate untrusted API input at the boundary.
- Prefer Zod for request/schema validation when adding or refactoring validation.
- Return deliberate HTTP status codes and avoid leaking internal errors or secrets.
- Preserve authorization checks when refactoring routes.

### Database and Prisma

- Use Prisma migrations for persistent schema changes.
- Avoid destructive migrations unless the task explicitly calls for them and data-loss implications are documented.
- Monetary values must use decimal-safe storage; do not introduce floating-point storage for money.
- Prefer enums for genuinely closed domain values when doing so improves integrity.
- External provider records must have stable external identifiers and idempotent synchronization where appropriate.

### Authentication

- Preserve existing authentication methods unless removal is explicitly requested.
- Google OAuth support must coexist safely with credential authentication while that flow remains supported.
- OAuth-created users must not require a fabricated local password.
- Account-linking and email identity changes require explicit security review.

### Open Finance

- Keep Open Finance behind a provider interface/adapter.
- Do not couple core finance domain logic directly to Pluggy, Belvo, or another vendor.
- Preserve original provider transaction data and layer Supreme-specific categorization/metadata on top.
- Synchronization must be idempotent.
- Consent status, provider connection status, last synchronization time, and revocation must be modeled explicitly when the integration is implemented.
- Never place provider client secrets in source code or agent prompts.

### Quality gates

Before declaring an implementation complete:

1. Inspect `git diff` and ensure the scope matches the task.
2. Run `npm run lint` when JavaScript/TypeScript code changed.
3. Run `npm run build` for changes that can affect compilation or the production bundle.
4. Run relevant tests when tests exist.
5. Report any validation command that could not be run or did not pass.
6. Do not hide pre-existing failures; distinguish them from failures introduced by the task.

### Agent collaboration

- Do not edit the same task in the same worktree concurrently with another agent.
- Prefer separate Git worktrees for Codex and Claude Code.
- The implementing agent should leave a concise handoff in the PR: intent, key design choices, files changed, validation performed, and known risks.
- A reviewing agent should inspect the diff independently rather than assuming the implementation is correct.
- Reviews should prioritize correctness, authorization, data integrity, regressions, migration safety, and missing tests over stylistic preferences.

## Current stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Prisma 7
- NextAuth 4
- UploadThing
- ESLint

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
