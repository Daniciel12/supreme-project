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
| Dados ativos da conta | enquanto a conta existir | permanecem disponíveis até uma exclusão explícita futura |
| Tokens de recuperação | 60 minutos | expiração impede uso; confirmação ou novo pedido revoga o token anterior |
| Tokens de verificação | 24 horas | expiração impede uso; confirmação ou novo pedido revoga o token anterior |
| Sessões | até expiração, logout ou revogação | reset de senha invalida sessões anteriores pelo corte persistente |
| Logs do container | rotação por tamanho, 10 MB × 5 | não devem conter senha, token, credencial ou payload completo de exportação |
| Backups PostgreSQL | 30 dias | expiram pela política externa; restore permanece manual e controlado |
| Arquivos UploadThing | enquanto houver registro válido | exclusão futura deve remover o arquivo ou registrar retentativa segura |

A expiração lógica dos tokens já é aplicada nas rotas. Uma limpeza física
periódica de tokens expirados deve fazer parte do job futuro de lifecycle; até
lá, um token expirado pode permanecer armazenado como hash, mas não pode ser
usado.

## Exclusão de conta — contrato antes da implementação

A exclusão ainda não está disponível. Sua implementação deve cumprir todos os
gates abaixo antes de aparecer na interface:

1. exigir sessão válida e confirmação recente da identidade;
2. explicar claramente os dados afetados e oferecer exportação antes da ação;
3. impedir que o cliente escolha outro `userId`;
4. invalidar sessões antes de iniciar a remoção;
5. remover dados relacionais em transação controlada, sem migration destrutiva;
6. remover arquivos UploadThing com retentativa idempotente;
7. não reativar dados apagados durante um restore de disaster recovery;
8. informar que cópias em backup desaparecem pela retenção externa de 30 dias;
9. produzir apenas evidência operacional mínima, sem manter conteúdo pessoal;
10. validar isolamento com duas contas e executar o smoke completo.

Falha na limpeza de um arquivo remoto não pode restaurar a conta nem deixar a
operação em estado ambíguo. O desenho final deve adotar uma fila ou estado de
retentativa antes que a exclusão seja liberada em produção.

## Alteração de e-mail — contrato separado

Troca de e-mail não faz parte da exportação nem da exclusão. O fluxo futuro
deve confirmar identidade recente, verificar o endereço novo, notificar o
endereço anterior, bloquear colisões e preservar a regra que proíbe vinculação
OAuth implícita.

## Gates de validação da exportação

- testes automatizados cobrem ausência de sessão, isolamento, conteúdo e erro;
- o download usa `no-store` e não é indexável;
- a UI informa o que entra e o que nunca entra no arquivo;
- lint, typecheck, build e suíte completa devem passar;
- o teste controlado em produção deve inspecionar somente a estrutura, sem
  publicar o conteúdo exportado em logs ou tickets.
