# HSTS e Content Security Policy em produção

Este runbook cobre a ativação e a validação dos headers de transporte e conteúdo do Supreme. A política é definida em `next.config.ts`, viaja com a imagem imutável da aplicação e não depende de edição manual no Caddy.

## Decisões de segurança

- HSTS usa `max-age=31536000` somente em builds de produção.
- `includeSubDomains` não é usado porque os demais subdomínios ainda não foram auditados.
- `preload` não é usado porque sua reversão é lenta e exige compromisso com HTTPS para todo o domínio.
- `frame-ancestors 'none'` e `X-Frame-Options: DENY` bloqueiam clickjacking em navegadores modernos e legados.
- `object-src 'none'`, `base-uri 'self'` e `form-action 'self'` reduzem superfícies de injeção e submissão externa.
- `img-src` e `connect-src` permitem somente o Supreme e os hosts necessários ao UploadThing.
- `unsafe-eval` existe apenas no desenvolvimento, conforme a necessidade das ferramentas do React/Next.js.
- `unsafe-inline` permanece em scripts e estilos para preservar as páginas estáticas atuais. Migrar para nonce exigiria renderização dinâmica por requisição; SRI continua experimental no Next.js 16.

Google OAuth usa navegação de nível superior e a callback local do NextAuth. A política não carrega scripts ou frames do Google. Depois de habilitar o provider em produção, o login deve ser validado novamente antes de marcar esse gate como concluído.

## Pré-requisitos

Antes do deploy:

1. confirme CI verde e imagem identificada pelo SHA aprovado;
2. confirme que HTTP redireciona para HTTPS e que o certificado público está válido;
3. confirme que o Caddy não define uma segunda CSP ou HSTS conflitante;
4. preserve a imagem anterior para rollback;
5. não adicione hosts curingas além dos provedores explicitamente usados.

## Validação pós-deploy

Confira os headers públicos sem imprimir cookies:

```bash
curl --silent --show-error --head \
  https://app.supremeproject.tech/ \
  | grep -iE '^(HTTP/|strict-transport-security:|content-security-policy:|x-content-type-options:|x-frame-options:|referrer-policy:|permissions-policy:)'
```

O resultado deve conter uma única CSP, HSTS com um ano e a baseline anterior. Em seguida:

1. execute o smoke autenticado de leitura;
2. abra Dashboard, Finanças, Hábitos, Metas, Treinos, Livros e Visão;
3. confirme que o console do navegador não contém bloqueios CSP do próprio Supreme;
4. envie uma imagem descartável pela Visão;
5. confirme callback, criação do registro e carregamento da imagem;
6. remova o registro e o arquivo descartável do UploadThing;
7. valide Credentials e, quando configurado, Google OAuth.

Não amplie a allowlist para resolver um bloqueio antes de identificar o recurso, sua origem e sua necessidade.

## Rollback

Se a CSP bloquear um fluxo necessário, restaure a imagem anterior e repita health e smoke. O rollback da imagem remove imediatamente a CSP nova das respostas seguintes.

HSTS é persistido pelo navegador. Se HTTPS deixar de ser suportado, a imagem anterior sem o header não remove a política já armazenada. A revogação exige servir por HTTPS:

```text
Strict-Transport-Security: max-age=0
```

Por isso, não remova HTTPS, não use `includeSubDomains` e não solicite preload sem uma mudança operacional separada e explicitamente aprovada.
