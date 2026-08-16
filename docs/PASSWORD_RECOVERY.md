# Recuperação de senha

Este runbook cobre a ativação e a validação do fluxo de recuperação de senha
do Supreme. O recurso usa o mesmo transporte SMTP protegido descrito em
`docs/EMAIL_VERIFICATION.md` e permanece operacionalmente inativo enquanto as
seis variáveis SMTP não estiverem configuradas na VPS.

## Garantias de segurança

- a solicitação sempre devolve a mesma mensagem, exista ou não uma conta com senha;
- contas que usam somente Google não recebem um token de senha local;
- o token aleatório tem 256 bits, expira em 60 minutos e somente seu SHA-256 é armazenado;
- um novo pedido revoga o token anterior da mesma conta;
- o token viaja no fragmento `#token=`, que não é enviado no `GET` nem aparece em access logs;
- a senha só muda após um `POST` explícito com token e payload válidos;
- o token é reivindicado atomicamente e não pode redefinir a senha duas vezes;
- a identidade do token inclui o hash do e-mail atual, sem armazenar o e-mail no identificador;
- a nova senha respeita o limite seguro do bcrypt de 72 bytes;
- o reset define `sessionsValidAfter`, remove sessões de banco residuais e invalida JWTs anteriores;
- o Proxy e o callback JWT consultam o corte persistido antes de aceitar uma sessão protegida;
- logs não incluem e-mail, token, senha nova, credencial SMTP ou erro interno.

## Migration

A migration `20260815021000_add_password_recovery_session_cutoff` adiciona
somente a coluna opcional `sessionsValidAfter` em `users`. Ela não remove,
reescreve ou restaura dados. A coluna começa nula, portanto o deploy não encerra
sessões existentes. Ela recebe um valor apenas quando uma senha é redefinida.

Antes de trocar a imagem de produção:

```bash
SUPREME_IMAGE_TAG=<sha-aprovado> \
docker compose \
  --env-file /opt/supreme/runtime/.env.production \
  -f /opt/supreme/runtime/compose.yml \
  --profile ops run -T --rm migrate
```

Se `prisma migrate deploy` falhar, não recrie a aplicação.

## SMTP

Configure diretamente em `/opt/supreme/runtime/.env.production`, sem colar
secrets nesta conversa:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=replace-at-runtime
SMTP_PASSWORD=replace-at-runtime
EMAIL_FROM="Supreme <no-reply@example.com>"
```

Use STARTTLS obrigatório na porta 587 ou TLS implícito na porta 465. Siga o
backup timestampado, permissões `600`, recriação controlada e rollback de
`docs/EMAIL_VERIFICATION.md`; os dois fluxos compartilham exatamente o mesmo
transporte.

## Validação funcional

Use uma conta operacional Credentials cujo e-mail você controla:

1. mantenha uma sessão aberta no navegador A;
2. em uma janela privada, abra `/login` e selecione **Esqueci minha senha**;
3. solicite o link e confirme que a tela não revela se a conta existe;
4. confirme a chegada da mensagem pelo remetente autorizado;
5. abra o link e verifique que o fragmento some imediatamente da barra de endereço;
6. informe e confirme uma nova senha;
7. confirme que o mesmo link não funciona uma segunda vez;
8. confirme que a sessão antiga do navegador A é redirecionada ao login e não acessa APIs protegidas;
9. confirme que a senha antiga falha e a nova senha autentica;
10. execute `npm run smoke` com a nova senha.

Não copie o link recebido para logs, tickets ou chat. Ele é uma credencial
temporária.

O teste real foi concluído em 16/08/2026. As evidências sem dados de conta ou
credenciais estão em `docs/AUTH_EMAIL_PRODUCTION_VALIDATION.md`.

## Rollback

Se o deploy falhar antes do reset real, restaure a imagem anterior e repita
health e smoke. A migration aditiva pode permanecer aplicada com a coluna nula.

Se um reset real já ocorreu, não reverta o hash da senha nem diminua
`sessionsValidAfter`: isso reativaria credenciais ou sessões antigas. Corrija o
aplicativo mantendo o novo hash e o corte de sessões. Se houver suspeita de
exposição SMTP, revogue a credencial no provedor e restaure o backup do arquivo
de ambiente somente para desativar novos envios.
