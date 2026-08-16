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
- acessar a área pelo menu lateral ou pela identidade no cabeçalho;
- solicitar a verificação do e-mail autenticado e confirmá-la por link de uso
  único quando o SMTP estiver habilitado.

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
- alteração de senha autenticada fora do fluxo de recuperação.

O e-mail permanece somente leitura. Google e Credentials continuam
independentes, preservando o bloqueio de vinculação implícita já aplicado no
NextAuth.

## Verificação de e-mail

`POST /api/auth/email-verification/request` exige sessão e sempre deriva o
destinatário do banco. O navegador não escolhe e-mail nem `userId`. O endpoint
possui cota própria por cliente + usuário e nunca devolve o token.

O token usa 256 bits aleatórios. Somente seu SHA-256 é salvo em
`verification_tokens`; o identificador vincula o token ao usuário e a um hash
do e-mail atual. Um novo pedido revoga tokens anteriores, a validade é de 24
horas e uma confirmação bem-sucedida remove os tokens equivalentes.

`GET /verificar-email` não altera dados. Isso evita confirmação acidental por
scanners de links de provedores de e-mail. O usuário precisa acionar o botão,
que envia o token a `POST /api/auth/email-verification/confirm`. Token inválido,
expirado, já usado ou associado a um e-mail que mudou recebe a mesma resposta
genérica. O link mantém o token no fragmento `#token=...`, que não é enviado no
`GET` nem aparece nos access logs do Caddy/Next.js; a página remove o fragmento
da barra antes da confirmação.

O transporte é SMTP neutro e configurado somente por variáveis server-side.
TLS é obrigatório: conexões não implícitas exigem STARTTLS, com TLS 1.2 ou
superior. A ativação operacional está em
[EMAIL_VERIFICATION.md](EMAIL_VERIFICATION.md).

Enquanto SMTP não estiver configurado, login e cadastro continuam funcionando,
mas o envio retorna indisponibilidade genérica. Esta entrega não bloqueia contas
antigas nem transforma `emailVerified` em requisito de login.

## Exportação e exclusão

A exportação autenticada produz um JSON versionado em memória, sem secrets,
hashes ou tokens. O arquivo é entregue diretamente ao navegador e não fica
armazenado pelo Supreme.

A exclusão exige confirmação explícita e identidade reforçada. O servidor
revoga sessões, persiste o estado recuperável da operação, remove arquivos
UploadThing reconhecidos e somente então apaga o usuário em transação. Falha
externa preserva a conta e suas referências para retentativa; o navegador não
escolhe `userId`. A implantação e o smoke destrutivo são separados do smoke
usual e usam exclusivamente contas descartáveis, conforme
[ACCOUNT_DELETION.md](ACCOUNT_DELETION.md).

Qualquer mudança de e-mail ou vínculo entre Google e Credentials exige revisão
de segurança própria. Esses fluxos não devem reutilizar apenas a posse de uma
sessão antiga como prova suficiente de identidade.
