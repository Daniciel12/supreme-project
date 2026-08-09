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
| `NEXTAUTH_SECRET` | Sim | Assinatura/criptografia da sessão; use valor aleatório forte com pelo menos 32 caracteres |
| `GOOGLE_CLIENT_ID` | Não | Google OAuth; só habilitado quando ID e secret existem |
| `GOOGLE_CLIENT_SECRET` | Não | Google OAuth |
| `UPLOADTHING_TOKEN` | Sim para o produto completo | Autorização server-side do Vision Board |

`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` devem ser configurados juntos ou deixados ambos vazios.

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

## Docker / VPS Linux

O alvo de produção do Supreme é um VPS Linux executando containers Docker. O `Dockerfile` usa `output: "standalone"` do Next.js e produz dois targets:

- `migrator`: contém Prisma CLI + migrations e existe somente para executar `prisma migrate deploy`;
- `runner`: imagem mínima da aplicação, executada por usuário não-root.

Construa os dois artefatos a partir do mesmo commit:

```bash
docker build --target migrator -t supreme-migrator:<commit> .
docker build --target runner -t supreme-app:<commit> .
```

Aplique migrations antes de liberar a nova aplicação:

```bash
docker run --rm \
  --env-file .env \
  supreme-migrator:<commit>
```

Depois inicie o runtime:

```bash
docker run -d \
  --name supreme \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  supreme-app:<commit>
```

`DATABASE_URL` precisa apontar para um PostgreSQL alcançável a partir do container. Se o banco também estiver em Docker, coloque aplicação e banco em uma rede Docker privada e use o hostname do serviço do banco; não dependa de `localhost` dentro do container.

A publicação externa deve ocorrer através de um reverse proxy TLS no VPS. Não exponha diretamente a porta 3000 à internet.

### Health checks

Dois endpoints públicos e sem dados sensíveis ficam disponíveis para infraestrutura:

- `GET /api/health/live` — confirma que o processo HTTP está respondendo;
- `GET /api/health/ready` — exige configuração runtime válida e consulta simples ao PostgreSQL.

O readiness retorna apenas `ready` ou `not_ready`; não expõe connection strings, secrets, nomes de variáveis ausentes ou detalhes de erro do banco.

Exemplo:

```bash
curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health/ready
```

A própria imagem `runner` possui `HEALTHCHECK` baseado no readiness.

### Atualização e rollback

1. mantenha a imagem atualmente estável com tag imutável;
2. construa e valide a nova imagem no CI;
3. execute o target `migrator` para o novo commit;
4. suba o novo `runner` e aguarde readiness verde;
5. só então direcione tráfego para ele;
6. em falha da aplicação, volte para a imagem anterior **somente se o schema aplicado continuar retrocompatível**.

Migration destrutiva ou incompatível precisa de plano próprio de rollback; não trate downgrade da imagem como rollback automático de banco.

## Quality gates

Antes de abrir ou atualizar um PR, execute:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

O CI também executa PostgreSQL limpo, `prisma generate`, `prisma migrate deploy`, lint, typecheck, testes, build, construção dos targets Docker e smoke test do readiness no container.

## Modelo de segurança

- APIs de domínio usam a sessão autenticada como fonte de identidade.
- O navegador nunca deve escolher ou injetar `userId` para autorização.
- Recursos filhos validam ownership pelo recurso pai quando aplicável.
- Payloads não confiáveis são validados nas fronteiras, preferencialmente com Zod estrito.
- Dados financeiros são sensíveis; valores monetários usam aritmética decimal-safe no backend.
- Uploads do Vision Board são autenticados na file route do UploadThing e persistidos com identidade derivada do token server-side.
- O proxy protege as rotas da aplicação; endpoints sensíveis mantêm validação de sessão própria.
- Os endpoints `/api/health/*` são públicos apenas para operação e nunca retornam dados de usuário ou detalhes de configuração.

## Checklist pré-produção

Antes de qualquer deploy real:

- [ ] CI do commit candidato completamente verde.
- [ ] `npm audit --audit-level=high` sem vulnerabilidade não aceita/documentada.
- [ ] Imagens `migrator` e `runner` construídas a partir do mesmo commit/tag imutável.
- [ ] `DATABASE_URL` aponta para o banco correto e protegido.
- [ ] `NEXTAUTH_SECRET` é forte, exclusivo do ambiente e armazenado como secret da plataforma.
- [ ] `NEXTAUTH_URL` corresponde exatamente à URL HTTPS de produção.
- [ ] Google OAuth, se habilitado, possui redirect URI de produção correta.
- [ ] `UPLOADTHING_TOKEN` está configurado como secret e o fluxo de upload autenticado foi testado.
- [ ] Target `migrator` conclui `prisma migrate deploy` antes da liberação de tráfego.
- [ ] `/api/health/live` e `/api/health/ready` respondem corretamente no container candidato.
- [ ] Smoke test autenticado em desktop e mobile cobre login, Dashboard, Finanças, Hábitos, Metas, Treinos, Livros e Vision Board.
- [ ] Isolamento multiusuário foi testado com ao menos duas contas.
- [ ] Rate limiting/anti-abuse distribuído está configurado para cadastro, login e uploads.
- [ ] Logs, captura de erros e alertas operacionais estão configurados sem registrar secrets ou dados sensíveis desnecessários.
- [ ] HTTPS está obrigatório; HSTS deve ser habilitado na camada de produção após validar todo o domínio em HTTPS.
- [ ] Backups do PostgreSQL e procedimento de restauração estão definidos e testados.
- [ ] Política de retenção/limpeza de arquivos do UploadThing está definida; hoje remover uma imagem do Vision Board remove o registro da aplicação, não necessariamente o arquivo físico do storage.

## Rate limiting e anti-abuse

Não use um contador em memória do processo Next.js como proteção de produção. Ele perde estado em restart e diverge quando existem múltiplas instâncias.

Cadastro, login e upload precisam de rate limiting compartilhado na borda ou em um store distribuído. A escolha do mecanismo deve acompanhar a arquitetura real do VPS/reverse proxy (por exemplo, limite na borda e/ou store compartilhado) e ser validada separadamente antes de produção.

## Headers de segurança

A aplicação define uma baseline compatível com os fluxos atuais:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` desabilitando câmera, microfone e geolocalização
- `X-Frame-Options: DENY`

Uma CSP estrita não deve ser adicionada às cegas: precisa ser validada no ambiente real contra NextAuth/OAuth, Next.js e UploadThing.

## Fluxo de contribuição

Leia `AGENTS.md` antes de alterar o repositório.

- nunca commit diretamente em `main`;
- uma branch por tarefa;
- mantenha mudanças fora do escopo fora do PR;
- todo PR inclui `## Resumo para o time` e `## Impacto`;
- merge e deploy de produção exigem autorização explícita.

## Deploy

A aplicação está preparada para self-hosting em Docker no Linux, mas o repositório não provisiona o VPS, DNS, TLS, reverse proxy, observabilidade, rate limiting distribuído ou backups.

Nenhum processo de deploy deve substituir os quality gates e o checklist pré-produção acima.