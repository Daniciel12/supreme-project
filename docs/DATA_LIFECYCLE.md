# Dados da conta, retenção e exclusão

Este documento define a baseline técnica de lifecycle do Supreme. Ele não
substitui uma política de privacidade pública nem aconselhamento jurídico para
uma operação comercial.

## Exportação disponível

Uma sessão autenticada pode solicitar `POST /api/account/export` pela página de
Configurações. A resposta é um arquivo JSON criado em memória e enviado como
download; o Supreme não grava uma cópia do arquivo no servidor.

O contrato usa `format: "supreme-account-export"` e `version: 1`. Valores
monetários são strings com duas casas decimais para não perder precisão. Datas
e horários usam ISO 8601. A ordem dos registros é determinística para facilitar
comparação e importação futura.

### Dados incluídos

- perfil e datas da conta;
- hábitos e check-ins;
- metas e tarefas;
- treinos e conclusões diárias;
- evolução física;
- contas e transações financeiras;
- livros;
- referências das imagens de perfil, evolução e Visão.

Arquivos remotos não são duplicados dentro do JSON. Suas URLs aparecem como
referências para que uma exportação futura em arquivo compactado possa baixar
os binários sem mudar o contrato atual.

### Dados sempre excluídos

- hash da senha e corte interno de sessões;
- cookies, sessões e tokens do NextAuth;
- tokens de verificação ou recuperação;
- IDs, tokens e metadados internos de provedores OAuth;
- credenciais SMTP, UploadThing, banco, backup ou infraestrutura;
- logs e dados de outras contas.

A consulta parte exclusivamente do ID da sessão. Relações que também possuem
`userId` repetem o filtro do usuário autenticado para não depender somente da
integridade do relacionamento pai. O endpoint limita cada combinação de conta
e cliente a três exportações por hora.

## Baseline de retenção

| Categoria | Retenção técnica atual | Regra de lifecycle |
| --- | --- | --- |
| Arquivo de exportação | não é persistido | existe somente no dispositivo do usuário depois do download |
| Dados ativos da conta | enquanto a conta existir | são removidos após exclusão explícita e limpeza remota confirmada |
| Tokens de recuperação | 60 minutos | expiração impede uso; confirmação ou novo pedido revoga o token anterior |
| Tokens de verificação | 24 horas | expiração impede uso; confirmação ou novo pedido revoga o token anterior |
| Sessões | até expiração, logout ou revogação | reset de senha invalida sessões anteriores pelo corte persistente |
| Logs do container | rotação por tamanho, 10 MB × 5 | não devem conter senha, token, credencial ou payload completo de exportação |
| Backups PostgreSQL | 30 dias | expiram pela política externa; restore permanece manual e controlado |
| Arquivos UploadThing | enquanto houver registro válido com chave verificada | a exclusão remove o arquivo antes do registro; falhas preservam conta e referências para retentativa |

A expiração lógica dos tokens já é aplicada nas rotas. Uma limpeza física
periódica de tokens expirados deve fazer parte do job futuro de lifecycle; até
lá, um token expirado pode permanecer armazenado como hash, mas não pode ser
usado.

## Exclusão de conta

`DELETE /api/account` deriva o usuário exclusivamente da sessão e exige o
e-mail exato, a frase `EXCLUIR MINHA CONTA` e ciência da retenção de backup.
Contas Credentials também confirmam a senha atual. Contas somente Google
exigem autenticação emitida nos últimos dez minutos. Em ambos os métodos, isso
constitui a confirmação recente da identidade antes da operação destrutiva.

A operação usa duas fases recuperáveis:

O objetivo da fase externa é remover arquivos UploadThing com retentativa idempotente,
usando somente chaves verificadas pelo callback do provider.

1. bloqueia o usuário em transação, revoga sessões e grava um pedido
   `PENDING_REMOTE_CLEANUP` com o inventário de chaves UploadThing comprovadas
   pelo callback do provider;
2. remove os arquivos reconhecidos no provider, volta a bloquear o usuário,
   verifica se surgiu algum arquivo novo e só então apaga o usuário e suas
   relações por cascata;
3. preserva um registro técnico `COMPLETED`, sem `userId` nem conteúdo pessoal,
   com apenas um hash irreversível do identificador interno para correlacionar
   callbacks tardios e distinguir conclusão de estado parcial.

Se o provider falhar, a conta e suas referências permanecem no banco e o
pedido continua pendente para nova tentativa. As sessões emitidas antes do
pedido deixam de valer. Um novo login permite repetir a operação, mas uploads
ficam bloqueados enquanto a limpeza estiver pendente. O callback de upload usa
o mesmo bloqueio do usuário: um arquivo simultâneo entra no inventário ou é
apagado sem criar referência no PostgreSQL.

Se um callback chegar depois da remoção do usuário, o hash técnico localiza o
pedido concluído. A chave verificada é persistida antes da nova tentativa de
limpeza; assim, uma indisponibilidade do provider não transforma o arquivo em
um órfão sem rastreio.

URLs fornecidas pelo cliente não provam propriedade e nunca são convertidas em
chaves de exclusão. Arquivos legados sem chave verificada exigem reconciliação
operacional separada e não bloqueiam a remoção dos dados ativos da conta.

O fluxo não restaura dados e nunca executa restore sobre produção. Backups
externos criptografados podem manter cópias por até 30 dias conforme a política
operacional; expiração e restores controlados devem respeitar pedidos de
exclusão concluídos. O procedimento de implantação e validação está em
[ACCOUNT_DELETION.md](ACCOUNT_DELETION.md).

## Alteração de e-mail

Troca de e-mail não faz parte da exportação nem da exclusão. A solicitação
deriva o usuário da sessão, confirma senha atual ou Google recente, avisa o
endereço anterior e envia ao novo endereço um token de uso único por 60
minutos. O e-mail atual permanece ativo até a confirmação explícita.

A conclusão revalida o endereço anterior, bloqueia colisões sem diferenciar
maiúsculas e minúsculas, marca o novo endereço como verificado e revoga todas
as sessões e tokens concorrentes. O vínculo Google continua ancorado no ID do
provider e nenhuma igualdade de e-mail habilita account linking implícito. O
procedimento de implantação e validação está em
[EMAIL_CHANGE.md](EMAIL_CHANGE.md).

O fluxo Credentials, a colisão case-insensitive, a revogação de sessões e a
limpeza das contas descartáveis foram validados em produção. A evidência
sanitizada está em
[EMAIL_CHANGE_PRODUCTION_VALIDATION.md](EMAIL_CHANGE_PRODUCTION_VALIDATION.md).

## Gates de validação da exportação

- testes automatizados cobrem ausência de sessão, isolamento, conteúdo e erro;
- o download usa `no-store` e não é indexável;
- a UI informa o que entra e o que nunca entra no arquivo;
- lint, typecheck, build e suíte completa devem passar;
- o teste controlado em produção deve inspecionar somente a estrutura, sem
  publicar o conteúdo exportado em logs ou tickets.
