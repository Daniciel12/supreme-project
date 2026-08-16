# Alteração segura de e-mail

Este runbook cobre implantação e validação controlada da troca do e-mail
principal da conta. Ele não autoriza alterar contas reais durante o deploy,
expor links de confirmação nem restaurar dados sobre produção.

## Contrato de segurança

- o usuário vem exclusivamente da sessão autenticada;
- contas Credentials confirmam a senha atual;
- contas somente Google exigem login emitido nos últimos dez minutos;
- o endereço atual permanece ativo até o novo endereço confirmar um link de
  uso único com validade de 60 minutos;
- o endereço antigo recebe aviso quando a solicitação é criada e outra
  notificação quando a alteração termina;
- colisões são verificadas sem diferenciar maiúsculas e minúsculas na
  solicitação, na confirmação e no índice do PostgreSQL;
- a confirmação bloqueia o usuário, revalida o endereço anterior, muda o
  e-mail e revoga todas as sessões na mesma transação;
- tokens de verificação, recuperação e trocas concorrentes daquela conta são
  revogados depois da alteração;
- uma redefinição de senha concluída também revoga qualquer troca de e-mail
  pendente;
- o Google continua vinculado somente pelo identificador do provider. A troca
  não habilita vinculação implícita por igualdade de e-mail.

O token bruto nunca é armazenado. O identificador interno guarda hashes do
endereço anterior e uma codificação do novo endereço apenas enquanto o pedido
está pendente. O token vai no fragmento `#` do link, é removido imediatamente
do histórico visível pela página e chega à API somente no `POST` explícito.

## Migration e preflight

A migration cria somente o índice funcional `users_email_lower_key`. Ela não
remove colunas, tabelas ou registros. Antes do deploy, confirme que não existem
endereços legados duplicados quando comparados em lowercase, registrando
apenas a contagem:

```sql
SELECT COUNT(*)
FROM (
  SELECT LOWER("email")
  FROM "users"
  GROUP BY LOWER("email")
  HAVING COUNT(*) > 1
) AS conflicts;
```

O resultado obrigatório é `0`. Se houver conflito, interrompa o deploy. Não
edite e-mails manualmente e não tente fazer a migration passar apagando contas.

## Deploy

1. confirme CI verde e o SHA exato aprovado;
2. confirme backup externo recente e restore descartável previamente aprovado;
3. execute o preflight agregado acima;
4. construa `app` e `migrate` do mesmo SHA;
5. execute `prisma migrate deploy` pelo migrator;
6. recrie somente a aplicação;
7. valide health local, health público, timers e smoke autenticado.

Se o preflight ou a migration falhar, não troque a aplicação. Se a aplicação
falhar depois da migration, restaure a imagem anterior. O índice aditivo pode
permanecer e não exige rollback de banco. Nunca use `prisma migrate reset` e
nunca execute restore sobre produção por este procedimento.

## Validação controlada

Use uma conta Credentials exclusivamente descartável e duas caixas postais
que o operador controla. Não use a conta operacional de smoke, administrador
ou usuário real.

1. entre na conta descartável pelo endereço antigo;
2. solicite a troca para um novo endereço livre e confirme a senha atual;
3. confirme que o endereço antigo recebeu o aviso de solicitação;
4. confirme que o endereço novo recebeu o link e que a URL pública usa HTTPS;
5. abra o link e acione explicitamente **Confirmar novo e-mail**;
6. confirme a mensagem de sucesso e o redirecionamento ao login;
7. confirme que a sessão anterior não acessa páginas ou APIs autenticadas;
8. confirme que o login pelo endereço antigo falha;
9. confirme que o login pelo endereço novo funciona e preserva os dados;
10. confirme que o endereço antigo recebeu a notificação de conclusão;
11. execute novamente o smoke operacional de leitura.

Teste colisão apenas com outra conta descartável: uma tentativa de trocar para
o endereço já usado deve falhar sem alterar nenhuma das contas. Não publique
endereços, senhas, tokens, links ou conteúdo de e-mails em terminal gravado,
issue, PR, Discord ou conversa.

Para uma conta somente Google, faça novo login imediatamente antes do pedido.
Depois da confirmação, o mesmo `providerAccountId` do Google continua sendo a
âncora da conta; não tente vincular outro Google por coincidência de endereço.

## Falhas de e-mail

Se o aviso inicial ou a confirmação para o novo endereço falhar, o token é
revogado e a conta não muda. Se apenas a notificação final ao endereço antigo
falhar depois do commit, a API não informa falsamente que a troca falhou: a
alteração e a revogação de sessões permanecem concluídas, e a falha genérica é
registrada para investigação sem endereço ou token.

Tokens expirados não podem ser usados. A limpeza física periódica dos hashes
expirados continua pertencendo ao futuro job geral de lifecycle.

## Evidência de produção

O fluxo Credentials foi validado de ponta a ponta em produção em 16/08/2026,
com duas contas descartáveis, colisão case-insensitive, revogação real de
sessão, preservação de dados, bloqueio do reúso do token, exclusão das contas e
smoke operacional posterior. A evidência sanitizada, sem dados de conta ou
credenciais, está em
[EMAIL_CHANGE_PRODUCTION_VALIDATION.md](EMAIL_CHANGE_PRODUCTION_VALIDATION.md).
