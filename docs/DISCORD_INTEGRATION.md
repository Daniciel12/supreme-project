# Discord development notifications

Supreme publishes GitHub and CI updates to Discord through an incoming webhook named `Supreme Dev` in `#supreme-dev`.

The Discord channel is intended for the whole team, including people who do not work directly with code. Messages should therefore explain the project impact first and leave technical details behind a GitHub link.

## Message design

Notifications use Discord embeds instead of raw GitHub text. Each update should answer three questions:

1. **O que mudou?** A short, non-technical summary.
2. **Qual é o impacto?** What changes for users, operations, security, or the team.
3. **Qual é o próximo passo?** What happens next and whether anyone needs to act.

Technical branch names and internal GitHub status strings should not be the main message. The embed title links to GitHub for anyone who needs implementation details.

## Pull request communication standard

Every pull request should contain these sections:

```markdown
## Resumo para o time

Explique em 1 a 3 frases, sem jargão técnico, o que muda e por que isso importa.

## Impacto

Explique o efeito esperado para usuários, operação, segurança ou equipe.
```

The repository template at `.github/pull_request_template.md` provides these fields automatically for manually created PRs.

The Discord workflow extracts `Resumo para o time` and `Impacto` from the PR body. If the summary is absent, it falls back to the PR title. Missing impact is shown explicitly instead of inventing information.

## Status shown in Discord

Pull request events are translated to human-readable Portuguese messages:

- `opened` -> **Nova atualização em desenvolvimento**;
- `reopened` -> **Atualização retomada**;
- `ready_for_review` -> **Atualização pronta para revisão**;
- merged PR -> **Atualização concluída**;
- closed without merge -> **Atualização encerrada**.

CI results are simplified to:

- success -> **Verificações automáticas aprovadas**;
- failure -> **Verificações automáticas com falha**;
- cancelled -> **Verificação automática cancelada**.

The CI message explains the operational consequence instead of exposing individual command names as the primary content.

## Create the Discord webhook

In Discord:

1. Open the Supreme server.
2. Open the target channel settings.
3. Go to Integrations -> Webhooks.
4. Create a webhook named `Supreme Dev` for `#supreme-dev`.
5. Copy the webhook URL.

Treat the webhook URL as a secret. Do not paste it into issues, pull requests, prompts, source files, or committed `.env` files.

## Configure GitHub

In `Daniciel12/supreme-project`:

1. Open Settings.
2. Open Secrets and variables -> Actions.
3. Create a repository secret named exactly `DISCORD_WEBHOOK_URL`.
4. Paste the Discord webhook URL as the secret value.

The workflow `.github/workflows/discord-notify.yml` skips notifications safely when the secret is not configured.

## Security boundaries

- Discord is notification-only.
- Discord cannot merge PRs, deploy production, or execute agent commands.
- GitHub remains the source of truth.
- The webhook secret exists only in GitHub Actions secrets and Discord itself.
- Event metadata is passed to shell steps through environment variables rather than interpolated directly into shell source.
- Discord mentions are disabled through `allowed_mentions`.
- Pull request text is length-limited before it is sent to Discord.
- Do not switch to `pull_request_target` merely to expose secrets to forked PRs.

## Future phases

Later iterations may add:

- agent task-start/task-complete updates;
- deployment notifications;
- release summaries;
- a read-only bot command such as `/supreme status`.

Bidirectional commands that mutate GitHub or production must have explicit authentication and human authorization controls.
