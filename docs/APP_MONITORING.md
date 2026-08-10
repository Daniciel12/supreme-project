# Monitoramento e alertas da aplicação

Este procedimento monitora a URL HTTPS pública do Supreme a cada cinco minutos.
Ele cobre aplicação, PostgreSQL, DNS, TLS e reverse proxy porque usa o mesmo
endpoint público acessado pelos usuários. O monitor não recebe credenciais de
usuário nem acesso ao banco.

## Modelo operacional

- o `systemd` executa uma verificação a cada cinco minutos;
- o endpoint precisa retornar HTTP `200` e exatamente o estado genérico
  `{"status":"ok"}`;
- início, sucesso e falha são enviados a um check dedicado no Healthchecks.io;
- uma falha explícita envia `/fail` imediatamente;
- ausência de pings, inclusive quando a VPS inteira fica indisponível, é
  detectada pelo período e pela tolerância configurados no serviço externo;
- a URL secreta de ping chega ao `curl` pela entrada padrão e não aparece nos
  argumentos do processo;
- logs nunca incluem a resposta HTTP, a URL secreta de ping ou variáveis de
  ambiente.

Esse monitor confirma disponibilidade. Ele não substitui métricas de negócio,
rastreamento distribuído ou uma futura plataforma de captura de exceções.
Como a sonda roda na própria VPS, ela também não substitui uma sonda de uptime
em uma rede externa independente. A ausência de pings detecta a queda completa
do host, mas uma indisponibilidade parcial restrita ao tráfego de entrada pode
exigir confirmação externa adicional.

## Logs operacionais

A aplicação escreve erros em `stdout`/`stderr`, capturados pelo driver de logs
do Docker. A baseline de Compose limita esses arquivos a cinco segmentos de
10 MiB para evitar crescimento irrestrito no disco da VPS. O Compose real da
VPS deve manter a mesma configuração.

Consulte somente a janela necessária para o diagnóstico:

```bash
docker compose \
  --env-file /opt/supreme/runtime/.env.production \
  -f /opt/supreme/runtime/compose.yml \
  logs --since 30m --tail 200 app

journalctl -u caddy --since "30 minutes ago" --no-pager
```

Logs podem conter identificadores e caminhos acessados. Não publique a saída
integral em issues e nunca use `docker inspect` para copiar o ambiente do
container. Redija qualquer dado pessoal antes de compartilhar um trecho.

## Criar o check externo

No mesmo projeto do Healthchecks.io usado pelos backups, crie um check separado
chamado `Supreme Application` com:

- período de 10 minutos;
- tolerância de 10 minutos;
- fuso UTC;
- notificação por e-mail ativa.

O timer envia pings a cada cinco minutos. O período maior evita alerta por uma
única execução atrasada. Período e tolerância são somados: sem um sinal de
falha explícito, o alerta de ausência ocorre cerca de 20 minutos após o último
sucesso, aproximadamente quatro execuções perdidas. Depois de um sinal de
início, a conclusão também precisa chegar dentro dos 10 minutos de tolerância.

Crie `/etc/supreme/app-monitor.env` somente na VPS:

```dotenv
APP_HEALTH_URL=https://supreme.example.com/api/health
APP_MONITOR_PING_URL=https://hc-ping.com/substituir-pela-url-secreta
```

Use a URL HTTPS pública real em `APP_HEALTH_URL`. A URL de ping funciona como
credencial: nunca a publique em chat, issue, PR, captura de tela ou logs.

Proteja o arquivo sem alterar os secrets da aplicação:

```bash
sudo chown root:deploy /etc/supreme/app-monitor.env
sudo chmod 640 /etc/supreme/app-monitor.env
```

## Instalar e validar

Use um checkout fixado em SHA aprovado. Verifique e instale os units
versionados:

```bash
sudo systemd-analyze verify \
  deploy/systemd/supreme-app-health.service \
  deploy/systemd/supreme-app-health.timer

sudo install -o root -g root -m 0644 \
  deploy/systemd/supreme-app-health.service \
  /etc/systemd/system/supreme-app-health.service

sudo install -o root -g root -m 0644 \
  deploy/systemd/supreme-app-health.timer \
  /etc/systemd/system/supreme-app-health.timer

sudo systemctl daemon-reload
sudo systemctl start supreme-app-health.service

systemctl show supreme-app-health.service \
  --property=Result \
  --property=ExecMainStatus \
  --property=ActiveState
```

O resultado esperado da execução manual é `Result=success`, `ExecMainStatus=0`
e `ActiveState=inactive`, pois o serviço é `oneshot`. Confirme também que o
check externo recebeu início e sucesso.

Confirme que a rotação de logs está ativa no container real sem imprimir seu
ambiente:

```bash
APP_CONTAINER_ID="$(
  docker compose \
    --env-file /opt/supreme/runtime/.env.production \
    -f /opt/supreme/runtime/compose.yml \
    ps -q app
)"

docker inspect \
  --format '{{json .HostConfig.LogConfig}}' \
  "$APP_CONTAINER_ID"
```

O resultado deve indicar `json-file`, `max-size=10m` e `max-file=5`.

Se a rotação ainda não estiver configurada, faça uma cópia protegida e edite o
Compose real:

```bash
sudo cp --preserve=all \
  /opt/supreme/runtime/compose.yml \
  /opt/supreme/runtime/compose.yml.before-app-logging

sudoedit /opt/supreme/runtime/compose.yml
```

Adicione este bloco dentro do serviço `app`, no mesmo nível de `ports` e
`security_opt`:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Valide sem imprimir a configuração expandida, preserve a tag atualmente ativa
e recrie somente o app usando o bloco isolado abaixo. Qualquer falha valida e
restaura automaticamente o Compose anterior, recria a mesma imagem e aguarda o
health do rollback. O `exit` ocorre somente no subshell, sem encerrar a sessão
SSH do operador:

```bash
(
  set -Eeuo pipefail

  RUNTIME_ENV=/opt/supreme/runtime/.env.production
  RUNTIME_COMPOSE=/opt/supreme/runtime/compose.yml
  RUNTIME_BACKUP=/opt/supreme/runtime/compose.yml.before-app-logging

  wait_for_health() {
    for attempt in $(seq 1 15); do
      if curl --fail --silent --show-error \
        --connect-timeout 1 \
        --max-time 2 \
        http://127.0.0.1:3000/api/health >/dev/null; then
        return 0
      fi
      sleep 2
    done
    return 1
  }

  rollback_required=false

  rollback_on_error() {
    status=$?
    trap - EXIT

    if [[ "$status" -ne 0 ]]; then
      echo 'Falha ao aplicar rotação; iniciando rollback automático.' >&2

      if ! sudo cp --preserve=all "$RUNTIME_BACKUP" "$RUNTIME_COMPOSE"; then
        echo 'CRÍTICO: não foi possível restaurar o Compose anterior.' >&2
        exit 1
      fi

      if [[ "$rollback_required" == true ]]; then
        if ! SUPREME_IMAGE_TAG="$CURRENT_TAG" \
          docker compose --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" \
            config --quiet; then
          echo 'CRÍTICO: o Compose restaurado é inválido.' >&2
          exit 1
        fi

        if ! SUPREME_IMAGE_TAG="$CURRENT_TAG" \
          docker compose --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" \
            up -d --no-deps --no-build app; then
          echo 'CRÍTICO: não foi possível recriar o app anterior.' >&2
          exit 1
        fi

        if ! wait_for_health; then
          echo 'CRÍTICO: o app não ficou saudável após o rollback.' >&2
          exit 1
        fi

        echo 'ROLLBACK: OK' >&2
      else
        echo 'Compose anterior restaurado; container não foi alterado.' >&2
      fi
    fi

    exit "$status"
  }

  trap rollback_on_error EXIT

  APP_CONTAINER_ID="$(
    docker compose --env-file "$RUNTIME_ENV" -f "$RUNTIME_BACKUP" ps -q app
  )"
  CURRENT_IMAGE="$(
    docker inspect --format '{{.Config.Image}}' "$APP_CONTAINER_ID"
  )"
  CURRENT_TAG="${CURRENT_IMAGE##*:}"
  rollback_required=true

  SUPREME_IMAGE_TAG="$CURRENT_TAG" \
  docker compose --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" \
    config --quiet

  SUPREME_IMAGE_TAG="$CURRENT_TAG" \
  docker compose --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" \
    up -d --no-deps --no-build app

  wait_for_health

  APP_CONTAINER_ID="$(
    docker compose --env-file "$RUNTIME_ENV" -f "$RUNTIME_COMPOSE" ps -q app
  )"
  LOG_DRIVER="$(
    docker inspect --format '{{.HostConfig.LogConfig.Type}}' "$APP_CONTAINER_ID"
  )"
  LOG_MAX_SIZE="$(
    docker inspect \
      --format '{{index .HostConfig.LogConfig.Config "max-size"}}' \
      "$APP_CONTAINER_ID"
  )"
  LOG_MAX_FILE="$(
    docker inspect \
      --format '{{index .HostConfig.LogConfig.Config "max-file"}}' \
      "$APP_CONTAINER_ID"
  )"

  [[ "$LOG_DRIVER" == json-file ]]
  [[ "$LOG_MAX_SIZE" == 10m ]]
  [[ "$LOG_MAX_FILE" == 5 ]]

  rollback_required=false
  echo 'LOG_ROTATION: OK'
)
```

Remova a cópia anterior somente depois de confirmar health, smoke autenticado e
`LOG_ROTATION: OK` no container recriado.

Ative o timer somente depois dessa confirmação:

```bash
sudo systemctl enable --now supreme-app-health.timer

systemctl is-enabled supreme-app-health.timer
systemctl is-active supreme-app-health.timer
systemctl list-timers supreme-app-health.timer --all --no-pager
```

Use a função de teste da integração de e-mail no Healthchecks.io para comprovar
a entrega sem interromper a aplicação. O fluxo de falha do script é exercitado
nos testes do repositório; não derrube o app, não altere o banco e não exponha
uma URL inválida em produção apenas para provocar um alerta.

Consulte logs sem imprimir o arquivo de ambiente:

```bash
journalctl -u supreme-app-health.service --since today --no-pager
```

## Diagnóstico

Se o serviço falhar:

1. confirme que a aplicação está saudável somente pelo endpoint local;
2. valide DNS, TLS e Caddy pelo endpoint público;
3. confirme que `/api/health` retorna apenas `{"status":"ok"}`;
4. confira a conectividade de saída da VPS com o Healthchecks.io;
5. não publique o conteúdo de `/etc/supreme/app-monitor.env`.

## Desativação segura

Desativar o timer não altera o app, o banco ou o monitor de backup:

```bash
sudo systemctl disable --now supreme-app-health.timer
```

Pause também o check correspondente no Healthchecks.io para não gerar um alerta
de ausência intencional.
