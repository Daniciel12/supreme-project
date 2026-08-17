# Open Finance — contrato de provider

## Objetivo

Esta etapa cria a fronteira interna, vendor-neutral e exclusivamente server-side
para uma futura integração com o Open Finance Brasil. Ela não conecta o Supreme
a uma instituição, não solicita consentimento real e não armazena credenciais.

As referências funcionais são a documentação oficial do ecossistema:

- [Consentimento — orientações](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/219480491);
- [API de consentimentos](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1378385938);
- [API de contas](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/17371726);
- [Contas — orientações](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/193658890).

## Fronteira interna

O núcleo está em `src/lib/open-finance/`:

- `contracts.ts` define contratos e validações em runtime;
- `provider.ts` envolve qualquer adapter com validação de entrada e saída;
- `registry.ts` registra providers sem expor a implementação ao restante da aplicação.

Um adapter deverá implementar somente estas operações:

1. iniciar o consentimento;
2. consultar o estado da conexão;
3. revogar a conexão;
4. listar contas e saldos;
5. listar transações de uma conta com paginação.

Consentimento e conexão são estados explícitos. O contrato preserva os estados
oficiais de consentimento (`AWAITING_AUTHORISATION`, `AUTHORISED` e `REJECTED`)
e os traduz para um ciclo interno de conexão sem esconder expiração, última
sincronização ou revogação.

## Integridade e idempotência

- Valores monetários atravessam a fronteira como strings decimais. `number` não
  é aceito para evitar perda de precisão.
- Cada conta e transação mantém o registro original do provider em `raw` para
  auditoria e reprocessamento. Esse conteúdo é sensível e não deve ser enviado
  diretamente ao cliente nem escrito em logs.
- `externalTransactionId` é obrigatório e estável. A chave calculada por
  `openFinanceExternalKey` combina provider, conexão, tipo do recurso e ID
  externo em um hash sem ambiguidades de delimitador.
- Quando houver persistência, a chave deverá compor uma restrição única também
  vinculada ao usuário proprietário. Repetir a sincronização deve atualizar o
  mesmo registro, nunca criar uma segunda transação.
- Paginação que informa mais resultados é inválida sem cursor para continuação.

## Segurança

- Todo o módulo importa `server-only`.
- Callbacks de autorização aceitam somente HTTPS.
- Entradas e respostas externas passam por Zod antes de cruzar a fronteira.
- Falhas inesperadas são convertidas em erros sanitizados; respostas ao cliente
  e logs não devem incluir payload, token, secret, URL assinada ou mensagem
  original de terceiros.
- Credenciais futuras devem permanecer no ambiente de execução ou em um cofre,
  com criptografia e rotação documentadas. Nunca entram no Git ou no banco em
  texto puro.
- O registro público expõe apenas ID e nome do provider.

## Fora do escopo desta etapa

- escolher ou acoplar Pluggy, Belvo ou qualquer outro fornecedor;
- credenciais, OAuth/FAPI, certificados, mTLS, webhooks ou secrets;
- tabelas, migrations, endpoints públicos ou interface de usuário;
- sincronização automática, backfill ou reconciliação;
- executar consentimento ou movimentar dados financeiros reais.

## Próxima etapa segura

1. modelar persistência aditiva para conexão, consentimento e identificadores
   externos, sempre com ownership por usuário;
2. definir criptografia, rotação, retenção e auditoria para dados sensíveis;
3. registrar em ADR a escolha de um sandbox e seus requisitos de segurança;
4. implementar um único adapter de sandbox atrás desta fronteira;
5. testar idempotência, paginação, revogação, retomada e isolamento A/B antes de
   qualquer piloto com dados reais.
