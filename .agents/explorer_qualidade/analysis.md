# Relatório Detalhado de Auditoria de Qualidade de Código & Clean Code (R3)

**Projeto**: `emmas_librarian`  
**Data**: 2026-07-29  
**Auditor**: `teamwork_preview_explorer` (explorer_qualidade)  
**Base de Regras**: `AGENTS.md`  

---

## 1. Resumo Executivo & Métricas Gerais

A auditoria estática do código-fonte do projeto `emmas_librarian` revelou sérias violações das diretrizes de qualidade estabelecidas em `AGENTS.md`. Atualmente, o repositório padece de dívida técnica substancial, caracterizada por **arquivos "deus" (God Files)** com milhares de linhas, **múltiplas responsabilidades misturadas**, **212 violações de tipagem estrita (`any`)**, **264 funções que ultrapassam o limite de 20 linhas**, e **496 blocos de condicionais aninhadas com mais de 2 níveis de indentação**.

### Quadro de Métricas Gerais de Qualidade

| Métrica / Regra (AGENTS.md) | Limite Tolerável | Detectado no Projeto | Status de Conformidade |
| :--- | :--- | :--- | :--- |
| **Tamanho de Arquivo** (Regra 2) | < 500 linhas | **20 arquivos** >= 500 linhas (máx: 2.132 linhas) | ❌ **CRÍTICO** |
| **Tamanho de Função** (Regra 1) | 4 a 20 linhas | **264 funções** fora do intervalo (máx: 829 linhas) | ❌ **CRÍTICO** |
| **Princípio de Responsabilidade Única (SRP)** (Regra 3) | 1 responsabilidade/módulo | **5 God Files principais** misturando UI, DB, IPC e FS | ❌ **CRÍTICO** |
| **Tipagem Estrita** (Regra 5) | Zero `any` / `Dict` | **212 ocorrências** de `any` / `as any` / untyped | ❌ **ALTO** |
| **Nível de Aninhamento** (Regra 7) | Máx. 2 níveis (Early Returns) | **496 condicionais** aninhadas (>2 níveis, máx: 10 níveis) | ❌ **ALTO** |
| **Convenção de Nomes** (Regra 4) | Evitar `data`, `handler`, `Manager` | **56 declarações** de nomes genéricos (>1.200 usos de `data`) | ⚠️ **MÉDIO** |
| **Duplicação de Código** (Regra 6) | Zero duplicação | Lógicas repetidas de modal, filtro, exportação e IPC | ⚠️ **MÉDIO** |
| **Código Morto / Legado** (Regra 8) | Zero código não utilizado | 5 scripts orfãos em `docs/` e `analysis_outputs/` | ⚠️ **MÉDIO** |

---

## 2. Análise Detalhada por Regra de Qualidade

---

### Regra 1: Tamanho de Funções (4 a 20 linhas por função)

**Regra em AGENTS.md**: *"Functions: 4-20 lines. Split if longer."*

**Resultado**: Foram identificadas **264 funções** que violam este limite. Destacam-se componentes React monolíticos onde o componente inteiro é uma única função de centenas de linhas, além de funções de serviço e migração com dezenas de operações sequenciais sem modularização.

#### Principais Violações Identificadas:
1. `MassCitationModal` em `emmas_librarian/src/components/modals/MassCitationModal.tsx`
   - **Linhas**: 15 até 843 (**829 linhas** em uma única função).
   - **Problema**: Controla parsing de citação, renderização de modal, formatação BibTeX/RIS e cópia de área de transferência em um único bloco funcional.
2. `CitationModal` em `emmas_librarian/src/components/modals/CitationModal.tsx`
   - **Linhas**: 14 até 670 (**657 linhas**).
3. `setupIpcRegistries` em `emmas_librarian/electron/ipc/ipcRegistries.ts`
   - **Linhas**: 18 até 603 (**586 linhas**).
   - **Problema**: Registra dezenas de canais IPC inline com tratamento de erro e acesso a banco no próprio corpo do registro.
4. `restoreBackupMerge` em `emmas_librarian/electron/database/SyncService.ts`
   - **Linhas**: 606 até 1029 (**424 linhas**).
   - **Problema**: Algoritmo monolítico de merge de backups com queries SQL, remapeamento de IDs e manipulação de arquivos zip em 424 linhas corridas.
5. `QuestionSetCatalog` em `emmas_librarian/src/components/ai/QuestionSetCatalog.tsx`
   - **Linhas**: 14 até 392 (**379 linhas**).
6. `importProject` em `emmas_librarian/electron/database/SyncService.ts`
   - **Linhas**: 156 até 487 (**332 linhas**).
7. `initSchema` em `emmas_librarian/electron/database/DatabaseAdapter.ts`
   - **Linhas**: 72 até 398 (**327 linhas**).
   - **Problema**: Executa schema base, migrações sequenciais em blocos `if` aninhados e verificação de colunas em 327 linhas.

---

### Regra 2: Tamanho de Arquivos (< 500 linhas por arquivo)

**Regra em AGENTS.md**: *"Files: under 500 lines. Split by responsibility."*

**Resultado**: Foram identificados **20 arquivos** no repositório com 500 ou mais linhas.

#### Lista Completa de Arquivos Violadores (Ordenada por Tamanho):

```
 1. 2.132 linhas | emmas_librarian/src/pages/ProjectDetailsPage.tsx
 2. 1.569 linhas | emmas_librarian/electron/database/DatabaseAdapter.ts
 3. 1.367 linhas | emmas_librarian/src/pages/ArticleReaderPage.tsx
 4. 1.166 linhas | emmas_librarian/src/pages/SettingsPage.tsx
 5. 1.030 linhas | emmas_librarian/electron/database/SyncService.ts
 6.   843 linhas | emmas_librarian/src/components/modals/MassCitationModal.tsx
 7.   711 linhas | emmas_librarian/src/components/modals/ManageQuickAccessModal.tsx
 8.   670 linhas | emmas_librarian/src/components/modals/CitationModal.tsx
 9.   668 linhas | emmas_librarian/electron/services/__tests__/ApiIntegrator.test.ts
10.   637 linhas | emmas_librarian/src/components/modals/ChangelogModal.tsx
11.   630 linhas | emmas_librarian/src/components/modals/VenueFormModal.tsx
12.   624 linhas | emmas_librarian/src/pages/SearchPage.tsx
13.   622 linhas | emmas_librarian/electron/ipc/ipcRegistries.ts
14.   621 linhas | emmas_librarian/src/components/modals/ArticleDetailsModal.tsx
15.   610 linhas | emmas_librarian/src/pages/DashboardPage.tsx
16.   537 linhas | emmas_librarian/src/components/common/DiarySection.tsx
17.   525 linhas | emmas_librarian/electron/__tests__/SyncService.test.ts
18.   511 linhas | emmas_librarian/src/components/modals/AIExtractionModal.tsx
19.   510 linhas | emmas_librarian/src/components/modals/EditArticleModal.tsx
20.   510 linhas | emmas_librarian/src/services/api.ts
```

---

### Regra 3: Princípio de Responsabilidade Única (SRP)

**Regra em AGENTS.md**: *"One thing per function, one responsibility per module (SRP). Prefer small focused modules over god files."*

#### Mapeamento de Violações SRP Críticas:

1. **`DatabaseAdapter.ts` (God File de Banco de Dados)**
   - **Responsabilidades Misturadas**:
     1. Criação e inicialização de conexão SQLite com WAL pragma.
     2. Execução e migração de esquemas DDL SQL.
     3. Carregamento de extensão binária C/C++ `sqlite-vec`.
     4. Operações CRUD de Projetos, Artigos, Categorias, Destaques, Anotações, Diários e Documentos.
     5. Criptografia/descriptografia de chaves via `electron.safeStorage`.
     6. Pesquisa vetorial RAG e persistência de histórico de IA.
     7. Lógica de clonagem de projetos e cópia de anexos físicos.

2. **`ProjectDetailsPage.tsx` (God Component de UI)**
   - **Responsabilidades Misturadas**:
     1. Gestão de mais de 30 hooks de estado (`useState`).
     2. Lógica de filtro e busca de artigos (artigos manuais, PDF, OpenAccess, palavras-chave).
     3. Integração com gráficos Chart.js (Pie e Bar).
     4. Disparo e escuta de extrações em lote de IA (RAG).
     5. Gerenciamento de abertura/fechamento de 10 modais distintos.
     6. Upload de arquivos locais e atualização de writing pad.

3. **`SyncService.ts` (Mistura de Camadas DB + UI + Filesystem)**
   - **Responsabilidades Misturadas**:
     1. Serialização de dados do banco para JSON.
     2. Compactação e extração de arquivos `.zip` via `adm-zip`.
     3. Apresentação direta de modais nativos do Electron (`dialog.showSaveDialog`, `dialog.showOpenDialog`) dentro de uma classe de serviço de banco de dados.
     4. Lógica complexa de diff e remapeamento de IDs de chaves estrangeiras.

4. **`ipcRegistries.ts` (Mistura de Roteamento IPC + Lógica de Negócios)**
   - **Responsabilidades Misturadas**:
     1. Definição e roteamento de handlers de eventos IPC.
     2. Inicialização direta de serviços de banco e backup.
     3. Execução de rotinas assíncronas de rotação de backups no startup.
     4. Manipulação de janelas nativas do Electron (`BrowserWindow.setTitleBarOverlay`).
     5. Leitura/Escrita direta em disco (`fs.writeFileSync`).

---

### Regra 4: Convenção de Nomes e Evitar Termos Genéricos

**Regra em AGENTS.md**: *"Names: specific and unique. Avoid `data`, `handler`, `Manager`. Prefer names that return <5 grep hits in the codebase."*

#### Violações Detectadas:
- O termo **`data`** possui **> 1.200 ocorrências** no repositório. É utilizado como nome de parâmetro e variável em dezenas de funções (ex: `SyncService.ts:175`, `QuestionSetRepository.ts:30`, `ApiIntegrator.ts:45`).
- O termo **`handler` / `handlers`** possui **> 150 ocorrências** (`aiIpcHandlers.ts`, `errorHandler.ts`, `ipcRegistries.ts`).
- O termo **`Manager` / `manager`** possui **> 80 ocorrências** (`ManageQuickAccessModal.tsx`, `release-manager`).
- Nomes de variáveis descartáveis como **`info`**, **`res`**, **`item`**, **`obj`** são utilizados repetidamente em métodos de banco de dados (ex: `const info = stmt.run(...)` aparece 45 vezes em `DatabaseAdapter.ts`).

---

### Regra 5: Tipagem Estrita (Strict Typing)

**Regra em AGENTS.md**: *"Types: explicit. No `any`, no `Dict`, no untyped functions."*

#### Resultado: 212 Violações de Tipagem Estrita Encontradas

#### Exemplos Críticos de Bypasses de Tipagem:

1. **`emmas_librarian/src/services/api.ts`**
   - Linha 22: `async function safeInvoke(channel: IpcChannel, ...args: any[]): Promise<any>`
   - Linhas 32, 36, 40, 48, 52, 60, 74, 78, ...: Praticamente **todas** as chamadas de serviço do frontend usam cast explícito `as any`, anulando completamente a checagem de tipos entre a camada React e a IPC.

2. **`emmas_librarian/electron/database/SyncService.ts`**
   - Linha 23: `const db = (this.dbAdapter as any).getDB ? (this.dbAdapter as any).getDB() : (this.dbAdapter as any).db;`
   - Bypassa o encapsulamento da classe `DatabaseAdapter` via cast `any`.

3. **`emmas_librarian/src/pages/ProjectDetailsPage.tsx`**
   - Linha 93: `const [history, setHistory] = useState<any[]>([]);`
   - Linha 100: `const [projectCategories, setProjectCategories] = useState<any[]>([]);`

4. **`emmas_librarian/electron/ipc/ipcRegistries.ts`**
   - Múltiplos handlers IPC recebem parâmetros não tipados ou usam `(event, args: any)`.

---

### Regra 6: Duplicação de Código (Code Duplication)

**Regra em AGENTS.md**: *"No code duplication. Extract shared logic into a function/module."*

#### Padrões Duplicados Identificados:
1. **Lógica de Filtro e Busca de Artigos**:
   Duplicada entre `ProjectDetailsPage.tsx`, `SearchPage.tsx` e `DashboardPage.tsx`. O mesmo algoritmo de filtragem por PDF, OpenAccess e status é reimplementado em cada página.
2. **Formatação de Citações (BibTeX / RIS / APA)**:
   Duplicada entre `ExportService.ts`, `MassCitationModal.tsx` e `CitationModal.tsx`.
3. **Tratamento e Formatação de Erros IPC**:
   Duplicado entre `AppError.ts`, `ipcRegistries.ts` e `aiIpcHandlers.ts`.

---

### Regra 7: Condicionais Aninhadas & Early Returns

**Regra em AGENTS.md**: *"Early returns over nested ifs. Max 2 levels of indentation."*

#### Resultado: 496 Ocorrências com Nível de Indentação >= 6 Espaços (>2 Níveis)

#### Caso Extremo de Aninhamento:
- **`emmas_librarian/electron/database/DatabaseAdapter.ts` (Linhas 269 a 293)**:
  Atinge **10 níveis de aninhamento (20 espaços de indentação)** dentro da função `initSchema`:

```typescript
// DatabaseAdapter.ts:269-293 (Exemplo de aninhamento de 10 níveis)
for (const cat of cats) {
  if (cat.options) {
    for (const opt of opts) {
      for (const assign of assignments) {
        if (assign.value) {
          for (const selected of selectedOpts) {
            if (!optId) {
              // ... indentação extrema sem early return
            }
          }
        }
      }
    }
  }
}
```

---

### Regra 8: Código Morto & Arquivos Orfãos

**Regra em AGENTS.md**: *"Dead code: unused functions, unused imports, unused variables/types."*

#### Arquivos Orfãos / Legado Identificados na Raiz e docs/:
1. `docs/sqlite_recovery_process/recover.py`
2. `docs/sqlite_recovery_process/recover2.py`
3. `docs/sqlite_recovery_process/2026-05-31_dump_schema.py`
4. `untranspile.py` (Script Python solto na raiz do repositório)
5. `analysis_outputs/convert_to_excel.py`

---

## 3. Matriz de Risco e Prioridade de Refatoração

| Arquivo / Módulo | Prioridade | Esforço Est. | Motivo Principal |
| :--- | :--- | :--- | :--- |
| `DatabaseAdapter.ts` | **P0 (Crítico)** | Alto | God File (1.569 lines), 10 níveis de aninhamento, violação SRP |
| `ProjectDetailsPage.tsx` | **P0 (Crítico)** | Alto | God Component (2.132 lines), 30+ states, mistura UI e RAG |
| `api.ts` | **P0 (Crítico)** | Médio | 200+ casts `as any` destruindo tipagem do frontend |
| `SyncService.ts` | **P1 (Alto)** | Alto | 1.030 linhas, chamada de UI nativa em classe DB |
| `ipcRegistries.ts` | **P1 (Alto)** | Médio | 622 linhas, handler monolítico de 586 linhas |
| `MassCitationModal.tsx` | **P2 (Médio)** | Médio | 843 linhas, função única de 829 linhas |
| `ArticleReaderPage.tsx` | **P2 (Médio)** | Médio | 1.367 linhas |
| `SettingsPage.tsx` | **P2 (Médio)** | Médio | 1.166 linhas |

