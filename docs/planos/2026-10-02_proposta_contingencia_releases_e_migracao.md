# Proposta: Contingência de Releases, Migrações Seguras e Estratégia de Rollback

**Status:** Pendente de aprovação  
**Data:** 02/10/2026  
**Contexto:** Investigação pós-falha da release v1.2.0 (incompatibilidade com SQLite em bancos pré-existentes)

---

## 1. Diagnóstico da Falha na v1.2.0

A release v1.2.0 apresentou falha de inicialização em clientes que possuíam bancos de versões anteriores (como v1.1.23). A causa raiz identificada e reproduzida foi:

1. **Inversão de ordem em `initializeSchema`:** No refactor de `schemaMigrations.ts`, `db.exec(readSchemaFile())` foi colocado antes de `applyColumnMigrations(db)`.
2. **Índices parciais em colunas inexistentes:** O arquivo `schema.sql` contém `CREATE INDEX IF NOT EXISTS ... WHERE deleted_at IS NULL;`. Em bases onde a coluna `deleted_at` ainda não havia sido adicionada, o SQLite lançou `SqliteError: no such column: deleted_at`, abortando o startup sem tratamento de erro.
3. **Módulo nativo `better-sqlite3` fora do `asarUnpack`:** O binário `.node` compactado dentro do `app.asar` pode ser bloqueado por antivírus ou restrições de permissão temporária do Windows.
4. **Fechamento permanente de conexão em rotinas de restauração:** A chamada de `close()` na instância singleton de banco deixava a aplicação inoperante com a mensagem *"The database connection is not open"* se o processo não encerrasse de imediato.
5. **Erros de startup silenciosos:** Falhas na inicialização usavam `console.error` em vez de `electron-log`, impossibilitando diagnóstico via arquivo de log em máquinas de produção.

---

## 2. Correções Técnicas Imediatas (Próxima Release)

1. **Reordenação e Isolamento de Schema:**
   - Executar migrações incrementais de colunas (`applyColumnMigrations`) antes de qualquer instrução de criação de índices dependentes.
   - Extrair a criação de índices parciais para uma etapa posterior e protegida contra exceções fatais.
2. **Empacotamento Nativo Robusto:**
   - Adicionar `"**/node_modules/better-sqlite3/**/*"` à diretiva `asarUnpack` do `package.json`.
3. **Observabilidade de Startup:**
   - Substituir `console.error` por `log.error` no catch do `app.whenReady()` em `main.ts`.
4. **Resiliência do DatabaseAdapter:**
   - Proteger o ciclo de vida da conexão contra chamadas residuais pós-fechamento.
5. **Suite de Regressão de Migração Histórica:**
   - Testar `new DatabaseAdapter()` contra bancos mockados sem colunas introduzidas em releases passadas.

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
