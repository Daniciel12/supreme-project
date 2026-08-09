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
| `NEXTAUTH_SECRET` | Sim | Assinatura/criptografia da sessão; use valor aleatório forte |
| `GOOGLE_CLIENT_ID` | Não | Google OAuth; só habilitado quando ID e secret existem |
| `GOOGLE_CLIENT_SECRET` | Não | Google OAuth |
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

## Checklist pré-produção

Antes de qualquer deploy real:

- [ ] CI do commit candidato completamente verde.
- [ ] `npm audit --audit-level=high` sem vulnerabilidade não aceita/documentada.
- [ ] `DATABASE_URL` aponta para o banco correto e protegido.
- [ ] `NEXTAUTH_SECRET` é forte, exclusivo do ambiente e armazenado como secret da plataforma.
- [ ] `NEXTAUTH_URL` corresponde exatamente à URL HTTPS de produção.
- [ ] Google OAuth, se habilitado, possui redirect URI de produção correta.
- [ ] `UPLOADTHING_TOKEN` está configurado como secret e o fluxo de upload autenticado foi testado.
- [ ] `npx prisma migrate deploy` foi validado contra o ambiente alvo antes de liberar tráfego.
- [ ] Smoke test autenticado em desktop e mobile cobre login, Dashboard, Finanças, Hábitos, Metas, Treinos, Livros e Vision Board.
- [ ] Isolamento multiusuário foi testado com ao menos duas contas.
- [ ] Rate limiting/anti-abuse está configurado na plataforma para cadastro, login e uploads.
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

Uma CSP estrita não deve ser adicionada às cegas: precisa ser validada no ambiente real contra NextAuth/OAuth, Next.js e UploadThing.

## Fluxo de contribuição

Leia `AGENTS.md` antes de alterar o repositório.

- nunca commit diretamente em `main`;
- uma branch por tarefa;
- mantenha mudanças fora do escopo fora do PR;
- todo PR inclui `## Resumo para o time` e `## Impacto`;
- merge e deploy de produção exigem autorização explícita.

## Deploy

Este repositório não presume um provedor específico. O ambiente escolhido deve suportar Node.js, PostgreSQL externo, secrets e execução de migrations antes da liberação.

Nenhum processo de deploy deve substituir os quality gates e o checklist pré-produção acima.
