# Agendamento e monitoramento do backup PostgreSQL

Este procedimento ativa o backup externo diário somente depois de uma execução manual de backup e restore descartável bem-sucedida. Ele não automatiza restore e não recebe uma URL de banco de destino.

## Decisões operacionais

- execução diária às 03:00 UTC, com atraso aleatório estável de até 15 minutos;
- execução perdida durante indisponibilidade da VPS é retomada por `Persistent=true`;
- o serviço usa o usuário operacional `deploy`, sem root, e carrega secrets apenas de arquivos locais protegidos;
- início, sucesso e falha são enviados ao Healthchecks.io; o check deve notificar o responsável por e-mail;
- falha no backup deixa o serviço em estado `failed` e envia o sinal `/fail` sem anexar ambiente, dump ou connection string;
- o script de backup continua responsável pelo checksum SHA-256 e pelo round-trip no storage externo.

## Arquivos locais protegidos

O unit file carrega `DATABASE_URL` de `/opt/supreme/runtime/.env.production`, sem duplicar a credencial. Crie `/etc/supreme/backup.env` apenas com a configuração operacional:

```dotenv
POSTGRES_DOCKER_NETWORK=runtime_backend
POSTGRES_CLIENT_IMAGE=postgres:16-bookworm
RCLONE_DESTINATION=supreme-r2:supreme-postgres-backups
RCLONE_CONFIG=/home/deploy/.config/rclone/rclone.conf
RESTORE_TMPFS_SIZE=2g
```

Crie um check diário no Healthchecks.io com período de 24 horas, tolerância suficiente para a janela de 15 minutos e notificação por e-mail. Salve a URL secreta do ping em `/etc/supreme/backup-monitor.env`:

```dotenv
HEALTHCHECKS_PING_URL=https://hc-ping.com/substituir-pela-url-secreta
```

Proteja ambos os arquivos e nunca publique seu conteúdo:

```bash
sudo chown root:deploy /etc/supreme/backup.env /etc/supreme/backup-monitor.env
sudo chmod 640 /etc/supreme/backup.env /etc/supreme/backup-monitor.env
```

A URL de ping funciona como credencial. Se aparecer em terminal compartilhado, issue, PR, captura ou log público, gere uma nova URL antes de ativar o timer.

## Instalar e validar

Use um checkout fixado em SHA aprovado. Copie os units versionados, recarregue o `systemd` e execute primeiro o serviço manualmente:

```bash
sudo systemd-analyze verify \
  deploy/systemd/supreme-postgres-backup.service \
  deploy/systemd/supreme-postgres-backup.timer

sudo install -o root -g root -m 0644 \
  deploy/systemd/supreme-postgres-backup.service \
  /etc/systemd/system/supreme-postgres-backup.service

sudo install -o root -g root -m 0644 \
  deploy/systemd/supreme-postgres-backup.timer \
  /etc/systemd/system/supreme-postgres-backup.timer

sudo systemctl daemon-reload
sudo systemctl start supreme-postgres-backup.service
sudo systemctl status supreme-postgres-backup.service --no-pager
```

Confirme no storage um novo dump e seu `.sha256`, e confirme no monitor os sinais de início e sucesso. Só então ative o timer:

```bash
sudo systemctl enable --now supreme-postgres-backup.timer
systemctl list-timers supreme-postgres-backup.timer --no-pager
```

Consulte logs sem imprimir o ambiente:

```bash
journalctl -u supreme-postgres-backup.service --since today --no-pager
```

Para testar alertas sem provocar falha no banco ou no storage, pause temporariamente o check no painel, use a função de teste da integração de e-mail e reative o check. Não altere `DATABASE_URL`, não renomeie o remote e não bloqueie produção deliberadamente para testar notificações.

## Retenção e proteção no Cloudflare R2

No bucket dedicado de backups, crie duas regras aplicadas a todos os objetos, sem prefixo:

1. bucket lock `lock-postgres-backups-7d`, com retenção por 7 dias, para impedir exclusão ou sobrescrita prematura;
2. lifecycle `expire-postgres-backups-30d`, para expirar objetos após 30 dias.

A lifecycle removerá tanto o dump quanto o checksum correspondente. O lock tem precedência durante seus 7 dias; depois disso, o objeto permanece disponível até a expiração de 30 dias. Não configure essas regras em um bucket compartilhado.

Antes de salvar, confirme visualmente:

- bucket dedicado correto;
- sem prefixo, pois todo o bucket contém somente backups PostgreSQL;
- lock por 7 dias;
- expiração após 30 dias;
- nenhuma ação para apagar o bucket;
- nenhum secret na descrição da regra.

Exclusões por lifecycle são permanentes. Regras de lock impedem exclusão e sobrescrita durante a retenção e também afetam objetos já existentes. Registre as políticas na issue operacional, mas não marque o gate como concluído antes de validar o timer, o monitor por e-mail, o lock e a lifecycle no bucket real.

## Desativação segura

Desativar o timer não remove backups existentes:

```bash
sudo systemctl disable --now supreme-postgres-backup.timer
```

Não automatize a exclusão remota nos scripts e não automatize restore de produção.
