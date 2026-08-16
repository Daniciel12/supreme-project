# Exclusão segura de conta

Este runbook cobre implantação e validação controlada da exclusão de conta.
Ele não autoriza apagar contas reais, executar restore sobre produção nem
reduzir a retenção externa de backups.

## Contrato operacional

- o usuário-alvo vem somente da sessão autenticada;
- Credentials exige senha atual; Google exige login dos últimos dez minutos;
- e-mail, frase exata e ciência da retenção de 30 dias são obrigatórios;
- sessões anteriores são revogadas antes da limpeza externa;
- arquivos UploadThing com chave gravada pelo callback verificado são apagados
  antes do usuário;
- falha externa mantém conta, referências e pedido pendente para retentativa;
- a migration é somente aditiva e não apaga dados existentes;
- conclusão preserva apenas evidência técnica mínima, sem conteúdo pessoal; um
  hash irreversível do ID interno permite correlacionar callbacks tardios.

## Antes do deploy

1. confirme CI verde, revisão aprovada e SHA exato do merge;
2. confirme backup externo recente e restore descartável aprovado;
3. confirme saúde do PostgreSQL, aplicação, timer de backup e monitor;
4. prepare duas contas Credentials exclusivamente descartáveis, A e B;
5. não reutilize conta operacional de smoke, administrador ou usuário real.

## Implantação

Siga o runbook normal de deploy por SHA imutável. Aplique a migration pelo
container migrator antes de recriar a aplicação. A migration cria apenas o
enum e a tabela `account_deletion_requests`, seu índice e a relação
`ON DELETE SET NULL`, além da coluna nullable `providerFileKey` em imagens da
Visão. Nenhuma URL histórica é promovida automaticamente a chave confiável.

Não execute SQL manual para excluir usuário e não use restore para desfazer um
teste. Se build, migration, health ou configuração falhar, interrompa e use o
rollback normal da imagem. A tabela aditiva pode permanecer sem afetar a
versão anterior.

## Validação controlada

1. execute o smoke autenticado normal, sem exclusão;
2. entre na conta descartável A, crie um registro marcador e faça upload de uma
   imagem descartável na Visão;
3. confirme que a conta B continua acessível e não vê o marcador de A;
4. exporte A e valide somente a estrutura do arquivo local;
5. em Configurações de A, informe e-mail, senha, frase exata e ciência da
   retenção; confirme a exclusão;
6. confirme redirecionamento para login e impossibilidade de autenticar A;
7. confirme que B ainda autentica e seus dados permanecem intactos;
8. confirme no painel UploadThing que o arquivo descartável de A desapareceu;
9. execute novamente o smoke autenticado normal com a conta operacional;
10. registre apenas status, SHA e horários — nunca e-mail, senha, exportação ou
    URLs assinadas.

Para Google, use outra conta exclusivamente descartável e autentique novamente
imediatamente antes da exclusão. Esse teste é complementar e não substitui o
cenário A/B de isolamento.

## Falha de limpeza remota

Uma resposta `503` significa que o PostgreSQL não foi apagado. Entre novamente
na mesma conta e repita a confirmação quando o UploadThing estiver saudável.
Não remova o usuário manualmente: isso destruiria as referências necessárias à
retentativa.

Pedidos `PENDING_REMOTE_CLEANUP` devem ser investigados sem expor `fileKeys` em
logs ou tickets. Reconciliação automática e limpeza histórica em massa não
fazem parte deste fluxo.

Um pedido pendente com `userId` nulo representa limpeza tardia depois que a
conta já foi removida. A chave veio do callback verificado e permanece
registrada para tratamento operacional; nunca tente reconstruir o usuário.

Registros antigos da Visão sem `providerFileKey` não disparam exclusão externa.
Se houver necessidade de reconciliá-los, faça uma operação separada, auditável
e inicialmente em modo dry-run, usando evidência do provider em vez da URL.

## Backup e disaster recovery

Dados removidos podem permanecer nos backups criptografados até expirar a
retenção externa de 30 dias. Restore continua manual, validado primeiro em
ambiente descartável e nunca é executado sobre produção por este runbook.
Qualquer disaster recovery futuro deve reconciliar exclusões concluídas antes
de disponibilizar dados restaurados.
