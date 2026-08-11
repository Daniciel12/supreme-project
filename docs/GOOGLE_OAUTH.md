# Google OAuth

O Supreme mantém o login por e-mail/senha e registra o Google como provider adicional somente quando as duas variáveis abaixo existem no ambiente do servidor:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Não use prefixo `NEXT_PUBLIC_` nessas variáveis. O client secret nunca deve ser enviado ao navegador, incluído em logs, salvo no Git ou copiado para documentação com um valor real.

## Configuração no Google Cloud

Cadastre uma credencial OAuth 2.0 do tipo aplicação Web e configure a URI de callback do NextAuth:

```text
https://SEU_DOMINIO/api/auth/callback/google
```

Para desenvolvimento local, use a origem configurada em `NEXTAUTH_URL`, por exemplo:

```text
http://localhost:3000/api/auth/callback/google
```

Defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no arquivo local de ambiente ignorado pelo Git ou no gerenciador de secrets do ambiente. Quando uma das duas estiver ausente, o Supreme mantém Credentials disponível, não registra Google e não mostra o botão Google na tela de login.

## Produção na Hostinger

Configure as duas variáveis Google somente no arquivo de ambiente do servidor ou secret store usado pelo serviço, junto de `NEXTAUTH_URL` apontando para a URL HTTPS pública e de um `NEXTAUTH_SECRET` forte. Reinicie o serviço após alterar as variáveis e confirme que a callback cadastrada no Google coincide exatamente com o domínio de produção.

Secrets de produção não pertencem ao repositório, à imagem Docker nem aos argumentos de build.

### Procedimento operacional

No diretório do deploy, sem imprimir o conteúdo do arquivo de ambiente:

```bash
set -euo pipefail
cd /CAMINHO/DO/SUPREME

git fetch --all --prune
git checkout SHA_APROVADO

docker compose -f compose.production.yml config --quiet
docker compose -f compose.production.yml up -d --build app

curl --fail --silent --show-error https://SEU_DOMINIO/api/health/ready
```

Depois, valide no navegador:

1. o botão `Continuar com Google` aparece apenas com as duas variáveis configuradas;
2. uma conta Google nova autentica e chega ao Dashboard;
3. logout e login por Credentials continuam funcionando;
4. uma conta Credentials existente com o mesmo e-mail do Google recebe a mensagem de método de acesso diferente, sem vínculo automático;
5. cancelamento/negação no Google retorna para `/login` com mensagem controlada;
6. nenhum token, authorization code ou secret aparece na UI, logs operacionais coletados ou comentários do GitHub.

### Rollback

Se o provider apresentar falhas, remova ou desabilite as duas variáveis Google no ambiente do serviço e reinicie somente a aplicação. Credentials permanece disponível. Não altere `NEXTAUTH_SECRET` durante esse rollback, pois isso invalidaria sessões existentes sem necessidade.

## Coexistência e account linking

Usuários criados via Google não recebem senha artificial: `User.password` permanece `null`. Por isso, uma conta OAuth-only não autentica pelo Credentials Provider e o bcrypt não é executado para ela.

O Supreme preserva o comportamento seguro padrão `OAuthAccountNotLinked`. Esta implementação não usa `allowDangerousEmailAccountLinking` e não vincula silenciosamente uma conta Google a uma conta Credentials existente com o mesmo e-mail. Account linking manual permanece como follow-up separado.

Erros do fluxo OAuth são redirecionados para `/login`. A interface traduz somente casos esperados, como `OAuthAccountNotLinked` e `AccessDenied`; demais códigos recebem uma mensagem genérica para não expor detalhes internos do provider.
