# Relatório de Auditoria de Qualidade de Código & Clean Code (R3)

**Projeto**: `emmas_librarian`  
**Data**: 2026-07-29  
**Auditor**: `teamwork_preview_worker` (worker_qualidade)  
**Base Normativa**: `AGENTS.md`  

---

## Estado Atual

### 1. Avaliação de Legibilidade e Manutenibilidade
A análise estática e estrutural do código-fonte do projeto `emmas_librarian` revela débitos técnicos expressivos que comprometem a legibilidade e a manutenibilidade do sistema. A proliferação de componentes React monolíticos, arquivos de serviço extensos e barreira IPC sem checagem de tipos dificulta a navegação, rastreabilidade de bugs e evolução segura do software.

### 2. Aderência ao Princípio de Responsabilidade Única (SRP)
O Princípio de Responsabilidade Única (SRP) é violado nos principais módulos da aplicação. Tanto no backend Electron quanto no frontend React, observa-se o acoplamento de múltiplas responsabilidades em um único arquivo:
- Camadas de banco de dados lidam diretamente com diálogos nativos de interface de usuário.
- Componentes de interface gerenciam dezenas de hooks de estado, lógica de negócios, gráficos e chamadas diretas de serviços RAG/IA.
- Módulos de roteamento IPC contêm lógicas de negócio complexas, acessos a arquivos e persistência de dados inline.

### 3. Avaliação de Métricas Físicas contra as Regras de AGENTS.md

As diretrizes do projeto estabelecem limites rigorosos para o dimensionamento do código:
- **Tamanho de Funções**: Mínimo de 4 e máximo de 20 linhas por função. (*"Functions: 4-20 lines. Split if longer."*)
- **Tamanho de Arquivos**: Máximo de 500 linhas por arquivo. (*"Files: under 500 lines. Split by responsibility."*)

A avaliação quantitativa aponta desvios críticos em relação a estes limites:
- **Tamanho de Arquivos**: 20 arquivos excedem o limite de 500 linhas, atingindo um ápice de 2.132 linhas no maior componente do sistema.
- **Tamanho de Funções**: 264 funções excedem o limite de 20 linhas, com funções individuais chegando a 829 linhas consecutivas.
- **Nível de Aninhamento**: 496 blocos condicionais ultrapassam o limite de 2 níveis de profundidade, alcançando até 10 níveis de aninhamento em loops e migrações.
- **Integridade da Tipagem**: 212 violações de tipagem estrita (`any`, `as any`, funções não tipadas) anulam o suporte ao sistema de tipos do TypeScript.

---

## Pontos Críticos

### 1. Arquivos Gigantes (20 arquivos >= 500 linhas)

A regra de limite de 500 linhas por arquivo foi violada em 20 módulos do repositório:

| # | Linhas Totais | Caminho do Arquivo | Descrição / Categoria |
|---|---|---|---|
| 1 | 2.132 | `emmas_librarian/src/pages/ProjectDetailsPage.tsx` | God Component UI |
| 2 | 1.569 | `emmas_librarian/electron/database/DatabaseAdapter.ts` | God File Database |
| 3 | 1.367 | `emmas_librarian/src/pages/ArticleReaderPage.tsx` | Page Component Monolítico |
| 4 | 1.166 | `emmas_librarian/src/pages/SettingsPage.tsx` | Page Component Monolítico |
| 5 | 1.030 | `emmas_librarian/electron/database/SyncService.ts` | Servidor de Sync & Storage |
| 6 | 843 | `emmas_librarian/src/components/modals/MassCitationModal.tsx` | Modal Monolítico |
| 7 | 711 | `emmas_librarian/src/components/modals/ManageQuickAccessModal.tsx` | Modal Monolítico |
| 8 | 670 | `emmas_librarian/src/components/modals/CitationModal.tsx` | Modal Monolítico |
| 9 | 668 | `emmas_librarian/electron/services/__tests__/ApiIntegrator.test.ts` | Arquivo de Testes Extenso |
| 10 | 637 | `emmas_librarian/src/components/modals/ChangelogModal.tsx` | Modal Monolítico |
| 11 | 630 | `emmas_librarian/src/components/modals/VenueFormModal.tsx` | Modal Monolítico |
| 12 | 624 | `emmas_librarian/src/pages/SearchPage.tsx` | Page Component Monolítico |
| 13 | 622 | `emmas_librarian/electron/ipc/ipcRegistries.ts` | Registry IPC Centralizado |
| 14 | 621 | `emmas_librarian/src/components/modals/ArticleDetailsModal.tsx` | Modal Monolítico |
| 15 | 610 | `emmas_librarian/src/pages/DashboardPage.tsx` | Page Component Monolítico |
| 16 | 537 | `emmas_librarian/src/components/common/DiarySection.tsx` | Componente de UI Extenso |
| 17 | 525 | `emmas_librarian/electron/__tests__/SyncService.test.ts` | Arquivo de Testes Extenso |
| 18 | 511 | `emmas_librarian/src/components/modals/AIExtractionModal.tsx` | Modal Monolítico |
| 19 | 510 | `emmas_librarian/src/components/modals/EditArticleModal.tsx` | Modal Monolítico |
| 20 | 510 | `emmas_librarian/src/services/api.ts` | Camada de Integração IPC |

### 2. Funções Extensas (264 funções > 20 linhas)

Foram identificadas 264 funções que ultrapassam o limite de 20 linhas. As maiores violações concentram-se em modais de UI e métodos de sincronização/banco de dados:

1. `MassCitationModal` (`emmas_librarian/src/components/modals/MassCitationModal.tsx:15-843`): **829 linhas** em uma única função React.
2. `CitationModal` (`emmas_librarian/src/components/modals/CitationModal.tsx:14-670`): **657 linhas**.
3. `setupIpcRegistries` (`emmas_librarian/electron/ipc/ipcRegistries.ts:18-603`): **586 linhas**.
4. `restoreBackupMerge` (`emmas_librarian/electron/database/SyncService.ts:606-1029`): **424 linhas**.
5. `QuestionSetCatalog` (`emmas_librarian/src/components/ai/QuestionSetCatalog.tsx:14-392`): **379 linhas**.
6. `importProject` (`emmas_librarian/electron/database/SyncService.ts:156-487`): **332 linhas**.
7. `initSchema` (`emmas_librarian/electron/database/DatabaseAdapter.ts:72-398`): **327 linhas**.
8. `exportProject` (`emmas_librarian/electron/database/SyncService.ts:13-154`): **142 linhas**.
9. `massiveExtraction` (`emmas_librarian/electron/services/AIService.ts:224-338`): **115 linhas**.
10. `normalizeOpenAlex` (`emmas_librarian/electron/services/ApiIntegrator.ts:183-288`): **106 linhas**.

### 3. God Files e God Components (5 Casos Principais)

1. **`DatabaseAdapter.ts` (1.569 linhas)**: Centraliza a inicialização de banco SQLite, compilação de esquemas SQL, carregamento de extensões vetoriais C++, CRUD completo para 8 entidades distintas, gerenciamento de RAG e cópia de anexos físicos.
2. **`ProjectDetailsPage.tsx` (2.132 linhas)**: Gerencia mais de 30 hooks de estado (`useState`), filtragem complexa de artigos, rendering de tabelas, integração com gráficos Chart.js, execução de extrações em lote por IA e abertura de 10 modais.
3. **`SyncService.ts` (1.030 linhas)**: Agrupa exportação JSON/Zip, descompactação, remapeamento de chaves estrangeiras e chamadas nativas de UI (`dialog.showSaveDialog`).
4. **`ipcRegistries.ts` (622 linhas)**: Acopla o roteamento IPC do Electron com chamadas diretas a banco, manipulação do sistema de arquivos e configurações de janela.
5. **`ArticleReaderPage.tsx` / `SettingsPage.tsx` (1.367 e 1.166 linhas)**: Páginas de UI monolíticas com mistura de visualização de PDFs, anotações, diário e formulários de configuração sem subcomponentes.

### 4. Violações de Tipagem Estrita (212 ocorrências)

A checagem de tipos estrita do TypeScript é ignorada através de 212 utilizações de `any`, `as any` ou parâmetros não tipados:
- `emmas_librarian/src/services/api.ts:22`: `async function safeInvoke(channel: IpcChannel, ...args: any[]): Promise<any>`
- `emmas_librarian/src/services/api.ts:32,36,40,48,52,60,74,78`: Múltiplas funções utilizam cast explícito `as any` no retorno, destruindo a segurança de tipos do frontend.
- `emmas_librarian/electron/database/SyncService.ts:23`: `(this.dbAdapter as any).getDB ? (this.dbAdapter as any).getDB() : ...`
- `emmas_librarian/src/pages/ProjectDetailsPage.tsx:93,100`: Estados inicializados como `useState<any[]>([])`.

### 5. Bloco de Condicionais Aninhadas (496 ocorrências > 2 níveis)

Identificaram-se 496 ocorrências de blocos condicionais aninhados com recuo superior a 2 níveis (>4-6 espaços):
- **Caso Extremo**: `DatabaseAdapter.ts:269-293` apresenta **10 níveis de aninhamento** (20 espaços de recuo) na iteração e migração de categorias e opções.
- `SyncService.ts:650-780`: **7 níveis de aninhamento** dentro de `restoreBackupMerge`.
- `ApiIntegrator.ts:183-288`: **5 níveis de aninhamento** em `normalizeOpenAlex` por falta de *early returns*.

### 6. Convenção de Nomes e Nomes Genéricos (17.422 Ocorrências de `data`)

AGENTS.md proíbe nomes genéricos como `data`, `handler`, `Manager` (*"Names: specific and unique. Avoid data, handler, Manager. Prefer names that return <5 grep hits in the codebase."*).
- O termo **`data`** registra **17.422 hits** globais no projeto e **> 1.200 ocorrências** diretas como nome de variável/parâmetro em TypeScript (`SyncService.ts:175`, `QuestionSetRepository.ts:30`, `ApiIntegrator.ts:45`).
- Nomes genéricos de handlers (`aiIpcHandlers.ts`, `ipcRegistries.ts`) somam **> 150 ocorrências**.
- Classes e componentes usando `Manager` (`ManageQuickAccessModal.tsx`, `release-manager`) somam **> 80 ocorrências**.
- Variáveis descartáveis como `info`, `res`, `item`, `obj` aparecem em dezenas de métodos SQL (ex: `const info = stmt.run(...)` utilizado 45 vezes em `DatabaseAdapter.ts`).

### 7. Código Morto e Scripts Órfãos

Detectou-se a presença de scripts orfãos e arquivos residuais que não fazem parte do build ou runtime da aplicação:
1. `docs/sqlite_recovery_process/recover.py`
2. `docs/sqlite_recovery_process/recover2.py`
3. `docs/sqlite_recovery_process/2026-05-31_dump_schema.py`
4. `untranspile.py` (script Python isolado na raiz do repositório)
5. `analysis_outputs/convert_to_excel.py`

---

## Mudanças Propostas

Para reestruturar o projeto de acordo com as especificações do `AGENTS.md`, estabelece-se o seguinte plano de refatoração em 4 fases:

```
+-------------------------------------------------------------------------------+
|                        PLANO DE REFATORAÇÃO (4 FASES)                          |
+-------------------------------------------------------------------------------+
|                                                                               |
|  FASE 1: Divisão dos God Files por Responsabilidade (SRP)                     |
|  - Desmembrar DatabaseAdapter, ProjectDetailsPage, SyncService e ipcRegistries|
|                                                                               |
|  FASE 2: Refatoração para Tipagem Estrita (Strict Typing)                     |
|  - Eliminar 212 ocorrências de `any` / `as any` e tipar barreira IPC          |
|                                                                               |
|  FASE 3: Achatamento de Condicionais (Early Returns)                          |
|  - Aplicar Guard Clauses para reduzir 496 condicionais profundas (max 2 nív.) |
|                                                                               |
|  FASE 4: Limpeza de Código Morto e Padronização de Nomenclatura               |
|  - Remover scripts Python órfãos e substituir nomes genéricos (`data`)        |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Fase 1: Divisão dos God Files Principais por SRP

1. **Reestruturação de `DatabaseAdapter.ts` (1.569 linhas -> 5 arquivos < 300 linhas)**:
   - `electron/database/schema/SchemaInitializer.ts`: Lógica de DDL, criação de tabelas e migrações.
   - `electron/database/repositories/ArticleRepository.ts`: CRUD de artigos, busca em texto completo e anexos.
   - `electron/database/repositories/ProjectRepository.ts`: CRUD de projetos, diários e notas.
   - `electron/database/repositories/CategoryRepository.ts`: CRUD de categorias, opções e taxonomias.
   - `DatabaseAdapter.ts`: Manter apenas o gerenciamento do ciclo de vida do SQLite (`better-sqlite3`).

2. **Reestruturação de `ProjectDetailsPage.tsx` (2.132 linhas -> 4 sub-componentes + 2 custom hooks)**:
   - `src/hooks/useProjectDetailsState.ts`: Isolamento do gerenciamento dos 30+ estados.
   - `src/hooks/useArticleFilter.ts`: Algoritmos de ordenação, filtragem por PDF e palavras-chave.
   - `src/components/project/ProjectArticlesTable.tsx`: Visualização em tabela de artigos.
   - `src/components/project/ProjectChartsSection.tsx`: Componentes Chart.js de distribuição.

3. **Reestruturação de `SyncService.ts` (1.030 linhas -> 3 serviços específicos)**:
   - `electron/database/sync/ProjectExporter.ts`: Exportação JSON e empacotamento Zip.
   - `electron/database/sync/ProjectImporter.ts`: Validação e extração de backups.
   - `electron/database/sync/BackupMerger.ts`: Algoritmo de diff e reconciliação de IDs.
   - Remediar chamadas de UI (`dialog.showSaveDialog`) movendo-as para os handlers IPC.

4. **Reestruturação de `ipcRegistries.ts` (622 linhas -> Handlers por Domínio)**:
   - Modularizar em `electron/ipc/projectIpc.ts`, `articleIpc.ts`, `searchIpc.ts` e `syncIpc.ts`.

### Fase 2: Refatoração para Tipagem Estrita (Eliminação de `any`)

1. **Tipagem da Camada de Serviços IPC (`src/services/api.ts`)**:
   - Refatorar `safeInvoke` para aceitar um tipo genérico: `safeInvoke<TResponse>(channel: IpcChannel, ...payload: unknown[]): Promise<TResponse>`.
   - Eliminar todos os casts `as any` nas funções auxiliares do frontend, importando tipos centralizados de `src/types/index.ts`.
2. **Criação de DTOs e Interfaces Faltantes**:
   - Definir interfaces explícitas para `ProjectCategoryWithOptions`, `SearchHistoryRecord` e `AIExtractionPayload`.

### Fase 3: Achatamento de Condicionais (Early Returns)

1. Aplicar *guard clauses* e retornos precoces (*early returns*) em `DatabaseAdapter.ts`, `SyncService.ts` e `ApiIntegrator.ts`.
2. Eliminar o aninhamento de 10 níveis em `DatabaseAdapter.ts:269` extraindo laços aninhados para funções auxiliares puras (`migrateCategoryOptionAssignments`).
3. Garantir o cumprimento estrito do limite de 2 níveis de profundidade de indentação em estruturas de controle.

### Fase 4: Limpeza de Código Morto e Padronização de Nomenclatura

1. Remover ou isolar scripts Python de recuperação de dados (`recover.py`, `recover2.py`, `untranspile.py`) para um diretório utilitário fora da distribuição.
2. Substituir nomes genéricos como `data`, `info`, `res`, `item` por identificadores específicos (`projectData`, `migrationResult`, `articleEntity`, `sqlRunResult`).

---

## Conclusão e Próximos Passos

A execução do plano de refatoração em 4 fases garantirá a conformidade integral do projeto `emmas_librarian` com as diretrizes de Clean Code do `AGENTS.md`. A modularização dos God Files resultará em um sistema mais seguro para inclusão de novas funcionalidades, com alta testabilidade e menor risco de regressão.
