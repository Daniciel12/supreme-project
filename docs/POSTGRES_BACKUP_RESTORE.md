# Backup externo e restore seguro do PostgreSQL

Este runbook prepara o gate operacional da issue #34 sem acessar secrets pelo repositório e sem restaurar sobre produção.

## Garantias do fluxo

- `scripts/postgres-backup.sh` cria um dump customizado com `pg_dump`, sem ownership ou ACLs, valida a estrutura e calcula SHA-256;
- parâmetros exclusivos do Prisma, como `schema`, são removidos da cópia interna da URL antes de chamar `pg_dump`; a URL original não é alterada nem impressa;
- o dump e o checksum são enviados para um destino externo via `rclone`;
- o backup é baixado novamente e seu SHA-256 é comparado antes de o comando ser considerado bem-sucedido;
- `scripts/postgres-restore-test.sh` baixa um objeto escolhido explicitamente e restaura somente em um container PostgreSQL temporário;
- o container de restore usa `--network none`, não publica portas e mantém os dados em `tmpfs`;
- ao terminar ou falhar, o container e os arquivos temporários são removidos;
- o script de restore não lê nem aceita `DATABASE_URL`, portanto não possui um alvo configurável que possa apontar para produção.

O teste confirma integridade de transporte, legibilidade do archive, restauração completa, presença das tabelas da aplicação e ausência de migrations Prisma incompletas. Ele não substitui uma validação funcional da aplicação após um desastre real.

## Pré-requisitos na VPS

1. Docker Engine funcional para o usuário operacional.
2. `rclone` instalado e configurado com um remote externo à VPS.
3. Um bucket/conta dedicado, com criptografia, versionamento ou proteção contra exclusão quando o provedor oferecer esses recursos.
4. Uma política de retenção configurada no próprio storage. Os scripts deliberadamente não apagam backups remotos.
5. Espaço temporário suficiente para o dump e para a cópia usada na verificação.

Use credenciais exclusivas e de menor privilégio para o remote. O arquivo de configuração do `rclone` deve ficar fora do repositório, com permissão `0600`. Não cole sua configuração, chaves ou URLs do banco em issues, PRs ou logs.

### Cloudflare R2 com token limitado ao bucket

Tokens R2 com permissão `Object Read & Write` aplicada somente ao bucket não podem executar operações administrativas de bucket. Para evitar que o `rclone` tente essas operações antes do upload, mantenha esta opção no remote:

```ini
no_check_bucket = true
```

Sem essa opção, leituras podem funcionar enquanto uploads falham com `AccessDenied`, mesmo quando o token possui permissão de escrita nos objetos. Valide a configuração com um upload de arquivo de tamanho conhecido; `rclone rcat` usa streaming e não reproduz necessariamente o caminho usado pelo script de backup.

Algumas versões do `rclone config update` imprimem o remote completo após a alteração, inclusive credenciais. Não execute esse comando em uma sessão gravada nem publique sua saída. Edite o arquivo protegido diretamente ou use o assistente interativo sem compartilhar a tela, confirme `chmod 600` e rotacione imediatamente qualquer credencial que aparecer em logs ou capturas.

O `POSTGRES_CLIENT_IMAGE` usa `postgres:16` por padrão e deve manter o mesmo major do servidor. Antes da primeira execução, registre o digest aprovado da imagem no procedimento operacional da VPS.

## Configuração fora do repositório

Prepare um arquivo protegido, por exemplo `/etc/supreme/backup.env`:

```bash
DATABASE_URL=postgresql://definido-somente-na-vps
POSTGRES_DOCKER_NETWORK=supreme_private
POSTGRES_CLIENT_IMAGE=postgres:16
RCLONE_DESTINATION=storage-externo:supreme/postgres
RCLONE_CONFIG=/etc/supreme/rclone.conf
RESTORE_TMPFS_SIZE=2g
```

Esse exemplo contém apenas placeholders. Não versione o arquivo real. A rede deve ser a rede Docker privada na qual o hostname do PostgreSQL é resolvido; confirme o nome no servidor sem publicar a porta do banco.

Carregue a configuração em uma sessão administrativa controlada:

```bash
set -a
source /etc/supreme/backup.env
set +a
```

Não passe `DATABASE_URL` diretamente na linha de comando, pois argumentos podem aparecer na lista de processos ou no histórico do shell.

## Executar e validar um backup

No checkout fixado em um SHA aprovado:

```bash
backup_object="$(bash scripts/postgres-backup.sh)"
printf 'Objeto criado: %s\n' "$backup_object"
```

O comando só imprime o nome do objeto em `stdout`; os logs não mostram a URL do banco. Sucesso significa que o dump foi criado, validado, enviado e baixado novamente com o mesmo SHA-256.

Registre fora do repositório:

- horário UTC;
- nome do objeto retornado;
- tamanho observado no storage;
- resultado do comando;
- pessoa responsável pela execução.

Não registre connection strings, caminhos de configuração contendo credenciais ou conteúdo do dump.

## Testar restore descartável

Use exatamente o nome retornado pelo backup:

```bash
BACKUP_OBJECT="$backup_object" bash scripts/postgres-restore-test.sh
```

O script baixa o dump e o checksum, valida ambos, inicia um PostgreSQL isolado, restaura, verifica schema/migrations e destrói o ambiente temporário. Ele nunca se conecta ao PostgreSQL de produção.

Para testar um backup anterior, informe apenas um nome no formato aceito:

```bash
bash scripts/postgres-restore-test.sh supreme-YYYYMMDDTHHMMSSZ.dump
```

## Agendamento controlado

Depois de uma execução manual bem-sucedida:

1. execute o backup por um timer do sistema com usuário operacional dedicado;
2. carregue variáveis por um arquivo protegido, nunca por argumentos;
3. envie falhas do timer para o canal de alertas sem anexar o ambiente ou o dump;
4. faça restore descartável periódico a partir de um objeto escolhido explicitamente;
5. revise retenção, versionamento e alertas do storage separadamente;
6. mantenha pelo menos uma cópia fora da conta/servidor da VPS.

Não automatize restore de produção. Em desastre, crie um banco novo, restaure nele, valide aplicação e dados, e só altere o tráfego após aprovação humana e plano documentado.

## Critérios para marcar os gates da issue #34

`backup externo configurado`:

- execução real na VPS terminou com upload e round-trip verificados;
- o objeto aparece no storage externo e está coberto por retenção/proteção;
- falhas de agendamento geram alerta.

`restore testado`:

- um objeto real da VPS passou por `postgres-restore-test.sh`;
- o resultado e horário foram registrados sem secrets;
- o container temporário foi removido;
- nenhuma alteração foi feita no banco de produção.

Somente após essas evidências os dois checkboxes devem ser atualizados. O merge do código, isoladamente, deixa a etapa pronta mas não comprova a execução na VPS.
