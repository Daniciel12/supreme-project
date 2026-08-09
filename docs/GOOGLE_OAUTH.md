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

Na futura implantação, configure as duas variáveis Google como secrets do serviço/container na Hostinger, junto de `NEXTAUTH_URL` apontando para a URL HTTPS pública e de um `NEXTAUTH_SECRET` forte. Reinicie o serviço após alterar as variáveis e confirme que a callback cadastrada no Google coincide exatamente com o domínio de produção.

Secrets de produção não pertencem ao repositório, à imagem Docker nem aos argumentos de build.

## Coexistência e account linking

Usuários criados via Google não recebem senha artificial: `User.password` permanece `null`. Por isso, uma conta OAuth-only não autentica pelo Credentials Provider e o bcrypt não é executado para ela.

O Supreme preserva o comportamento seguro padrão `OAuthAccountNotLinked`. Esta implementação não usa `allowDangerousEmailAccountLinking` e não vincula silenciosamente uma conta Google a uma conta Credentials existente com o mesmo e-mail. Account linking manual permanece como follow-up separado.
