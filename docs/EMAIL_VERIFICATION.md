# Verificação de e-mail

Este runbook ativa o envio SMTP do Supreme de forma controlada. A aplicação
continua aceitando login e cadastro sem SMTP; somente a solicitação de
verificação fica indisponível até que as seis variáveis estejam corretas.

## Contrato de segurança

- o destinatário vem da sessão e do banco, nunca do corpo da requisição;
- o token aleatório tem 256 bits, expira em 24 horas e somente seu SHA-256 fica no banco;
- o token viaja no fragmento do link, que não é transmitido no `GET` nem gravado em access logs do servidor;
- a confirmação exige um `POST` explícito, portanto abrir o link não altera a conta;
- tokens e senhas SMTP não devem aparecer em logs, comandos, tickets ou commits;
- o transporte exige TLS 1.2 ou superior e proíbe leitura de arquivos/URLs pelo gerador do e-mail;
- o fluxo não altera senha, vincula Google, troca e-mail nem restaura dados.

O Supreme usa a interface SMTP padrão por meio do
[Nodemailer](https://nodemailer.com/smtp), sem acoplamento a um fornecedor. A
dependência runtime usa o alias interno `secure-nodemailer` para fixar a linha
9 corrigida sem satisfazer indevidamente o peer opcional antigo do NextAuth 4,
que só seria usado por seu provedor próprio de magic link.

## Variáveis server-side

Configure somente em `/opt/supreme/runtime/.env.production`:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=replace-at-runtime
SMTP_PASSWORD=replace-at-runtime
EMAIL_FROM="Supreme <no-reply@example.com>"
```

Para a porta 465, use `SMTP_SECURE=true`. Para a porta 587, use
`SMTP_SECURE=false`; o Supreme exigirá STARTTLS antes de autenticar. O remetente
deve estar autorizado pelo provedor. Nunca use `tls.rejectUnauthorized=false`.

## Preparar sem expor secrets

1. Gere no provedor uma credencial exclusiva para o Supreme, com permissão
   apenas de envio.
2. Confirme host, porta, modo TLS e remetente autorizado na documentação do
   provedor.
3. Na VPS, crie uma cópia privada e versionada por data do arquivo de ambiente.
4. Edite o arquivo diretamente na VPS; não cole os valores nesta conversa.
5. Garanta permissão `600` e proprietário correto no arquivo.

Exemplo de backup antes da edição:

```bash
ENV_BACKUP="/opt/supreme/runtime/.env.production.before-email-verification-$(date -u +%Y%m%dT%H%M%SZ)"
sudo cp --preserve=all \
  /opt/supreme/runtime/.env.production \
  "$ENV_BACKUP"
printf 'ENV_BACKUP=%s\n' "$ENV_BACKUP"
```

Registre o caminho impresso; ele identifica exatamente a versão anterior usada
no rollback e evita sobrescrever um backup de outra tentativa.

## Aplicar de forma controlada

Variáveis de `env_file` só entram em um container recriado. Preserve a tag da
imagem que já está em execução:

```bash
ENV_FILE=/opt/supreme/runtime/.env.production
COMPOSE_FILE=/opt/supreme/runtime/compose.yml

APP_ID="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q app)"
CURRENT_IMAGE="$(docker inspect --format '{{.Config.Image}}' "$APP_ID")"
CURRENT_TAG="${CURRENT_IMAGE##*:}"

SUPREME_IMAGE_TAG="$CURRENT_TAG" \
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet &&
SUPREME_IMAGE_TAG="$CURRENT_TAG" \
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --force-recreate app
```

Espere o health check do container ficar `healthy` e confirme
`https://app.supremeproject.tech/api/health` antes de testar e-mail.

## Validação funcional

Use uma conta operacional cujo e-mail você controla:

1. entre no Supreme e abra **Configurações**;
2. em **Verificação pendente**, selecione **Enviar verificação**;
3. confirme que a mensagem chegou do remetente esperado;
4. abra o link: a conta ainda não deve ser alterada;
5. selecione **Confirmar meu e-mail**;
6. volte a **Configurações** e confira o selo **E-mail verificado**;
7. tente reutilizar o mesmo link e confirme a resposta genérica de link inválido;
8. execute o smoke oficial de Credentials para confirmar que o login existente continua intacto.

Não copie o link recebido para logs ou tickets: ele é uma credencial temporária.
O item do roadmap só pode ser concluído depois desse teste real.

O teste real foi concluído em 16/08/2026. As evidências sem dados de conta ou
credenciais estão em `docs/AUTH_EMAIL_PRODUCTION_VALIDATION.md`.

## Rollback

Se envio, health check ou smoke falhar:

1. restaure o caminho `ENV_BACKUP` impresso antes da edição;
2. preserve a tag da imagem em execução e recrie somente o serviço `app`;
3. confirme health local e público;
4. execute novamente o smoke autenticado;
5. revogue a credencial SMTP no provedor se houver suspeita de exposição.

O rollback do arquivo de ambiente desabilita novos envios. Tokens pendentes
continuam inócuos sem entrega e expiram automaticamente; não existe restore ou
alteração destrutiva do PostgreSQL neste procedimento.
