# Google OAuth

O Supreme mantém o login por e-mail/senha e registra o Google como provider
adicional somente quando as duas variáveis abaixo existem no ambiente do
servidor:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Não use o prefixo `NEXT_PUBLIC_` nessas variáveis. O client secret nunca deve
ser enviado ao navegador, incluído em logs, salvo no Git ou copiado para
documentação com um valor real.

## Configuração no Google Cloud

Crie uma credencial OAuth 2.0 do tipo **Aplicativo da Web**. Para a produção do
Supreme, configure exatamente:

```text
Origem JavaScript autorizada:
https://app.supremeproject.tech

URI de redirecionamento autorizada:
https://app.supremeproject.tech/api/auth/callback/google
```

Se o app OAuth ainda estiver em modo de teste, adicione somente as contas que
participarão do smoke à lista de usuários de teste. Não publique o app OAuth
antes de revisar nome, domínio, e-mail de suporte, escopos e política de
privacidade.

Para desenvolvimento local, use a origem configurada em `NEXTAUTH_URL`, por
exemplo:

```text
http://localhost:3000/api/auth/callback/google
```

Quando uma das duas variáveis estiver ausente, Credentials continua disponível,
Google não é registrado e o botão Google não aparece na tela de login.

## Produção na VPS

Os caminhos operacionais atuais são:

```text
Aplicação: /opt/supreme/app
Ambiente:  /opt/supreme/runtime/.env.production
Compose:   /opt/supreme/runtime/compose.yml
```

Confirme antes de começar:

1. a `main` e a imagem em produção já passaram pela CI;
2. Credentials e o smoke autenticado estão verdes;
3. o client OAuth contém a origem e a callback exatas acima;
4. a imagem atual continuará disponível para rollback;
5. `NEXTAUTH_SECRET` não será alterado.

### 1. Preservar o ambiente e editar sem expor secrets

Na VPS, execute:

```bash
(
  set -euo pipefail

  ENV_FILE=/opt/supreme/runtime/.env.production
  ENV_BACKUP=/opt/supreme/runtime/.env.production.before-google-oauth

  if sudo test -e "$ENV_BACKUP"; then
    echo 'Backup temporário já existe; revise a ativação anterior antes de continuar.' >&2
    exit 1
  fi

  sudo cp --preserve=all "$ENV_FILE" "$ENV_BACKUP"
  sudo chmod 600 "$ENV_BACKUP"
  sudo nano "$ENV_FILE"
)
```

No editor, adicione ou atualize `GOOGLE_CLIENT_ID` e
`GOOGLE_CLIENT_SECRET`. Não use `cat`, `grep`, `echo`, argumentos de processo ou
histórico do shell para exibir os valores. Salve sem alterar
`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` ou `UPLOADTHING_TOKEN`.

### 2. Recriar somente o app com a mesma imagem

O bloco abaixo não executa build nem migrations. Ele reaplica a imagem imutável
que já está em produção, carregando o arquivo de ambiente atualizado:

```bash
(
  set -Eeuo pipefail

  APP_DIR=/opt/supreme/app
  ENV_FILE=/opt/supreme/runtime/.env.production
  ENV_BACKUP=/opt/supreme/runtime/.env.production.before-google-oauth
  COMPOSE_FILE=/opt/supreme/runtime/compose.yml

  cd "$APP_DIR"

  CURRENT_TAG=""
  restore_required=true

  wait_for_health() {
    for attempt in $(seq 1 45); do
      APP_ID="$(
        SUPREME_IMAGE_TAG="$CURRENT_TAG" \
        docker compose \
          --env-file "$ENV_FILE" \
          -f "$COMPOSE_FILE" \
          ps -q app
      )"
      health="$(docker inspect --format '{{.State.Health.Status}}' "$APP_ID")"

      if [[ "$health" == healthy ]] && \
        curl --fail --silent --show-error \
          --connect-timeout 1 --max-time 3 \
          http://127.0.0.1:3000/api/health >/dev/null; then
        return 0
      fi

      if [[ "$health" == unhealthy ]]; then
        return 1
      fi

      sleep 2
    done

    return 1
  }

  rollback_on_error() {
    status=$?
    trap - EXIT

    if [[ $status -ne 0 && "$restore_required" == true ]]; then
      echo 'Falha na ativação do Google OAuth; restaurando o ambiente anterior.' >&2
      sudo cp --preserve=all "$ENV_BACKUP" "$ENV_FILE"

      if [[ -z "$CURRENT_TAG" ]]; then
        echo 'ROLLBACK DO AMBIENTE: OK; o container não foi alterado.' >&2
      elif SUPREME_IMAGE_TAG="$CURRENT_TAG" \
        docker compose \
          --env-file "$ENV_FILE" \
          -f "$COMPOSE_FILE" \
          config --quiet && \
        SUPREME_IMAGE_TAG="$CURRENT_TAG" \
        docker compose \
          --env-file "$ENV_FILE" \
          -f "$COMPOSE_FILE" \
          up -d --force-recreate app && \
        wait_for_health && \
        curl --fail --silent --show-error \
          --connect-timeout 3 --max-time 10 \
          https://app.supremeproject.tech/api/health >/dev/null; then
        echo 'ROLLBACK: OK' >&2
      else
        echo 'ROLLBACK: FALHOU — intervenção manual necessária.' >&2
      fi
    fi

    exit "$status"
  }
  trap rollback_on_error EXIT

  APP_ID="$(
    docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      ps -q app
  )"
  CURRENT_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$APP_ID")"
  CURRENT_TAG="${CURRENT_IMAGE##*:}"

  SUPREME_IMAGE_TAG="$CURRENT_TAG" \
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    config --quiet

  SUPREME_IMAGE_TAG="$CURRENT_TAG" \
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    up -d --force-recreate app

  wait_for_health

  curl --fail --silent --show-error \
    --connect-timeout 3 --max-time 10 \
    https://app.supremeproject.tech/api/health >/dev/null

  providers="$(
    curl --fail --silent --show-error \
      --connect-timeout 3 --max-time 10 \
      https://app.supremeproject.tech/api/auth/providers
  )"
  [[ "$providers" == *'"google"'* ]]
  [[ "$providers" != *'GOOGLE_CLIENT_SECRET'* ]]

  echo 'GOOGLE_PROVIDER: OK'
  echo 'HEALTH: OK'
  echo 'CONFIG_RELOAD: OK'

  restore_required=false
)
```

O bloco executa em um subshell: uma falha não encerra a sessão SSH. O rollback
restaura o arquivo anterior e recria o app com a mesma imagem; ele não altera o
banco nem executa migrations.

### 3. Smoke obrigatório no navegador

Depois da validação automática:

1. confirme que `Continuar com Google` aparece;
2. autentique uma conta Google nova e confirme a chegada ao Dashboard;
3. faça logout e confirme que Credentials continua funcionando;
4. teste uma conta Credentials existente com o mesmo e-mail do Google: ela deve
   receber mensagem de método diferente, sem vínculo automático;
5. cancele ou negue o consentimento no Google e confirme o retorno controlado à
   tela de login;
6. execute novamente o smoke autenticado de leitura;
7. confirme que nenhum token, authorization code ou secret aparece na interface
   ou nos registros operacionais coletados.

Somente depois de todos os itens passarem, remova a cópia temporária que contém
o ambiente anterior:

```bash
sudo rm -f -- /opt/supreme/runtime/.env.production.before-google-oauth
```

## Rollback manual

Se um problema funcional aparecer durante o smoke, restaure o backup e recrie
somente o app com a tag atual. Não altere `NEXTAUTH_SECRET`, pois isso invalidaria
sessões existentes. Credentials permanece disponível depois que as duas
variáveis Google forem removidas ou restauradas ao estado anterior.

```bash
(
  set -Eeuo pipefail

  APP_DIR=/opt/supreme/app
  ENV_FILE=/opt/supreme/runtime/.env.production
  ENV_BACKUP=/opt/supreme/runtime/.env.production.before-google-oauth
  COMPOSE_FILE=/opt/supreme/runtime/compose.yml

  cd "$APP_DIR"

  APP_ID="$(
    docker compose \
      --env-file "$ENV_FILE" \
      -f "$COMPOSE_FILE" \
      ps -q app
  )"
  CURRENT_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$APP_ID")"
  CURRENT_TAG="${CURRENT_IMAGE##*:}"

  sudo cp --preserve=all "$ENV_BACKUP" "$ENV_FILE"

  SUPREME_IMAGE_TAG="$CURRENT_TAG" \
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    config --quiet

  SUPREME_IMAGE_TAG="$CURRENT_TAG" \
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    up -d --force-recreate app

  for attempt in $(seq 1 45); do
    APP_ID="$(
      SUPREME_IMAGE_TAG="$CURRENT_TAG" \
      docker compose \
        --env-file "$ENV_FILE" \
        -f "$COMPOSE_FILE" \
        ps -q app
    )"
    health="$(docker inspect --format '{{.State.Health.Status}}' "$APP_ID")"

    if [[ "$health" == healthy ]] && \
      curl --fail --silent --show-error \
        --connect-timeout 1 --max-time 3 \
        http://127.0.0.1:3000/api/health >/dev/null; then
      curl --fail --silent --show-error \
        --connect-timeout 3 --max-time 10 \
        https://app.supremeproject.tech/api/health >/dev/null
      echo 'ROLLBACK: OK'
      exit 0
    fi

    if [[ "$health" == unhealthy ]]; then
      break
    fi

    sleep 2
  done

  echo 'ROLLBACK: FALHOU — intervenção manual necessária.' >&2
  exit 1
)
```

## Coexistência e account linking

Usuários criados via Google não recebem senha artificial: `User.password`
permanece `null`. Uma conta OAuth-only não autentica pelo Credentials Provider e
o bcrypt não é executado para ela.

O Supreme preserva o comportamento seguro padrão `OAuthAccountNotLinked`. Esta
implementação não usa `allowDangerousEmailAccountLinking` e não vincula
silenciosamente uma conta Google a uma conta Credentials existente com o mesmo
e-mail. Account linking manual permanece como follow-up separado.

Erros do fluxo OAuth são redirecionados para `/login`. A interface traduz casos
esperados, como `OAuthAccountNotLinked` e `AccessDenied`; demais códigos recebem
uma mensagem genérica para não expor detalhes internos do provider.
