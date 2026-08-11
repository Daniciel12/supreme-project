# Limpeza de arquivos do UploadThing

O Vision Board remove o arquivo remoto gerenciado pelo UploadThing antes de apagar o registro correspondente do PostgreSQL.

## Ordem e segurança

1. a API exige sessão autenticada;
2. valida o UUID recebido;
3. busca a imagem por `id` **e** `userId` da sessão;
4. reconhece somente URLs HTTPS do formato atual `https://<app>.ufs.sh/f/<fileKey>` ou legado `https://utfs.io/f/<fileKey>`;
5. para arquivos reconhecidos, solicita a exclusão ao UploadThing;
6. somente depois remove o registro do banco.

URLs externas ou legadas fora desses hosts continuam podendo ter o registro removido, mas nunca são convertidas em uma chave enviada ao provider. Isso evita transformar uma URL arbitrária em uma operação externa.

Se a chamada ao UploadThing falhar, a requisição retorna erro e o registro permanece no PostgreSQL. O vínculo preservado permite repetir a exclusão depois que o provider voltar a responder, evitando perder a referência necessária para limpeza.

## Operação

A `UTApi` usa o token do UploadThing disponível somente no ambiente do servidor. Não registre o token em logs, issues, documentação ou Git.

Depois do deploy, valide com uma imagem descartável criada pela própria aplicação:

1. faça upload autenticado;
2. confirme que a imagem aparece no Vision Board;
3. exclua a imagem pela interface;
4. confirme resposta de sucesso e ausência do registro;
5. confirme no painel do UploadThing que o arquivo não existe mais.

Não execute limpeza em massa de arquivos históricos como parte desse smoke. Qualquer reconciliação de órfãos antigos deve ser uma operação separada, auditável e inicialmente em modo dry-run.
