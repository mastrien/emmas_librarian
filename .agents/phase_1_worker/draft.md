# Fase 1: Arquitetura Desktop Standalone Electron & Reestruturação do Repositório

- **Posição**: Fase 1 (Commits 20 a 33)
- **Período**: 19/05/2026 – 23/05/2026
- **Commits**: `b22c483` a `0147f49` (Commits 20 a 33)

---

## 1. Resumo Executivo

A **Fase 1** marca a transformação arquitetural mais profunda e decisiva na história do **Emma's Librarian**. Entre os commits 20 (`b22c483`) e 33 (`0147f49`), o projeto abandonou por completo o modelo cliente-servidor desacoplado com backend em Python (FastAPI + SQLite + Pytest) e passou por uma reescrita integral, tornando-se uma aplicação **Desktop Standalone baseada em Electron**. 

A motivação primordial para este pivot arquitetural foi eliminar a complexidade artificial de rede local (`http://localhost:8000`), extinguir os problemas de dependências externas para o usuário final (como necessidade de ter Python 3.13, Uvicorn e pip previamente instalados) e centralizar a base de código em **TypeScript de ponta a ponta**. 

Nesta nova fundação, o backend passou a rodar dentro do processo principal do Electron (**Main Process** em Node.js), a camada de dados foi portada para o driver nativo C++ **`better-sqlite3`**, a comunicação entre a interface (React + Vite) e o ecossistema local foi estruturada sobre um **barramento de chamadas IPC assíncronas estritamente tipadas**, e a estrutura do repositório foi reorganizada com a migração do diretório `frontend/` para a pasta consolidada **`emmas_librarian/`**. 

Adicionalmente, esta fase introduziu funcionalidades chave de gestão bibliográfica: sistema de reversão atômica de buscas (`SEARCH_REVERT`), cadastro e edição de artigos avulsos manuais (com o badge visual estrito `⚠️ Manual`), módulo especializado de exportação para o **Biblioshiny / Scopus CSV** (`ExportService`), desvinculação física segura de PDFs e automação de compilação de binários nativos com `@electron/rebuild`.

---

## 2. Detalhamento Profundo

### 2.1. Decisões de Engenharia & Racional Arquitetural

#### 1. Pivot de Arquitetura: De Cliente-Servidor REST para Desktop Standalone Electron
No MVP inicial (Fase 0), a aplicação dependia de um backend Python FastAPI rodando na porta `8000` e uma SPA React rodando via Vite na porta `5173`. Essa abordagem trazia diversos gargalos:
* **Fricção de Instalação (UX)**: Exigia que o pesquisador/acadêmico configurasse ambientes Python, virtuais (`venv`) e instale módulos via terminal.
* **Sobrecarga de Rede Artificial**: Requisições HTTP REST em `localhost` introduziam latências desnecessárias de serialização JSON e conexões TCP locais para operações puramente de disco/banco de dados.
* **Tamanho do Pacote e Manutenibilidade**: O empacotamento do interpretador Python junto a bibliotecas de ciência de dados via PyInstaller inflaria o instalador para 350MB-500MB.

Ao adotar o **Electron**, o software foi unificado em um executável nativo standalone (.exe no Windows). O instalador foi reduzido para ~100MB-130MB e o tempo de inicialização (*cold start*) foi eliminado, já que o Node.js inicia simultaneamente com a janela gráfica.

#### 2. Reescrita dos Serviços de Negócio em TypeScript
Toda a inteligência de backend anteriormente desenvolvida em Python foi integralmente reescrita em TypeScript no Main Process:
* `DatabaseManager.ts`: Utiliza o driver C++ `better-sqlite3`, executando operações síncronas de banco de dados diretamente no disco local com performance máxima e transações atômicas (`db.transaction`).
* `QueryTranslator.ts`: Traduz a árvore de busca booleana visual (`AND`, `OR`, `NOT`) para as sintaxes nativas das APIs (OpenAlex, Crossref, Scopus, Web of Science).
* `ApiIntegrator.ts`: Executa requisições assíncronas com o cliente HTTP de Node.js e efetua a normalização dos esquemas de resposta no padrão CSL-JSON.
* `SearchOrchestrator.ts`: Orquestra consultas concorrentes entre provedores, desduplica artigos por DOI higienizado/Título normalizado e persiste os registros no SQLite local.
* `ExportService.ts`: Módulo dedicado à formatação rigorosa dos dados bibliométricos para exportação em CSV compatível com o Bibliometrix/Biblioshiny no RStudio.

#### 3. Barramento IPC Seguro e ContextBridge (Preload Script)
Para garantir isolamento de segurança (princípio de privilégio mínimo) no Electron:
* A renderização (`src/`) roda com `nodeIntegration: false` e `contextIsolation: true`.
* Foi construído o script de preload (`electron/preload.ts`) utilizando `contextBridge.exposeInMainWorld('electronAPI', ...)`, expondo métodos seguros que envelopam chamadas `ipcRenderer.invoke`.
* No Main Process, os manipuladores (`electron/ipc/handlers.ts`) capturam as mensagens via `ipcMain.handle` e invocam as rotas correspondentes dos serviços de banco e API.

#### 4. Reversibilidade Atômica de Buscas (`SEARCH_REVERT`)
Para conceder ao pesquisador o poder de refazer ou cancelar pesquisas do histórico sem deixar rastros no banco ou no disco:
* Implementou-se o método `revertSearch(searchId)` no `DatabaseManager.ts`.
* Sob uma transação atômica do SQLite (`this.db.transaction`), o sistema localiza todos os artigos associados àquele `search_id`, lê os caminhos de arquivos PDF físicos (`pdf_path`), apaga-os do sistema de arquivos usando `fs.unlinkSync`, e deleta em cascata os registros nas tabelas `articles`, `highlights` e `search_history`.

#### 5. Exportação Fidedigna para Biblioshiny / Scopus (CSV)
Descobriu-se que o pacote R Bibliometrix descarta artigos exportados se a coluna de chave primária `EID` (específica do Scopus) não estiver presente. O `ExportService.ts` resolveu isso:
* **Geração de EID Estável**: Mapeamento do identificador único para o formato `2-s2.0-${article.id}`.
* **Formatação Estrita de Nomes de Autores**: Conversão de arrays de autores para o formato `Sobrenome I.` (coluna `Authors`) e `Sobrenome, NomeCompleto` (coluna `Author Full Names`), separados por ponto e vírgula.
* **Mapeamento de Afiliações (`AU_UN`)**: Extração e associação de instituições para permitir a geração de mapas geo-acadêmicos no RStudio.

#### 6. Desvinculação Segura de PDFs e Artigos Avulsos Manuais
* **Desvinculação de PDF**: Permite remover um PDF associado incorretamente sem excluir o artigo. O arquivo físico é removido do disco e o campo `local_file_path` é definido como `NULL`, mas todos os metadados, resumos e anotações permanecem intactos.
* **Artigos Avulsos**: Inclusão de produções não encontradas via API (teses, livros, anais). Recebem a marca visual `⚠️ Manual` no grid/tabela para indicar autodeclaração dos metadados.

#### 7. Automação de Binários Nativos (`better-sqlite3` e `@electron/rebuild`)
Como o `better-sqlite3` possui código fonte em C++ compilado para o Node.js tradicional, ocorre incompatibilidade de ABI (Application Binary Interface) ao ser carregado dentro do executável V8 do Electron.
* Adicionou-se a dependência de desenvolvimento `@electron/rebuild` (commit `8e3d847`).
* Configurou-se os scripts de automação no `package.json` (`electron:rebuild` / `postinstall`) para recompilar os binários nativos `.node` de forma transparente para as versões de ABI de ambos os ambientes (commit `ea22965`).

#### 8. Reestruturação Física do Repositório (Commit `fa14112`)
No commit `fa14112`, a pasta de código fonte `frontend/` foi renomeada para `emmas_librarian/`. O repositório passou a agrupar sob uma única raiz o processo principal (`emmas_librarian/electron/`) e o processo de renderização React (`emmas_librarian/src/`), simplificando scripts de build, suporte a Vite e gerenciamento de dependências.

---

### 2.2. Diagrama de Arquitetura & Fluxo de Comunicação (Mermaid)

```mermaid
graph TD
    subgraph Renderer Process (Vite + React UI)
        UI[React UI Pages / Components] -->|Chama wrapper de API| APIWrapper[src/services/api.ts]
        APIWrapper -->|ipcRenderer.invoke| ContextBridge[electron/preload.ts contextBridge]
    end

    subgraph Main Process (Electron Node.js Backend)
        ContextBridge -->|Canal IPC Seguros| IPCHandlers[electron/ipc/handlers.ts]
        
        IPCHandlers -->|Gestão de Janelas/Lifecycle| MainWin[electron/main.ts]
        IPCHandlers -->|Consultas e Transações| DBManager[DatabaseManager.ts - better-sqlite3]
        IPCHandlers -->|Orquestração de Buscas| SearchOrch[SearchOrchestrator.ts]
        IPCHandlers -->|Exportação de CSV| ExportSvc[ExportService.ts]
        
        SearchOrch -->|Tradução Booleana| QueryTrans[QueryTranslator.ts]
        SearchOrch -->|Fetch HTTP & CSL-JSON| ApiInteg[ApiIntegrator.ts]
        
        DBManager -->|Persistência em Disco| SQLite[(Arquivo SQLite Local emma.db)]
        ExportSvc -->|Gerar Arquivo Scopus CSV| DiskCSV[Arquivo .csv Biblioshiny]
        SearchOrch -->|Salvar PDF Baixado| Storage[Storage Local de PDFs]
    end

    subgraph External APIs
        ApiInteg -->|REST HTTP| OpenAlex[OpenAlex API]
        ApiInteg -->|REST HTTP| Crossref[Crossref API]
        ApiInteg -->|REST HTTP| Scopus[Scopus API]
        ApiInteg -->|REST HTTP| WoS[Web of Science API]
    end
```

---

### 2.3. Tabela da Estrutura de Diretórios/Arquivos (Fase 1)

| Caminho da Pasta / Arquivo | Responsabilidade Téscnica & Descrição |
| :--- | :--- |
| `emmas_librarian/electron/main.ts` | Ponto de entrada do Processo Principal do Electron. Gerencia o ciclo de vida da janela (`BrowserWindow`), protocolo de segurança, CSP e atalhos globais. |
| `emmas_librarian/electron/preload.ts` | Script de ponte isolada (*Preload Script*). Expõe com segurança o objeto `window.electronAPI` usando `contextBridge`. |
| `emmas_librarian/electron/ipc/handlers.ts` | Registrador centralizador dos manipuladores de eventos de IPC (`ipcMain.handle`), roteando comandos da UI para os serviços Node.js. |
| `emmas_librarian/electron/database/DatabaseManager.ts` | Camada de persistência local SQLite em TypeScript construída sobre `better-sqlite3`. Controla inicialização do schema, migrações e transações. |
| `emmas_librarian/electron/services/QueryTranslator.ts` | Tradutor de sintaxe booleana visual (`AND`/`OR`/`NOT`) para os formatos nativos de OpenAlex, Crossref, Scopus e Web of Science. |
| `emmas_librarian/electron/services/ApiIntegrator.ts` | Cliente HTTP Node.js para comunicação assíncrona com REST APIs científicas e padronização em CSL-JSON. |
| `emmas_librarian/electron/services/SearchOrchestrator.ts` | Orquestrador de buscas multibases com desduplicação por DOI/Título e armazenamento de arquivos PDF. |
| `emmas_librarian/electron/services/ExportService.ts` | Módulo de exportação bibliométrica formatando metadados em CSV compatível com o Biblioshiny (Scopus format). |
| `emmas_librarian/electron/services/__tests__/` | Suíte de testes unitários automatizados com Vitest para os serviços do Electron. |
| `emmas_librarian/src/services/api.ts` | Abstração da camada de renderização React, convertendo chamadas da UI em chamadas de IPC embutidas em Promises. |
| `emmas_librarian/src/pages/` | Telas da SPA React (`Dashboard.tsx`, `NewProjectPage.tsx`, `ProjectDetailsPage.tsx`, `ArticleReaderPage.tsx`). |
| `emmas_librarian/src/components/` | Componentes reutilizáveis de UI (`Layout.tsx`, `QueryBuilder.tsx`, `ManualArticleModal.tsx`). |
| `emmas_librarian/vite.config.ts` | Configuração do empacotador Vite com plugins de integração Electron e externalização de módulos nativos. |
| `plans/electron_migration_plan.md` | Documento de especificação detalhada da arquitetura de migração de Python para Electron (982 linhas). |

---

### 2.4. Trechos Chave de Código (Extraídos dos Diffs de Commits)

#### 1. Registrador de Manipuladores IPC (`electron/ipc/handlers.ts` — Commit `b22c483`)
```typescript
import { ipcMain, shell } from 'electron';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchOrchestrator } from '../services/SearchOrchestrator';
import { ExportService } from '../services/ExportService';

export function registerIpcHandlers(
  db: DatabaseManager, 
  orchestrator: SearchOrchestrator,
  exportService: ExportService
) {
  // Retorna a lista de todos os projetos cadastrados
  ipcMain.handle('GET_PROJECTS', async () => {
    return db.getProjects();
  });

  // Executa busca assíncrona orquestrada em múltiplas bases científicas
  ipcMain.handle('EXECUTE_SEARCH', async (_, { projectId, query, providers }) => {
    return orchestrator.executeSearch(projectId, query, providers);
  });

  // Exportação formatada para o Biblioshiny / Scopus CSV
  ipcMain.handle('EXPORT_BIBLIOSHINY', async (_, { projectId, outputPath }) => {
    return exportService.exportToScopusCsv(projectId, outputPath);
  });

  // Abertura segura de links externos no navegador padrão do sistema operacional
  ipcMain.handle('OPEN_EXTERNAL_URL', async (_, url: string) => {
    await shell.openExternal(url);
  });
}
```

#### 2. Reversão Atômica de Busca no DatabaseManager (`electron/database/DatabaseManager.ts` — Commit `a596ced`)
```typescript
import Database from 'better-sqlite3';
import fs from 'fs';

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Executa a reversão completa de uma busca do histórico em uma transação atômica.
   * Apaga os arquivos PDF físicos associados do disco e deleta os registros em cascata.
   */
  public revertSearch(searchId: string): void {
    const revertTransaction = this.db.transaction(() => {
      // 1. Localizar todos os artigos vinculados à busca e remover seus PDFs do disco
      const articles = this.db.prepare(
        'SELECT id, pdf_path FROM articles WHERE search_id = ?'
      ).all(searchId) as { id: string; pdf_path: string | null }[];

      for (const article of articles) {
        if (article.pdf_path && fs.existsSync(article.pdf_path)) {
          fs.unlinkSync(article.pdf_path);
        }
      }

      // 2. Deletar os artigos da busca (destaques são apagados por ON DELETE CASCADE)
      this.db.prepare('DELETE FROM articles WHERE search_id = ?').run(searchId);

      // 3. Remover o registro do histórico de buscas
      this.db.prepare('DELETE FROM search_history WHERE id = ?').run(searchId);
    });

    // Executa a transação atômica
    revertTransaction();
  }
}
```

#### 3. Formatação Rigorosa para Exportação Scopus/Biblioshiny (`electron/services/ExportService.ts` — Commit `6e0a0f9` & `dce7e6d`)
```typescript
import { DatabaseManager } from '../database/DatabaseManager';
import { stringify } from 'csv-stringify/sync';
import fs from 'fs';

export class ExportService {
  constructor(private db: DatabaseManager) {}

  public exportToScopusCsv(projectId: string, outputPath: string): void {
    const articles = this.db.getArticlesByProject(projectId);

    const rows = articles.map((art) => {
      const authorsList = JSON.parse(art.authors || '[]');
      
      // Formatação no padrão Scopus: "Sobrenome I.; Sobrenome2 I2."
      const formattedAuthors = authorsList
        .map((a: { family: string; given: string }) => `${a.family} ${a.given ? a.given[0] + '.' : ''}`)
        .join('; ');

      const formattedFullNames = authorsList
        .map((a: { family: string; given: string }) => `${a.family}, ${a.given || ''}`)
        .join('; ');

      return {
        'Authors': formattedAuthors,
        'Author Full Names': formattedFullNames,
        'Title': art.title,
        'Year': art.year,
        'Source title': art.venue || '',
        'Abstract': art.abstract || '',
        'DOI': art.doi || '',
        // Chave primária obrigatória para o Bibliometrix não descartar o artigo
        'EID': `2-s2.0-${art.id}`,
        'Document Type': 'Article',
        'Source': art.source_databases || 'Unknown'
      };
    });

    const csvContent = stringify(rows, { header: true });
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
  }
}
```

#### 4. Automação de Rebuild NATIVO no package.json (`package.json` — Commit `ea22965` & `8e3d847`)
```json
{
  "name": "emmas_librarian",
  "version": "0.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "electron:dev": "concurrently \"npm run dev\" \"electron .\"",
    "electron:rebuild": "electron-rebuild -f -w better-sqlite3",
    "postinstall": "electron-builder install-app-deps"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.0",
    "concurrently": "^8.2.2",
    "electron": "^30.0.0",
    "electron-builder": "^24.13.3",
    "vite": "^5.2.0"
  }
}
```

---

## 3. Lista Cronológica de Commits da Fase 1

1. **`b22c483`** (2026-05-19): *Refactor Project flow, add archive features and default external browser opening*
   - Transição fundamental: exclusão do backend Python e criação da infraestrutura Electron/Node.js com SQLite nativo.
2. **`8e31dfe`** (2026-05-20): *docs: update README with new search features and project management*
   - Atualização completa do README.md documentando a nova arquitetura desktop e recursos de projetos.
3. **`6e0a0f9`** (2026-05-20): *feat: implementa desvinculacao de PDF, busca avancada, controle de zoom reativo, artigos manuais avulsos, correcoes de exportacao para o Biblioshiny (Scopus CSV)*
   - Adição do módulo de desvinculação física de PDFs, zoom reativo no leitor, suporte a artigos manuais avulsos e gerador de CSV para Biblioshiny.
4. **`a596ced`** (2026-05-20): *feat: reversible searches, diary editor mode toggle, dark mode dropdown fix*
   - Implementação da reversão atômica de buscas (`SEARCH_REVERT`), alternador de visualização no diário e correções de tema escuro.
5. **`dce7e6d`** (2026-05-20): *refactor(backend): modularize export logic and optimize backend test coverage*
   - Modularização do `ExportService.ts` e criação de suíte de testes unitários em Vitest no backend Electron.
6. **`ea22965`** (2026-05-20): *build(package): add automated scripts to rebuild native better-sqlite3 for Electron and Node ABIs*
   - Scripts automatizados para compatibilidade de binários C++ do `better-sqlite3` entre Node e Electron.
7. **`8e3d847`** (2026-05-20): *build(package): install @electron/rebuild as devDependency*
   - Instalação oficial do `@electron/rebuild` como dependência dev para automação de compilação nativa.
8. **`01897e4`** (2026-05-20): *chore: document PrismJS production errors and attempted fixes*
   - Diagnóstico e documentação de falhas de empacotamento da biblioteca de syntax highlight PrismJS em builds de produção.
9. **`94249a4`** (2026-05-20): *fix: corrige crash do PrismJS em producao via externalizacao com plugin Vite*
   - Resolução definitiva do crash do PrismJS em compilações finais com ajuste de plugin no `vite.config.ts`.
10. **`4e930f1`** (2026-05-20): *fix: corrige glassmorphism do header em builds de producao Electron*
    - Ajuste nos estilos CSS backdrop-filter para garantir efeito glassmorphism consistente na versão empacotada.
11. **`3eef56b`** (2026-05-22): *last fixes v0.0.0*
    - Estabilização geral de componentes e tipos antes do alinhamento do repositório.
12. **`fa14112`** (2026-05-22): *renaming symbol from frontend to emmas_librarian*
    - Renomeação estrutural da pasta `frontend/` para `emmas_librarian/`, unificando a estrutura raiz do projeto.
13. **`10c32b9`** (2026-05-22): *fix: destaques nas pesquisas do leitor de pdf*
    - Correção e aprimoramento dos realces visuais durante busca textual ativa dentro do leitor de PDF.
14. **`0147f49`** (2026-05-23): *feat: adicionar e editar artigos avulsos*
    - Interface e formulários dedicados para inclusão e edição de artigos acadêmicos avulsos não provenientes de APIs.
