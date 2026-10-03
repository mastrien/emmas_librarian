# Proposta: Contingência de Releases, Migrações Seguras e Estratégia de Rollback

**Status:** Pendente de aprovação  
**Data:** 02/10/2026  
**Contexto:** Investigação pós-falha da release v1.2.0 (falha de inicialização em outra máquina; release removida)
**Revisado em:** 03/10/2026 — a primeira versão deste diagnóstico atribuía a falha à falta de `deleted_at`, o que os testes abaixo descartaram.

---

## 1. Diagnóstico da Falha na v1.2.0

### 1.1. O que o log da máquina afetada mostra (`main.log` dela, fora do repositório)

- A máquina rodou v1.1.12 (jun), v1.1.22 (ago) e v1.1.23 (01/10 21:17), todas abrindo normalmente. O banco dela, portanto, já tinha `deleted_at` (coluna existe desde a v1.1.12).
- 23:12–23:13: o instalador silencioso da v1.2.0 rodou três vezes (`Auto install update on quit`). As duas reaberturas logo depois ainda eram a v1.1.23 (encontravam a 1.2.0 como novidade): o app foi reaberto enquanto o instalador trabalhava.
- 23:14, 23:14 e 23:18: só `App starting...`, nada depois. A v1.2.0 falhou antes de `Checking for update`, ou seja, dentro de `setupIpcRegistries()` (abertura do banco e serviços). O erro foi para `console.error` e para a caixa de diálogo, não para o log.
- 23:19: de volta à v1.1.23, funcionando.

### 1.2. O que foi testado e não reproduziu a falha

- Banco criado pela v1.1.23 aberto pelo `DatabaseAdapter` da v1.2.0: abre.
- Cadeia da máquina afetada, com dados em todas as áreas: banco criado pela v1.1.12 → aberto pela v1.1.22 → v1.1.23 → v1.2.0: abre, dados preservados.
- v1.2.0 empacotada localmente (`electron-builder --dir`, asar como em produção) sobre uma cópia de um banco real de longa data (criado em maio) e sobre uma pasta vazia: inicia sem erro.
- `schema.sql` da v1.1.23 e da v1.2.0 têm os mesmos comandos (a v1.2.0 só tirou blocos duplicados e acrescentou duas colunas em `search_history`). A ordem "schema.sql antes das colunas" é a mesma nas duas versões.
- A sequência nova do CI de release (`npm test` recompila o better-sqlite3 para Node, depois `rebuild:electron`) deixa o binário do Electron correto ao final, reproduzida localmente.
- `better-sqlite3` já sai em `app.asar.unpacked` sem entrada própria em `asarUnpack` (electron-builder desempacota `.node` sozinho).

### 1.3. Causa: ainda não identificada

O código de banco da v1.2.0 não quebra com um histórico de versões igual ao da máquina afetada. Sobram causas de ambiente que os testes acima não cobrem: o instalador interrompido pelas reaberturas (instalação com arquivos misturados ou faltando), antivírus sobre os arquivos novos, ou algo específico do banco daquela máquina. O texto da caixa de diálogo, ou uma cópia do `emma.db` daquela máquina, decide entre elas.

### 1.4. Defeito real encontrado no caminho

Um banco aberto pela última vez na v1.1.11 ou anterior (sem `deleted_at`) não abre em nenhuma versão desde a v1.1.20: `schema.sql` cria índices `WHERE deleted_at IS NULL` antes de as colunas serem migradas. Não é o que aconteceu na máquina afetada, mas atinge quem pula direto de uma versão antiga.

---

## 2. Correções Técnicas Imediatas (Próxima Release)

1. **Colunas antes do schema:** `applyColumnMigrations` roda antes de `schema.sql` (e de novo depois, para as tabelas que o `schema.sql` acabou de criar sem todas as colunas).
2. **Falha de schema visível:** `schema.sql` continua fora de `logFailure`; abrir sobre um schema pela metade é pior do que não abrir. O `DatabaseAdapter` fecha a conexão antes de repassar o erro, para não deixar o arquivo travado.
3. **Observabilidade de startup:** `log.error` no catch do `app.whenReady()` em `main.ts`, para que a próxima falha fique no `main.log`.
4. **Regressão de migração histórica:** teste com banco sem `deleted_at` e teste de falha do `schema.sql`.
5. **Antes de relançar:** atualizar de verdade, numa máquina limpa, da v1.1.23 instalada para o instalador novo, reabrindo o app enquanto o instalador roda.

---

## 3. Novas Contingências de Atualização e Rollback

Para evitar que futuras atualizações causem indisponibilidade ou perda de dados aos usuários, o ciclo de vida de atualização será reformulado:

### 3.1. Atualização Notificada e Consentida (Opt-in)
- **Desativação do Auto-Download Silencioso:**
  Configurar o `electron-updater` com `autoDownload = false` e `autoInstallOnAppQuit = false`.
- **Notificação Não Obstrutiva na UI:**
  Quando uma release for detectada via GitHub Releases, o aplicativo exibe um banner/toast informativo:
  - Exibição de versão disponível e notas da versão (changelog resumido).
  - Ações claras para o usuário: `[Atualizar Agora]`, `[Ver Notas]`, `[Lembrar Mais Tarde]`.
  - Painel dedicado na página de *Configurações* mostrando o status atual e botão para verificar atualizações sob demanda.

### 3.2. Snapshot Pré-Atualização (Safety Net)
- Antes de disparar a instalação de qualquer nova versão baixada:
  1. O software realiza um checkpoint forçado do WAL (`PRAGMA wal_checkpoint(FULL)`).
  2. Cria uma cópia integral e compactada do banco atual em `%APPDATA%/emmas_librarian/backups/pre_update_{versao_atual}_{timestamp}.db.gz`.
  3. Registra em arquivo de metadados (`update_state.json`) a versão de origem, o caminho do snapshot e o status `pending_verification`.

### 3.3. Verificação Pós-Atualização (Health Check no Primeiro Boot)
- Ao iniciar após uma atualização:
  1. O sistema verifica a flag `pending_verification` no `update_state.json`.
  2. Executa um auto-diagnóstico inicial:
     - Conexão e abertura do SQLite bem-sucedida.
     - Execução de `PRAGMA quick_check;`.
     - Consulta de integridade nas tabelas centrais (`projects`, `articles`, `settings`).
  3. **Se o teste passar:** O status é alterado para `verified` e a inicialização segue normalmente.
  4. **Se o teste falhar:** O aplicativo intercepta o erro antes de abrir a janela principal e aciona o **Modo de Recuperação**.

### 3.4. Modo de Recuperação e Rollback de Emergência
- Caso ocorra falha crítica de banco ou crash no startup pós-atualização:
  - Uma janela nativa de recuperação é apresentada ao usuário informando que a nova versão encontrou um problema ao migrar os dados.
  - Opções disponíveis:
    1. **Restaurar Dados Anteriores:** Restaura o snapshot `pre_update` para garantir que nada foi corrompido.
    2. **Guia de Instalação Estável:** Link direto para download do instalador da versão anterior estável no GitHub Releases.
    3. **Exportar Relatório de Erro:** Botão que copia o log técnico estruturado e empacota o log para facilitar suporte e abertura de issue.
