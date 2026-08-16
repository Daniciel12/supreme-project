# Limpeza de arquivos do UploadThing

O Vision Board remove o arquivo remoto gerenciado pelo UploadThing antes de apagar o registro correspondente do PostgreSQL. A chave usada nessa operação vem exclusivamente do callback verificado do uploader e fica separada da URL pública exibida ao usuário.

## Ordem e segurança

1. a API exige sessão autenticada;
2. valida o UUID recebido;
3. busca a imagem por `id` **e** `userId` da sessão;
4. lê `providerFileKey`, gravada server-side pelo callback autenticado do UploadThing;
5. quando a chave verificada existe, solicita a exclusão ao UploadThing;
6. somente depois remove o registro do banco.

URLs recebidas do cliente nunca são convertidas em chave de exclusão. Registros legados sem `providerFileKey` podem ser removidos do PostgreSQL, mas não disparam operação no provider. Isso evita que uma URL forjada tente apagar arquivo pertencente a outra conta.

Se a chamada ao UploadThing falhar, a requisição retorna erro e o registro permanece no PostgreSQL. O vínculo preservado permite repetir a exclusão depois que o provider voltar a responder, evitando perder a referência necessária para limpeza.

## Exclusão da conta

A exclusão da conta inventaria somente chaves de arquivos da Visão cuja origem
foi comprovada pelo callback do UploadThing. Os arquivos são removidos antes do
usuário e das relações PostgreSQL. Uma falha externa mantém a conta, o
inventário e as referências disponíveis para nova tentativa.

O callback do uploader e a preparação da exclusão bloqueiam o mesmo registro
de usuário. Se o callback terminar primeiro, sua imagem entra no inventário.
Se a exclusão entrar primeiro, o callback não persiste a imagem e solicita a
remoção do arquivo recém-enviado. Enquanto um pedido estiver pendente, novas
iniciações de upload são recusadas.

## Operação

A `UTApi` usa o token do UploadThing disponível somente no ambiente do servidor. Não registre o token em logs, issues, documentação ou Git.

Depois do deploy, valide com uma imagem descartável criada pela própria aplicação:

1. faça upload autenticado;
2. confirme que a imagem aparece no Vision Board;
3. exclua a imagem pela interface;
4. confirme resposta de sucesso e ausência do registro;
5. confirme no painel do UploadThing que o arquivo não existe mais.

Não execute limpeza em massa de arquivos históricos como parte desse smoke. Qualquer reconciliação de órfãos antigos deve ser uma operação separada, auditável e inicialmente em modo dry-run.

Arquivos anteriores à coluna `providerFileKey` não são apagados
automaticamente. A reconciliação deles exige evidência independente no
provider; inferir propriedade somente pela URL é deliberadamente proibido.
