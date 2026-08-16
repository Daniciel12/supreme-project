# Validação de autenticação por e-mail em produção

**Data:** 16/08/2026

Este registro encerra os gates de produção de recuperação de senha e
verificação de e-mail. Ele documenta somente resultados agregados. Endereços de
conta, links, tokens, hashes, credenciais SMTP e dados pessoais foram
deliberadamente omitidos.

## Ambiente validado

- aplicação pública servida por HTTPS;
- SMTP configurado somente no ambiente de execução da VPS;
- imagem de aplicação fixada no SHA aprovado;
- container da aplicação saudável durante e depois dos testes.

## Recuperação de senha

- solicitação genérica não revelou se a conta existia;
- mensagem real chegou à caixa controlada pelo operador;
- token permaneceu somente no fragmento do link e foi consumido uma única vez;
- senha nova foi persistida sem registrar seu valor nos comandos ou logs;
- corte persistente de sessões anteriores foi gravado no mesmo instante;
- token pendente de uma conta operacional substituída foi revogado sem alterar
  a conta ou seus dados;
- autenticação com a credencial nova passou no smoke oficial.

## Verificação de e-mail

- solicitação autenticada enviou a mensagem ao endereço da própria sessão;
- abrir o link não alterou a conta e manteve o token pendente;
- a confirmação exigiu um `POST` explícito;
- a data de verificação foi persistida e o token foi removido;
- a reutilização do mesmo link retornou erro genérico;
- Configurações exibiu o selo de e-mail verificado e deixou de oferecer novo
  envio para a conta confirmada.

## Regressão autenticada

O smoke oficial executado depois da confirmação aprovou:

- health check público;
- autenticação por Credentials;
- 8 páginas autenticadas;
- 12 APIs autenticadas.

Resultado final: `EMAIL_VERIFICATION_SMOKE: OK`.

## Conclusão

Os itens de recuperação de senha e verificação de e-mail podem ser marcados
como concluídos no roadmap. Exportação de dados, exclusão de conta, retenção,
privacidade e alteração de e-mail permanecem fora deste escopo.
