# Rate limiting de cadastro, login e upload

O Supreme aplica limites locais aos três pontos públicos mais sujeitos a abuso:

- cadastro: 5 requisições por cliente a cada 15 minutos;
- login por senha: 10 tentativas por cliente a cada 15 minutos;
- início de upload: 30 requisições por cliente a cada 15 minutos.

O limite de upload protege somente a solicitação iniciada pelo cliente. Callbacks
assinados do UploadThing não passam por essa cota local e continuam sendo
validados pelo próprio handler antes de concluir o processamento.

Ao exceder o limite, a API responde `429` com `Retry-After` e cabeçalhos `RateLimit-*`. O estado fica apenas na memória do processo e possui capacidade limitada para não permitir crescimento irrestrito.

## Ativação atrás do Caddy

Por padrão, todos os acessos usam uma chave compartilhada conservadora. Só habilite a identificação por `X-Forwarded-For` quando:

1. a aplicação estiver publicada apenas em loopback ou rede privada;
2. o Caddy for o primeiro hop público e terminar HTTPS;
3. o backend não puder ser acessado diretamente pela Internet;
4. nenhum CDN ou proxy adicional estiver na frente do Caddy sem uma política explícita de proxies confiáveis.

Nesse cenário, adicione ao `.env.production` local da VPS:

```dotenv
RATE_LIMIT_TRUST_PROXY="true"
```

O Caddy ignora valores `X-Forwarded-*` recebidos de clientes não confiáveis antes de definir os cabeçalhos enviados ao backend. Se um CDN for adicionado no futuro, revise a configuração de `trusted_proxies` do Caddy antes de continuar confiando no cabeçalho.

Depois de alterar o ambiente, recrie o container da aplicação e confirme:

- `/api/health` saudável;
- login válido ainda funciona;
- cadastro e login inválidos passam a retornar `429` após o limite;
- a resposta `429` não revela e-mail, senha, token ou detalhes internos;
- uploads autenticados continuam funcionando dentro do limite.

## Limite da arquitetura atual

O contador é adequado à implantação atual com uma única instância do processo web. Ele é reiniciado em deploys e não é compartilhado entre réplicas. Ao atingir a capacidade de clientes distintos, novas chaves compartilham uma cota conservadora sem expulsar contadores ativos. Antes de escalar horizontalmente, substitua o armazenamento local por um backend distribuído e mantenha os mesmos contratos de resposta e privacidade.
