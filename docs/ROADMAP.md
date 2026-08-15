# Supreme — Roadmap oficial

**Atualizado em:** 14/08/2026

**Fonte de verdade:** este documento + issues/PRs do GitHub.

## 📍 Estado atual

O Supreme já possui backend multiusuário, módulos principais, CI, Docker e ambiente real em VPS. Backup externo, restore descartável, observabilidade, alertas, UploadThing público, limpeza de arquivos remotos, HSTS/CSP e tratamento controlado de erros OAuth já foram validados em repositório.

O **Frontend v3 está concluído** com Application Shell, Design System v2, login,
Dashboard, módulos principais, experiência mobile-first, identidade Momentum
Noir, motion reduzível e revisão transversal de acessibilidade/performance.

As integrações previstas para esta etapa estão operacionais. Google OAuth foi
validado no ambiente real, coexistindo com Credentials sem vinculação implícita
de contas, e o provisionamento inicial da VPS foi encerrado na issue #34.

Conta e lifecycle foi iniciada com uma área autenticada de perfil e métodos de
acesso. Alteração de e-mail, recuperação, exportação e exclusão continuam
separadas para receber confirmação de identidade e políticas próprias.

**Próximos passos:**
1. ativar e validar o SMTP de verificação de e-mail em produção;
2. validar em produção a recuperação de senha e a invalidação segura de sessões;
3. definir exportação, exclusão e retenção antes das integrações futuras.

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

> A Foundation é a base técnica. O redesign visual definitivo está sendo consolidado incrementalmente no Frontend v3.

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

## ✅ 7. Hardening de produção — concluído

- [x] rate limiting / anti-abuse;
- [x] proteção reforçada de login/cadastro/uploads;
- [x] observabilidade da aplicação;
- [x] alertas operacionais;
- [x] revisão final de HSTS/CSP;
- [x] smoke visual desktop/mobile.

## ✅ 8. Integrações de produção — concluída

- [x] Google OAuth em produção;
- [x] UploadThing validado pela URL pública;
- [x] política de limpeza de arquivos órfãos;
- [x] revisão final de callbacks e erros externos.

Google OAuth passou por health check, login real, conflito seguro com conta
Credentials existente e smoke autenticado de leitura. Os secrets permanecem
somente no servidor e o account linking implícito está bloqueado.

## ✅ 9. Frontend v3 — concluído

- [x] identidade visual definitiva;
  - [x] direção visual e tokens de marca;
  - [x] assinatura compartilhada de shell, cabeçalhos e cards;
  - [x] refinamento editorial de login, Dashboard e módulos;
    - [x] Dashboard;
    - [x] login;
    - [x] módulos;
      - [x] Finanças;
      - [x] Hábitos;
      - [x] Metas;
      - [x] Treinos;
      - [x] Livros;
      - [x] Visão;
- [x] Design System v2;
- [x] novo Application Shell;
- [x] sidebar/header/perfil redesenhados;
- [x] login + onboarding;
- [x] Dashboard v3;
- [x] Finanças v3;
- [x] Hábitos v3;
- [x] Metas v3;
- [x] Treinos v3;
- [x] Livros v3;
- [x] Vision Board v3;
- [x] experiência mobile-first;
- [x] motion e microinterações;
- [x] revisão de acessibilidade e performance.

## ⏳ 10. Conta e lifecycle

- [ ] recuperação de senha;
  - [x] fluxo seguro, sessão revogável, UI e runbook versionados;
  - [ ] SMTP, reset real e invalidação de sessão validados em produção;
- [ ] verificação de e-mail;
  - [x] fluxo seguro, tokens não reversíveis, UI e runbook versionados;
  - [ ] SMTP de produção e confirmação real validados;
- [x] perfil/configurações;
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
