# Fase 4: Auditorias Arquiteturais, Infraestrutura de Testes e Estabilização do Core

---

## 1. Posição no Projeto

- **Título da Fase**: Fase 4: Auditorias Arquiteturais, Infraestrutura de Testes e Estabilização do Core
- **Posição**: Fase 4 (Commits 61 a 71)
- **Intervalo de Commits**: Commit 61 (`f1c44d17`) a Commit 71 (`f1841d9d`)
- **Autoria**: João Pedro V (`mastergamerjp06@gmail.com`)
- **Período**: 26 de Maio a 29 de Maio de 2026

---

## 2. Resumo Executivo

Após a conclusão da fase inicial de integração do MVP com recursos de Inteligência Artificial, a equipe realizou uma pausa estratégica orientada à qualidade de software, estabilização estrutural e maturidade de testes. A **Fase 4** representa o ponto de virada institucional do **Emma's Librarian**, onde a aplicação transicionou de uma prova de conceito funcional para uma plataforma desktop de alta confiabilidade.

Os pilares estratégicos executados nesta fase englobam:

1. **Auditoria Técnica e Proposta Arquitetural Electron + React/Vite**: Consolidação de 5 relatórios técnicos formais em `docs/auditoria/`. O documento principal (`2026-05-29_refatoracao_electron.md`) formalizou a decisão de eliminar o servidor backend em Python (FastAPI), unificando todo o sistema em TypeScript com Electron no processo principal. Esta escolha eliminou a sobrecarga de chamadas HTTP locais, erradicou *cold starts*, reduziu o tamanho do pacote instalador de ~500 MB para ~120 MB e simplificou a experiência de instalação para o usuário final.
2. **Implantação da Suíte de Testes Automatizados com Vitest**: Configuração da infraestrutura completa de testes unitários e de integração utilizando o runner **Vitest** em ambiente **JSDOM** com engine de cobertura **V8**. Foram estabelecidas métricas rígidas de cobertura (mínimo de 80% para módulos do processo principal do Electron) e criados os primeiros testes automatizados para `DatabaseManager`, `handlers.ts` IPC, `AIService` e páginas React.
3. **Estabilização da Persistência e Integridade Referencial no SQLite**: Resolução de uma falha severa de integridade referencial que impedia a exclusão de projetos com chaves estrangeiras ativas. Foi implementado o padrão de exclusão transacional encadeada (`ON DELETE CASCADE`) acompanhado da remoção física síncrona dos arquivos PDF do sistema de arquivos (`fs.unlinkSync`) via transação ACID no SQLite (`DatabaseManager.ts`).
4. **Ergonomia e Correções do Leitor de PDF e Serviços de IA**:
   - Correção do bug de renderização no leitor de PDF (`ArticleReaderPage.tsx`), forçando a remontagem limpa do componente de visualização via prop `key={scale}` ao alterar o nível de zoom.
   - Preservação correta de quebras de linha em resumos gerados por IA através da conversão de caracteres de escape nulos/literais (`\n` para quebras reais).
   - Implementação de algoritmo de preenchimento seletivo de metadados no modal de edição (`EditArticleModal.tsx`), assegurando que a extração via IA preencha estritamente campos nulos ou vazios, evitando a sobrescrita acidental de dados editados manualmente pelo pesquisador.
   - Vinculação adequada do registro de histórico de busca (`search_id`) na importação manual em lote de arquivos PDF (`handlers.ts`).

---

## 3. Detalhamento Profundo

### 3.1. Decisões de Engenharia & Racional Arquitetural

#### Unificação em TypeScript e Adoção Nativa do Electron (Local-First Desktop Architecture)
A análise detalhada da arquitetura inicial apontou que manter um servidor HTTP secundário em Python (FastAPI) rodando localmente na porta 8000 para se comunicar com a interface Vite introduzia três grandes gargalos:
- **Complexidade de distribuição e UX**: O pesquisador precisava gerenciar instaladores de Python e Node.js e lidar com possíveis bloqueios de Firewall em portas de rede locais.
- **Tamanho excessivo de pacote (Bundle Size)**: A inclusão do interpretador Python e bibliotecas científicas inflaria o instalador para quase 500 MB.
- **Latência de Cold Start**: Inicializar chamadas via processo secundário adicionava atrasos na resposta.

A decisão documentada em `docs/auditoria/2026-05-29_refatoracao_electron.md` migrou 100% da lógica de negócios, banco de dados (via driver nativo `better-sqlite3`) e integrações de API para o processo principal (*Main Process*) do Electron em Node.js. A comunicação passou a ser intermediada por barramentos de memória ultra-rápidos via IPC (`ipcMain.handle` e `ipcRenderer.invoke`).

#### Estratégia de Cobertura e Testabilidade (Vitest + JSDOM)
A adoção do **Vitest** em substituição ao Jest foi motivada pela integração nativa com o pipeline do Vite, garantindo execução extremamente célere e reutilização imediata de aliases de módulos e sintaxe TypeScript/ESM sem necessidade de transpiladores adicionais. O arquivo `vitest.config.mts` definiu metas de qualidade (thresholds) elevadas para os módulos de backend (`electron/**/*`), forçando 80% de cobertura em linhas, funções, ramos e instruções.

#### Garantia de Integridade de Dados no SQLite e Purga de Arquivos Físicos
Na exclusão de um projeto de pesquisa, o banco de dados anterior falhava se houvesse registros filhos vinculados (artigos, destaques, anotações, documentos ou histórico). No commit `cf9434ab`, a rotina `deleteProject` foi reescrita utilizando uma **transação ACID explícita** do SQLite (`this.db.transaction()`). O algoritmo realiza uma varredura bidirecional:
1. Consulta e coleta todos os caminhos físicos de PDFs associados aos artigos e documentos do projeto.
2. Executa a limpeza física de cada arquivo no disco através da API síncrona `fs.unlinkSync`.
3. Deleta registros dependentes nas tabelas `highlights`, `annotations`, `articles`, `project_documents`, `search_history` e `project_diary`.
4. Remove o registro pai da tabela `projects`.

Caso ocorra qualquer erro em qualquer etapa da exclusão, a transação é revertida (*rollback*), impedindo a corrupção do banco ou o surgimento de registros órfãos.

#### Mutação Não-Destrutiva de Metadados via IA
Para evitar a perda de correções efetuadas manualmente pelo usuário (ex: título corrigido ou autores ajustados), o método de extração automática via IA foi ajustado no componente `EditArticleModal.tsx` utilizando atualização de estado funcional baseada na presença prévia de dados:

$$\text{ValorFinal} = \begin{cases} \text{ValorAtual}, & \text{se } \text{ValorAtual.trim()} \neq \emptyset \\ \text{ValorExtraído}, & \text{caso contrário} \end{cases}$$

---

### 3.2. Diagrama de Arquitetura e Fluxo de Dados (Mermaid)

```mermaid
graph TD
    subgraph Audit & Architecture Phase 4
        A[Commit 61-63: Relatórios de Auditoria<br/>docs/auditoria/] --> B[Commit 64: Infraestrutura Vitest<br/>vitest.config.mts & setupTests.ts]
        B --> C[Commit 65: Políticas de CSP & Vite Preamble<br/>index.html & main.ts]
    end

    subgraph Core Stabilization & Integrity Chain
        C --> D[Commit 68: Estabilização do Reader PDF<br/>ArticleReaderPage.tsx]
        C --> E[Commit 69: Extração Seletiva IA<br/>EditArticleModal.tsx]
        C --> F[Commit 70: Deleção Transacional em Cascata<br/>DatabaseManager.ts]
        C --> G[Commit 71: Vínculo de Histórico em Lote<br/>electron/ipc/handlers.ts]
    end

    subgraph Component & System Execution
        D -->|Prop key=scale| D1[PdfHighlighter Re-render Limpo]
        D -->|regex \\n -> \n| D2[Resumo IA Formatado]
        E -->|prev.trim() check| E1[Preservação de Metadados Manuais]
        F -->|this.db.transaction| F1[(SQLite Database)]
        F -->|fs.unlinkSync| F2[Diretório Physical Storage PDFs]
        G -->|saveSearchHistory & search_id| G1[Historico de Buscas do Projeto]
    end
```

---

### 3.3. Evolução da Estrutura de Diretórios e Arquivos

| Diretório / Arquivo | Tipo de Mudança | Propósito / Descrição Técnica |
|---|---|---|
| `docs/auditoria/2026-05-29_1_desempenho.md` | Novo | Diagnóstico de gargalos de memória e latência HTTP local. |
| `docs/auditoria/2026-05-29_2_cobertura.md` | Novo | Análise das lacunas de testes unitários no MVP inicial. |
| `docs/auditoria/2026-05-29_3_qualidade.md` | Novo | Mapeamento de acoplamento de código e violações SOLID. |
| `docs/auditoria/2026-05-29_4_seguranca.md` | Novo | Avaliação de vulnerabilidades e política de segurança de conteúdo. |
| `docs/auditoria/2026-05-29_refatoracao_electron.md` | Novo | Proposta formal de migração arquitetural para Electron + React/Vite. |
| `emmas_librarian/vitest.config.mts` | Criado/Atualizado | Configuração do runner de testes Vitest, V8 coverage e thresholds. |
| `emmas_librarian/src/setupTests.ts` | Criado | Setup global do ambiente JSDOM e mocks DOM para a suíte de testes. |
| `emmas_librarian/electron/database/DatabaseManager.ts` | Modificado | Implementação da transação ACID para exclusão em cascata e remoção física de PDFs. |
| `emmas_librarian/electron/database/__tests__/DatabaseManager.test.ts` | Criado | Testes unitários para ciclo de vida do projeto e testes de regressão de exclusão. |
| `emmas_librarian/electron/ipc/handlers.ts` | Modificado | Injeção de `search_id` na criação manual e importação em lote de artigos. |
| `emmas_librarian/electron/ipc/__tests__/handlers.test.ts` | Criado | Testes de integração para os canais de comunicação IPC do Electron. |
| `emmas_librarian/src/pages/ArticleReaderPage.tsx` | Modificado | Correção de re-renderização de zoom (`key={scale}`) e parsing de quebras de linha. |
| `emmas_librarian/src/components/EditArticleModal.tsx` | Modificado | Lógica de substituição condicional de metadados extraídos por IA. |
| `emmas_librarian/index.html` | Modificado | Atualização da meta tag CSP permitindo `unsafe-inline` para dev preamble. |

---

### 3.4. Trechos de Código Principais (Extraídos dos Diffs da Fase 4)

#### A. Configuração da Suíte de Testes e Thresholds de Cobertura (`vitest.config.mts`)
*Fonte: Commit `373bb30c`*

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/release/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    coverage: {
      provider: 'v8',
      include: ['electron/**/*', 'src/**/*'],
      exclude: [
        'electron/**/__tests__/**',
        'src/**/__tests__/**',
        'electron/preload.ts',
        'electron/main.ts',
        'electron/types.ts',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      thresholds: {
        lines: 30,
        branches: 50,
        functions: 30,
        statements: 30,
        'electron/**/*': {
          lines: 80,
          branches: 80,
          functions: 80,
          statements: 80
        }
      }
    }
  }
});
```

#### B. Deleção Transacional em Cascata e Limpeza Física do Disco (`electron/database/DatabaseManager.ts`)
*Fonte: Commit `cf9434ab`*

```typescript
deleteProject(id: number): void {
  const transaction = this.db.transaction(() => {
    // 1. Deletar artigos e seus arquivos PDFs físicos associados
    const articles = this.db.prepare(
      'SELECT id, local_file_path FROM articles WHERE project_id = ?'
    ).all(id) as { id: number; local_file_path?: string }[];

    for (const article of articles) {
      this.db.prepare('DELETE FROM highlights WHERE article_id = ?').run(article.id);
      this.db.prepare('DELETE FROM annotations WHERE article_id = ?').run(article.id);
      if (article.local_file_path) {
        try {
          if (fs.existsSync(article.local_file_path)) {
            fs.unlinkSync(article.local_file_path);
          }
        } catch (err) {
          console.error(`Falha ao remover PDF físico do artigo ${article.id}:`, err);
        }
      }
      this.db.prepare('DELETE FROM articles WHERE id = ?').run(article.id);
    }

    // 2. Deletar documentos do projeto e arquivos anexos
    const docs = this.db.prepare(
      'SELECT id, local_file_path FROM project_documents WHERE project_id = ?'
    ).all(id) as { id: number; local_file_path: string }[];

    for (const doc of docs) {
      if (doc.local_file_path) {
        try {
          if (fs.existsSync(doc.local_file_path)) {
            fs.unlinkSync(doc.local_file_path);
          }
        } catch (err) {
          console.error(`Falha ao remover arquivo de documento ${doc.id}:`, err);
        }
      }
      this.db.prepare('DELETE FROM project_documents WHERE id = ?').run(doc.id);
    }

    // 3. Deletar registros de histórico de buscas e diário do projeto
    this.db.prepare('DELETE FROM search_history WHERE project_id = ?').run(id);
    this.db.prepare('DELETE FROM project_diary WHERE project_id = ?').run(id);

    // 4. Deletar o projeto principal
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  });

  transaction();
}
```

#### C. Remontagem Limpa de Zoom e Sanitização de Resumos no Leitor PDF (`src/pages/ArticleReaderPage.tsx`)
*Fonte: Commit `f73bad59`*

```tsx
// Substituição de caracteres literais de nova linha por quebras reais no resumo de IA
const summary = await projectService.generateSummary(parseInt(id));
setAiSummary({
  generalSummary: summary.generalSummary?.replace(/\\n/g, '\n') || '',
  sectionSummary: summary.sectionSummary?.replace(/\\n/g, '\n') || '',
});

// Forçando recriação do componente PdfHighlighter ao alterar o nível de zoom
<PdfHighlighter
  key={scale}
  ref={highlighterRef}
  pdfDocument={pdfDocument}
  pdfScaleValue={scale.toString()}
  // ...outras props
/>
```

#### D. Preenchimento Seletivo Protegido de Metadados por IA (`src/components/EditArticleModal.tsx`)
*Fonte: Commit `fa1db443`*

```typescript
// Preserva dados editados manualmente e preenche APENAS campos vazios/nulos
const data = await projectService.extractMetadata(article.id);
if (data) {
  setTitle(prev => prev.trim() ? prev : data.title || prev);
  setAuthors(prev => prev.trim() ? prev : data.authors || prev);
  setYear(prev => prev.trim() ? prev : (data.year ? data.year.toString() : prev));
  setDoi(prev => prev.trim() ? prev : data.doi || prev);
  setJournal(prev => prev.trim() ? prev : data.journal || prev);
  setAbstract(prev => prev.trim() ? prev : data.abstract || prev);
}
```

#### E. Vinculação do Histórico de Busca na Importação em Lote de PDFs (`electron/ipc/handlers.ts`)
*Fonte: Commit `f1841d9d`*

```typescript
ipcMain.handle(IpcChannel.ARTICLES_CREATE_FROM_PDFS, async (event, projectId: number, filePaths: string[]) => {
  let searchId: number | undefined = undefined;
  if (filePaths.length > 0) {
    try {
      searchId = db.saveSearchHistory(
        projectId,
        `Importação em Lote de ${filePaths.length} PDFs`,
        {},
        filePaths.length,
        { "Manual": { "count": filePaths.length } }
      );
    } catch (err) {
      console.error("Falha ao registrar importação em lote no histórico de buscas:", err);
    }
  }

  let addedCount = 0;
  // ... loop de cópia de arquivos e persistência de artigos com search_id vinculado
  const articleId = db.saveArticle(projectId, {
    title: path.basename(filePath, path.extname(filePath)),
    source_query: 'Importação em Lote',
    source_databases: JSON.stringify(['Manual']),
    csl_json: JSON.stringify({}),
    search_id: searchId,
  });
  return addedCount;
});
```

---

### 3.5. Tabela Mapeada de Commits da Fase 4

| Hash do Commit | Autor | Data (UTC-3) | Mensagem do Commit | Escopo / Alteração Técnica |
|---|---|---|---|---|
| `f1c44d17` | João Pedro V | 2026-05-26 14:43 | `docs: add code inspection and audit reports` | Adiciona os relatórios iniciais de auditoria técnica. |
| `b2e33097` | João Pedro V | 2026-05-26 17:59 | `docs: move auditoria to docs/auditoria` | Reorganiza diretório de relatórios para `docs/auditoria`. |
| `c2220b3f` | João Pedro V | 2026-05-26 17:59 | `fix: adjust auditoria path` | Ajusta links e caminhos nos documentos de auditoria. |
| `373bb30c` | João Pedro V | 2026-05-26 18:27 | `chore: setup test infrastructure and basic coverage for Phase 1` | Configura Vitest, JSDOM, setupFiles e primeiros testes unitários. |
| `bca819a2` | João Pedro V | 2026-05-29 01:14 | `fix(CSP): add unsafe-inline for development Vite preamble script` | Permite script inline do preamble do Vite no CSP para ambiente de dev. |
| `f73bad59` | João Pedro V | 2026-05-29 03:35 | `fix(reader): fix highlight spaces, zoom re-render, and parse literal newlines in AI summaries` | Corrige zoom via `key={scale}`, preserva espaços e trata `\n` em IA. |
| `fa1db443` | João Pedro V | 2026-05-29 03:35 | `fix(ai): only fill empty fields when extracting metadata via AI` | Impede sobrescrita de metadados manuais ao rodar extração por IA. |
| `cf9434ab` | João Pedro V | 2026-05-29 03:35 | `fix(database): properly cascade delete projects avoiding FK failures and clean up files` | Adiciona deleção em cascata transacional e remoção de arquivos físicos. |
| `f1841d9d` | João Pedro V | 2026-05-29 03:35 | `fix(history): link batch pdf imports to search history correctly` | Atribui `search_id` às importações de PDFs manuais e em lote. |

---
