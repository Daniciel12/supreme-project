# Validação de produção da alteração de e-mail

Esta evidência registra a validação controlada realizada em 16/08/2026 para o
fluxo versionado em [EMAIL_CHANGE.md](EMAIL_CHANGE.md). Nenhum endereço, senha,
token, cookie, link de confirmação ou conteúdo de mensagem foi registrado.

## Release validada

- PR: `#98`;
- SHA de produção: `8982474c782c8e3155942a7a238506bf982cc1da`;
- imagem: `supreme-app:8982474c782c`;
- migration: `20260816180000_add_case_insensitive_email_uniqueness`;
- checks `validate`, `production-container` e `notify`: aprovados.

## Gates anteriores ao deploy

- o preflight agregado encontrou `0` grupos de e-mails conflitantes;
- o backup externo diário mais recente possuía dump e checksum;
- o dump foi baixado e restaurado em PostgreSQL descartável, sem rede e com
  armazenamento temporário;
- estrutura do arquivo, histórico de migrations e tabelas da aplicação foram
  validados no restore;
- nenhum restore foi executado sobre produção;
- as imagens `app` e `migrate` foram construídas a partir do mesmo SHA.

## Deploy e observabilidade

- a migration aditiva foi aplicada pelo migrator separado;
- o índice funcional `users_email_lower_key` foi confirmado no PostgreSQL;
- health local e health público retornaram sucesso;
- a página pública de confirmação respondeu `200`;
- token inválido na API de confirmação respondeu `400` sem mutação;
- Configurações continuou protegida para visitantes sem sessão;
- rotação `json-file` permaneceu limitada a `10m` por arquivo e 5 arquivos;
- timers de backup e monitoramento permaneceram ativos;
- não restaram containers temporários de migration ou restore.

## Fluxo funcional descartável

Duas contas Credentials e caixas postais controladas foram usadas apenas para
esta validação. A conta operacional de smoke não participou da troca.

- a conta A criou um marcador antes da solicitação;
- a senha atual foi exigida para solicitar o novo endereço;
- o endereço anterior recebeu o aviso inicial e o novo recebeu a confirmação;
- o endereço anterior permaneceu ativo até a confirmação explícita;
- o fragmento com o token foi removido da URL antes da ação do usuário;
- abrir o link não alterou a conta; o botão de confirmação foi obrigatório;
- o endereço anterior recebeu o aviso final;
- a sessão emitida antes da troca foi recusada;
- o login pelo endereço anterior falhou e o novo endereço autenticou;
- o marcador permaneceu associado à mesma conta;
- a segunda utilização do link foi bloqueada;
- uma tentativa com diferença de maiúsculas/minúsculas para o endereço já
  usado pela conta B foi recusada sem envio de novo link;
- as duas contas permaneceram isoladas e inalteradas após a colisão;
- as duas contas descartáveis foram excluídas e seus logins foram recusados.

Depois da limpeza, as contagens agregadas confirmaram `0` tokens pendentes de
troca de e-mail e `0` grupos de endereços conflitantes.

## Smokes finais

O smoke autenticado passou antes e depois do fluxo funcional. Em ambos os
casos foram validados health, autenticação Credentials, 8 páginas, 12 APIs de
leitura e exportação de dados da conta operacional. O teste final terminou com
`POST_EMAIL_CHANGE_SMOKE: OK`.

Esta evidência confirma o fluxo Credentials. O contrato de conta somente
Google continua coberto pelos testes automatizados e pela autenticação Google
de produção já validada, sem habilitar vinculação implícita por e-mail.
