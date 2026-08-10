# Supreme — Roadmap oficial

**Atualizado em:** 10/08/2026  
**Fonte de verdade:** este documento + issues/PRs do GitHub.

## 📍 Estado atual

O Supreme já possui backend multiusuário, módulos principais, CI, Docker e ambiente real em VPS. Backup externo e restore descartável já foram validados. O foco atual é fechar os gates restantes de produção e então iniciar o **Frontend v3**.

**Próximos passos:**
1. observabilidade e alertas da aplicação;
2. smoke visual desktop/mobile;
3. Google OAuth e validação pública do UploadThing;
4. Frontend v3 / redesign completo.

## ✅ 1. Fundação técnica — concluída

- Next.js, React e TypeScript;
- PostgreSQL + Prisma;
- NextAuth Credentials;
- UploadThing;
- CI / GitHub Actions;
- validação Zod;
- ownership por sessão;
- security headers e auditoria de dependências;
- Docker com runner e migrator separados.

## ✅ 2. Módulos de produto v2 — concluídos

- Dashboard operacional;
- Finanças v2 com dinheiro decimal-safe, contas, pago/pendente e filtros;
- Metas + Hábitos v2 com progresso, deadlines e check-ins reais;
- Treinos + Evolução v2 com histórico diário e evolução física;
- Livros v2 com progresso de leitura;
- Vision Board v2 com upload autenticado.

## ✅ 3. Frontend Foundation — concluída

- design tokens;
- componentes compartilhados;
- Application Shell;
- sidebar/header;
- navegação desktop/mobile;
- loading, empty e error states;
- base responsiva e acessível.

> A Foundation é a base técnica. O redesign visual definitivo será feito no Frontend v3.

## ✅ 4. VPS e deploy controlado — operacional

- Ubuntu VPS;
- Docker Engine + Compose;
- PostgreSQL sem exposição pública;
- aplicação atrás de reverse proxy;
- DNS + HTTPS/TLS;
- firewall;
- SSH por chave;
- health check público;
- smoke autenticado;
- deploy por SHA imutável.

## ✅ 5. Isolamento multiusuário — concluído

- sessões independentes A/B;
- B não lista, altera ou remove dados de A nos testes automatizados;
- smoke multiusuário no CI;
- logout explícito;
- identidade da conta visível;
- reset completo do estado do cliente em login/logout;
- teste manual A → Sair → B aprovado.

P0 #35: **resolvido**.

## ✅ 6. Backup e disaster recovery — concluído

- backup externo PostgreSQL;
- checksum e validação do dump;
- restore somente em ambiente descartável;
- runbook versionado;
- agendamento diário monitorado preparado;
- retenção externa documentada.

O restore de produção continua deliberadamente manual e nunca é automatizado.

## 🔵 7. Hardening de produção — etapa atual

- [x] rate limiting / anti-abuse;
- [x] proteção reforçada de login/cadastro/uploads;
- [ ] observabilidade da aplicação;
- [ ] alertas operacionais;
- [ ] revisão final de HSTS/CSP;
- [ ] smoke visual desktop/mobile.

## 🟡 8. Integrações de produção — próxima

- [ ] Google OAuth em produção;
- [ ] UploadThing validado pela URL pública;
- [ ] política de limpeza de arquivos órfãos;
- [ ] revisão final de callbacks e erros externos.

## 🎨 9. Frontend v3 — próxima grande fase

- [ ] identidade visual definitiva;
- [ ] Design System v2;
- [ ] novo Application Shell;
- [ ] sidebar/header/perfil redesenhados;
- [ ] login + onboarding;
- [ ] Dashboard v3;
- [ ] Finanças v3;
- [ ] Hábitos v3;
- [ ] Metas v3;
- [ ] Treinos v3;
- [ ] Livros v3;
- [ ] Vision Board v3;
- [ ] experiência mobile-first;
- [ ] motion e microinterações;
- [ ] revisão de acessibilidade e performance.

## ⏳ 10. Conta e lifecycle

- [ ] recuperação de senha;
- [ ] verificação de e-mail;
- [ ] perfil/configurações;
- [ ] exportação de dados;
- [ ] exclusão de conta;
- [ ] políticas de retenção e privacidade.

## ⏳ 11. Open Finance

- [ ] abstração de provider;
- [ ] consentimento;
- [ ] integração bancária brasileira;
- [ ] sincronização e webhooks;
- [ ] reconciliação e tratamento de falhas.

## ⏳ 12. Supreme como SaaS

- [ ] billing;
- [ ] planos e limites;
- [ ] checkout e assinaturas;
- [ ] trial;
- [ ] onboarding comercial;
- [ ] landing page;
- [ ] operação de suporte.

## ⏳ 13. Analytics e inteligência

- [ ] gráficos financeiros e patrimônio;
- [ ] analytics de hábitos;
- [ ] analytics de treinos e evolução corporal;
- [ ] evolução de metas;
- [ ] insights automáticos;
- [ ] relatórios e automações.

## 🏁 Objetivo

Transformar o Supreme em uma plataforma pessoal integrada para **finanças + metas + hábitos + treinos + saúde + livros + visão pessoal + automação + inteligência**, com arquitetura multiusuário segura e preparada para evolução como SaaS.
