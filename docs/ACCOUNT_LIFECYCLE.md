# Conta e lifecycle

Este documento registra os limites de segurança da área de conta do Supreme.
Cada capacidade sensível deve ser entregue em uma tarefa própria, com testes e
revisão explícita. A existência de `/configuracoes` não autoriza atalhos entre
identidades, métodos de acesso ou usuários.

## Perfil disponível

A primeira etapa permite:

- consultar nome, e-mail e estado de verificação da própria conta;
- identificar se Credentials e Google já estão configurados;
- alterar somente o nome de exibição;
- acessar a área pelo menu lateral ou pela identidade no cabeçalho.

`GET /api/account/profile` e `PATCH /api/account/profile` derivam o usuário
exclusivamente da sessão autenticada. O navegador não envia `userId`, e o
schema Zod estrito rejeita campos como `email`, `password` ou identificadores
de conta externa.

A resposta é um DTO mínimo. Ela nunca inclui hash de senha, ID interno do
usuário, tokens OAuth ou registros da tabela `accounts`.

## Limites deliberados

Esta etapa não oferece:

- troca de e-mail;
- criação, remoção ou vinculação de método de acesso;
- recuperação ou alteração de senha;
- exportação de dados;
- exclusão de conta.

O e-mail permanece somente leitura. Google e Credentials continuam
independentes, preservando o bloqueio de vinculação implícita já aplicado no
NextAuth.

## Requisitos para as próximas entregas

### Recuperação de senha e verificação de e-mail

- tokens aleatórios de uso único, armazenados de forma não reversível;
- validade curta, revogação após uso e limitação de tentativas;
- resposta pública neutra para não enumerar contas;
- provedor de e-mail configurado somente por secrets de produção;
- invalidação ou rotação segura de sessões quando a senha mudar.

### Exportação de dados

- autenticação recente antes de gerar o arquivo;
- escopo exclusivo ao usuário da sessão;
- formato versionado e documentação do que está incluído;
- geração temporária, prazo de expiração e descarte auditável;
- ausência de secrets, hashes, tokens e dados de outros usuários.

### Exclusão de conta e retenção

- confirmação explícita e autenticação recente;
- inventário das cascatas PostgreSQL e dos arquivos no UploadThing;
- política definida para backups externos e prazos legais;
- execução idempotente com estado recuperável quando houver falha parcial;
- nenhum restore sobre produção como parte do fluxo de exclusão.

Qualquer mudança de e-mail ou vínculo entre Google e Credentials exige revisão
de segurança própria. Esses fluxos não devem reutilizar apenas a posse de uma
sessão antiga como prova suficiente de identidade.
