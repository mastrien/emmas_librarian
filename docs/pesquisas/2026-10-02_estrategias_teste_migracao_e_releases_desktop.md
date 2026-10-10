# Pesquisa: Estratégias de Teste de Migração, Transição Segura entre Releases e Rollback em Aplicações Desktop

**Data:** 02/10/2026  
**Contexto:** Investigação pós-falha da release v1.2.0 e definição de salvaguardas para transição de versões em desktop apps (Electron + SQLite).

---

## 1. O Desafio Peculiar de Aplicações Desktop "Local-First"

Em sistemas Web / SaaS, as migrações de banco são lineares e centralizadas: a equipe roda a migração contra o banco de produção uma única vez antes de redirecionar o tráfego dos servidores.

Em aplicativos desktop (como *Emma's Librarian*, *Obsidian*, *1Password*, *Signal Desktop*, *VS Code* e *Bitwarden*), o cenário é radicalmente diferente:
1. **Dispersão de Versões:** Um usuário pode atualizar diretamente da versão `v1.0.0` para a `v1.2.0`, pulando meses de releases intermediárias.
2. **Ambiente Não Controlado:** Antivírus, permissões restritas de escrita, falhas de energia durante o startup ou corrupções parciais de arquivo ocorrem na máquina do cliente.
3. **Custo de Falha Catastrófico:** Se uma migração falha e corrompe o arquivo local do usuário, não existe backup central na nuvem para onde reverter sem intervenção direta.

---

## 2. Como a Indústria Garante Transições Seguras

A pesquisa de práticas em projetos open-source e corporativos maduros revela 4 pilares adotados:

### Pilar 1: "Golden Fixtures Matrix" (Matriz de Bancos Históricos)
Em vez de apenas testar migrações a partir de um banco em branco, o projeto armazena snapshots reais ou gerados sinteticamente de versões marcantes:
- `test/fixtures/legacy_dbs/v1.0.0_populated.db`
- `test/fixtures/legacy_dbs/v1.1.17_populated.db`
- `test/fixtures/legacy_dbs/v1.1.23_populated.db`

**Execução no CI:**
Em cada Pull Request e em cada pipeline de release, um teste automatizado (rápido, executado em Node/Electron unbundled):
1. Copia a fixture para uma pasta temporária.
2. Instancia o `DatabaseAdapter` da versão atual sobre ela.
3. Executa asserções estritas:
   - Inicialização sem erros ou warnings.
   - `PRAGMA integrity_check` e `PRAGMA foreign_key_check` retornando `ok`.
   - Todas as colunas novas existem e contêm valores padrão válidos.
   - Todos os dados históricos (artigos, projetos, anotações) permanecem intactos.
   - Operações de CRUD novas e antigas funcionam sem exceções.

### Pilar 2: Versionamento Estrito com `PRAGMA user_version`
A abordagem de rodar um script SQL declarativo (`schema.sql` com `IF NOT EXISTS`) combinado com comandos `ALTER TABLE` avulsos é frágil para aplicações de ciclo de vida longo. O padrão amplamente recomendado para SQLite em desktop é o uso do `PRAGMA user_version`:
- O SQLite reserva um inteiro de 32 bits no cabeçalho do arquivo `.db`.
- As migrações são funções lineares numeradas sequencialmente:
  ```typescript
  const MIGRATIONS = [
    { version: 1, up: (db) => { /* v1 initial */ } },
    { version: 2, up: (db) => { /* add deleted_at */ } },
    { version: 3, up: (db) => { /* add partial indexes */ } },
  ];
  ```
- No startup:
  1. O software lê `PRAGMA user_version`.
  2. Executa apenas as migrações com `version > user_version` dentro de uma transação atômica.
  3. Atualiza `PRAGMA user_version = nova_versao`.
  Isso garante determinismo: uma coluna necessária por um índice jamais deixará de existir no momento da criação do índice.

### Pilar 3: Backup Atômico Pré-Migração em Tempo de Execução
Antes de executar qualquer instrução de migração estrutural no startup:
1. O aplicativo verifica se há migrações pendentes.
2. Se houver, utiliza a API online do SQLite (`better-sqlite3` `db.backup()`) para criar `emma.db.pre_migration_vX`.
3. Caso a migração lance qualquer erro, a transação é revertida (`ROLLBACK`), a conexão é fechada, o arquivo original é restaurado e o usuário recebe um aviso seguro sem que seus dados sejam corrompidos.

---

## 3. Viabilidade de Testes em Contêineres e Simulação de Instalação

A pergunta sobre executar testes em contêineres a cada nova versão para validar a atualização como em produção envolve nuances técnicas importantes:

### 3.1. Testes de Migração de Dados em Contêiner (Altamente Viável e Recomendado)
- **Como funciona:** Um contêiner leve (Linux ou runner de CI) executa a suite de migração matricial sobre as fixtures históricas.
- **Vantagens:** 
  - Execução em segundos (sem overhead de interface gráfica).
  - Garante que a transição de dados de *qualquer* versão anterior funciona deterministicamente.
  - Pode rodar em qualquer ambiente (GitHub Actions, Docker local, Linux, Windows).

### 3.2. Teste do Instalador de Produção (Simulação Completa do Update)
Testar o processo exato de atualização de produção (onde o instalador NSIS `.exe` antigo é instalado e depois o novo `.exe` sobrescreve) apresenta restrições em contêineres Docker:
- **Restrição de Contêineres Windows:** Contêineres Docker baseados em Windows Server Core **não possuem subsistema gráfico (GDI/DirectX)**. Aplicativos Electron e instaladores NSIS gráficos frequentemente falham ou travam em containers Docker Windows puros.
- **A Solução Adotada pela Indústria (VM Runners no CI):**
  Em vez de Docker para a parte de instalação Windows, usa-se a própria máquina virtual Windows fornecida pelo GitHub Actions (`runs-on: windows-latest`):
  1. **Step 1:** Baixa o instalador da release anterior (`emmas_librarian-setup-1.1.23.exe`).
  2. **Step 2:** Executa em modo silencioso: `emmas_librarian-setup-1.1.23.exe /S /D=C:\app_test`.
  3. **Step 3:** Popula `%APPDATA%\emmas_librarian` com uma base de teste v1.1.23.
  4. **Step 4:** Constrói o novo instalador v1.2.x e o executa silenciosamente (`/S`) sobre a mesma pasta.
  5. **Step 5:** Inicializa a aplicação com Playwright E2E apontando para os dados migrados e verifica que o Dashboard abre sem erros.

---

## 4. Recomendações Práticas para o Emma's Librarian

1. **Adotar a Fixture Matrix no Vitest (Imediato):**
   Criar uma pasta `electron/database/__tests__/fixtures/` com um arquivo `emma_v1.1.23.db` e incluir no pipeline `npm test` o teste de upgrade desse banco.
2. **Migrar para Transações e `user_version` (Médio Prazo):**
   Substituir a execução mista de `schema.sql` por migrações sequenciais transacionais.
3. **Backup Atômico Pré-Migração no `DatabaseAdapter`:**
   Antes de rodar `initializeSchema()`, gerar uma cópia `.pre_upgrade.bak`. Se ocorrer falha, restaurar automaticamente.
4. **Atualização Sob Demanda (Opt-in) via UI:**
   Permitir ao usuário escolher quando reiniciar e aplicar a nova versão, com rollback assistido em caso de falha.
