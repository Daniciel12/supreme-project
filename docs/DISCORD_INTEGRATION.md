# Discord development notifications

Supreme can publish GitHub and CI updates to a Discord channel using a Discord incoming webhook.

## Recommended channel

Start with one private development channel:

```text
#supreme-dev
```

Split into dedicated PR/CI/deploy channels only if message volume later justifies it.

## Create the Discord webhook

In Discord:

1. Open the Supreme server.
2. Open the target channel settings.
3. Go to Integrations -> Webhooks.
4. Create a webhook for `#supreme-dev`.
5. Copy the webhook URL.

Treat the webhook URL as a secret. Do not paste it into issues, pull requests, prompts, source files, or committed `.env` files.

## Configure GitHub

In the `Daniciel12/supreme-project` repository:

1. Open Settings.
2. Open Secrets and variables -> Actions.
3. Create a repository secret named exactly:

```text
DISCORD_WEBHOOK_URL
```

4. Paste the Discord webhook URL as the secret value.

The workflow `.github/workflows/discord-notify.yml` skips notifications safely when the secret is not configured.

## Events currently published

The workflow publishes concise updates for:

- pull request opened;
- pull request reopened;
- pull request marked ready for review;
- pull request closed;
- pull request merged;
- completion of the `CI` workflow.

Messages include links back to GitHub so Discord remains an observability surface rather than the source of truth.

## Security boundaries

- Discord is notification-only in this phase.
- Discord cannot merge PRs, deploy production, or execute agent commands.
- GitHub remains the source of truth.
- The webhook secret exists only in GitHub Actions secrets (and Discord itself).
- Do not switch to `pull_request_target` merely to expose secrets to forked PRs; that event has a larger security surface.

## Future phases

Later iterations may add:

- agent task-start/task-complete messages;
- deployment notifications;
- richer Discord embeds;
- a bot with read commands such as `/supreme status`.

Bidirectional commands that mutate GitHub or production must have explicit authentication and human authorization controls.
