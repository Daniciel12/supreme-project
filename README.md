# Supreme

Supreme é um sistema pessoal multiusuário para organização diária, finanças, metas, hábitos, treinos, evolução física, leitura e Vision Board.

## Stack

- Next.js 16 / React 19 / TypeScript
- PostgreSQL 16
- Prisma 7
- NextAuth 4 (Credentials e Google OAuth opcional)
- UploadThing para imagens do Vision Board
- Zod para validação nas fronteiras de API

## Módulos

- Dashboard operacional (`/`)
- Finanças (`/financas`)
- Hábitos (`/habitos`)
- Metas e tarefas (`/metas`)
- Treinos e evolução física (`/treinos`)
- Livros (`/livros`)
- Vision Board (`/visao`)
- Conta e configurações (`/configuracoes`)

## Requisitos locais

- Node.js 22
- npm
- PostgreSQL 16

## Configuração

1. Instale as dependências:

```bash
npm ci
```

2. Copie o template de ambiente:

```bash
cp .env.example .env
```

3. Configure as variáveis abaixo no `.env`:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão PostgreSQL usada pelo Prisma |
| `NEXTAUTH_URL` | Sim | URL pública da aplicação |
| `NEXTAUTH_SECRET` | Sim | Assinatura/criptografia da sessão; use valor aleatório forte |
| `RATE_LIMIT_TRUST_PROXY` | Não | Use `true` somente atrás do primeiro proxy público confiável |
| `GOOGLE_CLIENT_ID` | Não | Google OAuth; só habilitado quando ID e secret existem |
| `GOOGLE_CLIENT_SECRET` | Não | Google OAuth |
| `SMTP_HOST` | Para verificação de e-mail | Host do servidor SMTP |
| `SMTP_PORT` | Para verificação de e-mail | Porta SMTP; normalmente 465 ou 587 |
| `SMTP_SECURE` | Para verificação de e-mail | `true` para TLS implícito ou `false` para STARTTLS obrigatório |
| `SMTP_USER` | Para verificação de e-mail | Usuário SMTP mantido somente no servidor |
| `SMTP_PASSWORD` | Para verificação de e-mail | Senha/token SMTP mantido somente no servidor |
| `EMAIL_FROM` | Para verificação de e-mail | Remetente autorizado pelo provedor SMTP |
| `UPLOADTHING_TOKEN` | Para Vision Board | Autorização server-side do UploadThing |

Nunca versione `.env`, secrets, tokens ou credenciais reais.

## Banco de dados

Gere o Prisma Client e aplique migrations existentes:

```bash
npx prisma generate
npx prisma migrate deploy
```

Para mudanças de schema, crie uma migration Prisma revisável. Evite alterações destrutivas sem plano explícito de migração/backfill.

## Desenvolvimento

```bash
npm run dev
```

A aplicação local fica em `http://localhost:3000` por padrão.

## Quality gates

Antes de abrir ou atualizar um PR, execute:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

O CI também executa PostgreSQL limpo, `prisma generate`, `prisma migrate deploy`, lint, typecheck, testes e build.

## Modelo de segurança

- APIs de domínio usam a sessão autenticada como fonte de identidade.
- O navegador nunca deve escolher ou injetar `userId` para autorização.
- Recursos filhos validam ownership pelo recurso pai quando aplicável.
- Payloads não confiáveis são validados nas fronteiras, preferencialmente com Zod estrito.
- Dados financeiros são sensíveis; valores monetários usam aritmética decimal-safe no backend.
- Uploads do Vision Board são autenticados na file route do UploadThing e persistidos com identidade derivada do token server-side.
- O proxy protege as rotas da aplicação; endpoints sensíveis mantêm validação de sessão própria.
- O perfil da conta é derivado da sessão e expõe somente um DTO mínimo; e-mail, senha e vínculos OAuth não podem ser escolhidos pelo navegador.

## Docker / VPS

A direção de produção do Supreme é uma VPS Linux com Docker. O repositório usa `output: "standalone"` do Next.js para gerar uma imagem web reduzida e separa a execução de migrations do processo da aplicação.

### Arquivos

- `Dockerfile`: contém os targets `runner` e `migrator`.
- `compose.production.example.yml`: baseline de Compose sem banco ou secrets embutidos.
- `.dockerignore`: impede que `.env`, caches e arquivos locais entrem no contexto da imagem.
- `GET /api/health`: readiness público e genérico que valida aplicação + conexão com PostgreSQL.
- `scripts/smoke.mjs`: smoke test autenticado somente-leitura contra um ambiente alvo.
- `scripts/postgres-backup.sh`: dump validado, checksum e envio para storage externo.
- `scripts/postgres-restore-test.sh`: restore somente em PostgreSQL descartável e isolado.
- `docs/POSTGRES_BACKUP_RESTORE.md`: runbook de configuração e execução controlada.
- `deploy/systemd/supreme-postgres-backup.*`: serviço e timer para backup diário monitorado.
- `docs/POSTGRES_BACKUP_SCHEDULING.md`: ativação segura, alerta por e-mail e retenção externa.
- `scripts/app-health-monitor.sh`: verifica disponibilidade pública e sinaliza o monitor externo.
- `deploy/systemd/supreme-app-health.*`: serviço e timer para monitoramento da aplicação.
- `docs/APP_MONITORING.md`: ativação, alertas de falha/ausência e desativação segura.
- `docs/EMAIL_VERIFICATION.md`: configuração SMTP, ativação e validação controlada do fluxo de verificação.

### Preparar o ambiente

No VPS, crie um arquivo local que nunca será commitado:

```bash
cp .env.example .env.production
```

Preencha pelo menos `DATABASE_URL`, `NEXTAUTH_URL` e `NEXTAUTH_SECRET`. Configure Google OAuth e UploadThing somente se esses recursos estiverem habilitados no ambiente. Na implantação privada atrás do Caddy, siga [docs/PRODUCTION_RATE_LIMITING.md](docs/PRODUCTION_RATE_LIMITING.md) antes de habilitar `RATE_LIMIT_TRUST_PROXY`.

`NEXTAUTH_URL` deve ser a URL HTTPS pública final, não `localhost` nem a porta interna do container.

### Build

Use uma tag imutável, preferencialmente o SHA do commit aprovado:

```bash
export SUPREME_IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose -f compose.production.example.yml build app migrate
```

O target web usa Node 22 em Debian slim, executa `prisma generate` durante o build e roda como usuário não-root. Secrets reais são fornecidos apenas em runtime.

### Aplicar migrations

Migrations não fazem parte do `CMD` da aplicação. Execute-as explicitamente antes de liberar a nova versão:

```bash
docker compose -f compose.production.example.yml --profile ops run --rm migrate
```

Se `prisma migrate deploy` falhar, não inicie/troque o tráfego para a nova aplicação.

### Subir a aplicação

```bash
docker compose -f compose.production.example.yml up -d app
```

O exemplo publica a porta somente em `127.0.0.1:3000`. Um reverse proxy no VPS deve ser responsável por domínio, HTTPS e encaminhamento externo.

Verifique o container:

```bash
docker compose -f compose.production.example.yml ps
curl --fail http://127.0.0.1:3000/api/health
```

Resposta saudável:

```json
{"status":"ok"}
```

Falha de banco retorna HTTP `503` com corpo genérico; o endpoint não deve expor host, credenciais, stack ou mensagem interna.

### Smoke test autenticado

Use uma conta dedicada de smoke com dados descartáveis e credenciais fornecidas apenas por variáveis do operador:

```bash
BASE_URL=https://supreme.example.com \
SMOKE_EMAIL=smoke@example.com \
SMOKE_PASSWORD='replace-at-runtime' \
npm run smoke
```

Opcionalmente fixe a data usada nas APIs diárias:

```bash
SMOKE_DATE=2026-08-09
```

O harness usa o fluxo real de Credentials do NextAuth (CSRF, callback e cookie de sessão), não faz bypass de autenticação e não cria/altera dados. Ele verifica:

- `/api/health`;
- sessão autenticada;
- Dashboard, Finanças, Hábitos, Metas, Treinos, Livros, Vision Board e Conta;
- APIs de leitura principais desses módulos.

A senha de smoke não é impressa pelo script e nunca deve ser commitada.

### Reverse proxy / OAuth / uploads

Antes de tráfego público:

- force HTTPS no reverse proxy;
- preserve headers `Host` e `X-Forwarded-*` corretamente;
- configure `NEXTAUTH_URL` com a URL HTTPS pública;
- cadastre a callback de produção do Google OAuth exatamente para o domínio final;
- valide upload e callback do UploadThing atrás do proxy;
- só habilite HSTS após confirmar que todo o domínio funciona exclusivamente em HTTPS.

### Rollback

Mantenha imagens identificadas por SHA/versão para poder voltar o container web para a versão anterior.

Rollback de aplicação não desfaz automaticamente migrations. Antes de qualquer migration incompatível ou destrutiva, deve existir plano explícito de compatibilidade, expansão/contração, backup e restauração. Não use `prisma migrate reset` em produção.

### Backup externo e restore descartável

O fluxo versionado usa um remote `rclone` externo à VPS. O backup é validado antes do upload e baixado novamente para conferir SHA-256. O teste de restore cria seu próprio PostgreSQL sem rede, sem portas publicadas e com armazenamento temporário; ele não aceita uma URL de banco de destino e nunca restaura sobre produção.

Leia e execute o runbook [docs/POSTGRES_BACKUP_RESTORE.md](docs/POSTGRES_BACKUP_RESTORE.md). O merge desses scripts deixa o gate pronto para operação, mas os itens da checklist só podem ser concluídos depois de uma execução real e registrada na VPS.

## Checklist pré-produção

Antes de qualquer deploy real:

- [ ] CI do commit candidato completamente verde.
- [ ] Imagens Docker `runner` e `migrator` construídas a partir do mesmo commit aprovado.
- [ ] `npm audit --audit-level=high` sem vulnerabilidade não aceita/documentada.
- [ ] `DATABASE_URL` aponta para o banco correto e protegido.
- [ ] `NEXTAUTH_SECRET` é forte, exclusivo do ambiente e armazenado como secret da plataforma.
- [ ] `NEXTAUTH_URL` corresponde exatamente à URL HTTPS de produção.
- [ ] Google OAuth, se habilitado, possui redirect URI de produção correta.
- [ ] SMTP, se habilitado, usa TLS, remetente autorizado e secret exclusivo; envio e confirmação real foram testados.
- [ ] `UPLOADTHING_TOKEN` está configurado como secret e o fluxo de upload autenticado foi testado.
- [ ] `npx prisma migrate deploy` foi validado contra o ambiente alvo antes de liberar tráfego.
- [ ] `/api/health` retorna `200` após subir a versão candidata.
- [ ] `npm run smoke` passa contra a URL HTTPS candidata.
- [ ] Smoke test visual autenticado em desktop e mobile cobre login, Dashboard, Finanças, Hábitos, Metas, Treinos, Livros, Vision Board e Conta.
- [ ] Isolamento multiusuário foi testado com ao menos duas contas.
- [ ] Rate limiting/anti-abuse de cadastro, login e uploads foi ativado e validado conforme `docs/PRODUCTION_RATE_LIMITING.md`.
- [ ] Logs, captura de erros e alertas operacionais estão configurados sem registrar secrets ou dados sensíveis desnecessários.
- [ ] HTTPS está obrigatório; HSTS deve ser habilitado na camada de produção após validar todo o domínio em HTTPS.
- [ ] Backups do PostgreSQL e procedimento de restauração estão definidos e testados.
- [ ] Política de retenção/limpeza de arquivos do UploadThing está definida; hoje remover uma imagem do Vision Board remove o registro da aplicação, não necessariamente o arquivo físico do storage.

## Headers de segurança

A aplicação define uma baseline compatível com os fluxos atuais:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` desabilitando câmera, microfone e geolocalização
- `X-Frame-Options: DENY`
- `Content-Security-Policy` limitando scripts, estilos, conexões, imagens, formulários e enquadramento aos recursos usados pelo Supreme
- `Strict-Transport-Security: max-age=31536000` somente no build de produção

A CSP preserva a renderização estática do Next.js e libera somente os hosts externos necessários ao UploadThing. O HSTS não inclui subdomínios nem preload até que todo o domínio seja auditado. Consulte [docs/PRODUCTION_SECURITY_HEADERS.md](docs/PRODUCTION_SECURITY_HEADERS.md) antes de alterar a política ou executar o deploy.

## Fluxo de contribuição

Leia `AGENTS.md` antes de alterar o repositório.

- nunca commit diretamente em `main`;
- uma branch por tarefa;
- mantenha mudanças fora do escopo fora do PR;
- todo PR inclui `## Resumo para o time` e `## Impacto`;
- merge e deploy de produção exigem autorização explícita.

## Deploy

O ambiente planejado é Linux VPS com Docker. O repositório não provisiona VPS, DNS, TLS, firewall, reverse proxy, banco ou serviços de observabilidade automaticamente.

A sequência operacional prevista é:

1. obter o commit aprovado;
2. construir imagens imutáveis;
3. aplicar migrations pelo target `migrator`;
4. iniciar o target `runner`;
5. validar `/api/health`;
6. executar `npm run smoke` contra HTTPS;
7. executar smoke visual e isolamento multiusuário;
8. somente então liberar/confirmar tráfego.

Nenhum processo de deploy deve substituir os quality gates e o checklist pré-produção acima.
