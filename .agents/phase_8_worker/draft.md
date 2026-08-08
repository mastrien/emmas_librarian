# Fase 8: Refatoração da Taxonomia Relacional, Suíte Integrada de Testes (E2E/k6/Stryker)

**Posição**: Fase 8 (Commits 130 a 155)

---

## 1. Resumo Executivo

O ciclo de desenvolvimento compreendido entre os commits **130 e 155** (período de 10/06/2026 a 22/07/2026, integrando as releases **v1.1.13 a v1.1.18**) marcou a maturação técnica da arquitetura de dados e da infraestrutura de qualidade de software do **Emma's Librarian**. 

Nesta fase, a engenharia do projeto concentrou-se em resolver duas grandes vulnerabilidades estruturais:
1. **Fragilidade da Taxonomia de Categorias Soltas**: A substituição da atribuição de categorias baseada em strings literais por um modelo relacional normalizado no SQLite (`project_category_options` e `article_category_selections`), erradicando a ocorrência de "rótulos órfãos" ao renomear ou excluir categorias. O mecanismo de transporte assíncrono `.emmapcarc` (`SyncService.ts`) foi estendido para garantir a integridade dessas relações em migrações entre ambientes.
2. **Ausência de Validação Formal Multidimensional**: A concepção e execução do **Plano Diretor de Qualidade de Testes (Fases 1 a 6)**, estabelecendo uma suíte abrangente composta por:
   - **Testes Funcionais e Estruturais (Vitest & RTL)**: Aplicação de Particionamento por Classes de Equivalência (EP), Análise do Valor Limite (BVA), Cobertura de Ramificações (Branches) e Pares de Def-Uso (Data Flow).
   - **Engenharia de Mutações (Stryker Mutator)**: Validação da eficácia dos testes unitários através da injeção deliberada de mutantes no código-fonte.
   - **Automação End-to-End para Electron (Playwright)**: Testes de aceitação automatizados interagindo diretamente com o processo principal e o DOM renderizado do aplicativo desktop.
   - **Benchmarking de Performance (k6 vs. Apache JMeter)**: Avaliação rigorosa sob cenários de Carga, Estresse, Resiliência (Soak), Volume (100.000 registros) e Capacidade.

---

## 2. Detalhamento Profundo

### 2.1. Decisões de Engenharia & Racional Arquitetural

#### A. Normalização Relacional da Taxonomia de Categorias
- **Desafio Encontrado**: Anteriormente ao commit `132 (043e0c6)`, a atribuição de categorias personalizadas aos artigos utilizava a tabela `article_categories`, salvando valores em texto livre. Quando o pesquisador alterava a grafia ou o nome de uma categoria no projeto, os artigos associados mantinham o texto antigo, gerando inconsistências bibliométricas e "rótulos órfãos" inacessíveis pela interface.
- **Solução de Engenharia**:
  - Reformulação da DDL do SQLite para introduzir a tabela `project_category_options` (que define as opções permitidas para cada categoria de um projeto) e a tabela de junção `article_category_selections` (relacionando `article_id`, `category_id` e `option_id` com chaves estrangeiras declaradas como `FOREIGN KEY ... ON DELETE CASCADE`).
  - Atualização do motor de transporte de dados `SyncService.ts` no commit `136 (6d1c349)` para incluir as tabelas `categoryOptions` e `categorySelections` na carga JSON do pacote `.emmapcarc`. Durante a importação, um mapeamento relacional dinâmico (`optionMap`) reescreve os IDs antigos para os novos IDs gerados no banco de destino, preservando perfeitamente a taxonomia.

#### B. Estratégia de Integração de Testes Bottom-Up
- **Racional**: Para evitar a criação de testes frágeis baseados em excesso de *stubs* ou *mocks* artificiais das camadas de infraestrutura, a suíte de testes de integração adotou a estratégia **Bottom-Up**.
- **Execução**:
  1. *Camada L1 (Infraestrutura/Base)*: Validação do driver SQLite (`better-sqlite3` rodando em memória `:memory:`), do parser estrutural `PdfExtractor.ts` e do gerador de vetores `EmbeddingService.ts`.
  2. *Camada L2 (Serviços Coordenadores)*: Testes do `SyncService.ts` e `SearchOrchestrator.ts` operando sobre os componentes L1 reais e validados.
  3. *Camada L3 (Interface e IPC)*: Testes de aceitação com `React Testing Library` e `Playwright _electron` simulando eventos IPC reais sem falsear o comportamento do backend.

#### C. Engenharia de Testes por Mutações (Stryker Mutator)
- **Racional**: A cobertura tradicional de linhas (*Statement Coverage*) pode ser enganosa se os testes não contiverem asserções profundas. A inclusão do Stryker Mutator (`@stryker-mutator/vitest-runner`) permitiu injetar alterações sintáticas (mutações) no código de `PdfExtractor.ts`, `AIModelConfigRepository.ts`, `QueryTranslator.ts` e `ApiIntegrator.ts`.
- **Resultados**: A cobertura de desvios (*Branch Coverage*) subiu de **71.35% para 84.34%**, a cobertura de linhas atingiu **81.04%** (superando o limiar regulatório de 80%), e o *Mutation Score* global aumentou de **41.47% para 50.99%**, com 154 mutantes eliminados (*killed*).

#### D. Automação E2E para Desktop Electron (Playwright)
- **Implementação**: Configuração da suíte Playwright em `emmas_librarian/e2e-tests/` utilizando a API nativa `_electron.launch()`. Os testes validam o ciclo completo de uso do software: inicialização do processo Electron, criação de projetos, upload e leitura de PDFs, atribuição de categorias via `CategoryCell`, e execução de buscas booleanas no `QueryBuilder`.
- **Integração de Compilação**: Foi implementado o rebuild automático dos módulos nativos C++ do Electron (`electron-rebuild` para o `better-sqlite3`) antes da execução da suíte E2E, evitando falhas de incompatibilidade de ABI Node/Electron durante os testes headless.

#### E. Testes Empíricos de Performance (k6 vs. Apache JMeter)
- **Modelagem de Carga**: No arquivo `performance-tests/performance-harness.js`, foi criado um ambiente de benchmarking simulando 5 cenários críticos de estresse I/O e concorrência:
  1. *Carga (Load)*: 20 Usuários Virtuais (VUs) simultâneos realizando operações de leitura/escrita.
  2. *Estresse (Stress)*: Inserções massivas e escritas simultâneas no banco SQLite.
  3. *Resiliência (Soak)*: Execução contínua monitorando vazamentos de memória no Garbage Collector do V8.
  4. *Volume*: Consultas paginadas sobre uma base mockada contendo **100.000 registros bibliográficos**.
  5. *Capacidade*: Medição da vazão máxima (throughput) mantendo resposta abaixo de 200ms.
- **Resultado do Comparativo**:
  - **k6**: Vazão média de **25.36 req/s**, 1020 requisições executadas com 0% de falha em assertions.
  - **JMeter**: Vazão média de **33.1 req/s**, 1000 requisições executadas com 0% de erro HTTP.

---

### 2.2. Diagrama de Arquitetura & Fluxos (Mermaid)

O diagrama abaixo ilustra a arquitetura da Taxonomia Relacional, o fluxo do motor de transporte `.emmapcarc` e a organização da Suíte Integrada de Testes:

```mermaid
flowchart TD
    subgraph Schema_Relacional [Taxonomia Relacional de Categorias (SQLite)]
        PC[project_categories] -->|1:N CASCADE| PCO[project_category_options]
        A[articles] -->|N:M CASCADE| ACS[article_category_selections]
        PC -->|1:N CASCADE| ACS
        PCO -->|1:N CASCADE| ACS
    end

    subgraph Sync_Engine [Motor de Transporte SyncService]
        ACS -->|Export Relational Data| ZIP[Empacotador .emmapcarc AdmZip]
        PCO -->|Export Options| ZIP
        ZIP -->|Import Project| MAP[Mapeador de IDs Relacionais\ncategoryMap & optionMap]
        MAP -->|Persistência Sem Órfãos| DB[(Emma DB Local)]
    end

    subgraph Testing_Suite [Suíte Integrada e Multidimensional de Testes]
        direction TB
        E2E[Playwright _electron\ne2e-tests/] -->|Testes de Aceitação & UI| ElectronApp[Aplicativo Desktop Electron]
        Stryker[Stryker Mutator\n@stryker-mutator/vitest-runner] -->|Injeção de Mutações| CoreModules[src/ & electron/ Core]
        Vitest[Vitest / RTL\nIntegration Bottom-Up] -->|Validação L1, L2, L3| CoreModules
        k6[k6 & Apache JMeter\nperformance-tests/] -->|Load, Stress, Soak, Volume 100k| Harness[performance-harness.js]
    end
```

---

### 2.3. Tabela de Estrutura de Diretórios e Arquivos (Fase 8)

| Diretório / Arquivo | Tipo | Descrição e Responsabilidade Técnica |
|---|---|---|
| `electron/database/schema.sql` | Arquivo SQL | Contém as DDLs das tabelas `project_category_options` e `article_category_selections` com restrições `FOREIGN KEY ... ON DELETE CASCADE`. |
| `electron/database/SyncService.ts` | TypeScript | Serviço responsável pela exportação/importação do pacote de transporte `.emmapcarc`. Atualizado (Commit `6d1c349`) para sincronizar `categoryOptions`, `categorySelections`, `questionSets` e `investigationResults`. |
| `e2e-tests/` | Diretório | Suíte de testes end-to-end automatizados via Playwright utilizando a API nativa `_electron` para simulação do aplicativo desktop empacotado. |
| `e2e-tests/agenda.spec.ts` | TypeScript | Testes de aceitação E2E para validação de formulários, seleções e navegação da interface. |
| `performance-tests/` | Diretório | Contém scripts de teste de carga, estresse, resiliência, volume e capacidade em k6 e planos de teste do Apache JMeter. |
| `performance-tests/performance-harness.js` | JavaScript | Servidor de testes de performance mockando workloads pesados de I/O e consultas SQLite com 100.000 registros. |
| `stryker.config.json` | JSON | Arquivo de configuração do Stryker Mutator especificando alvos em `src/` e `electron/` e o runner Vitest. |
| `docs/relatorios/2026-06-24_comprehensive_testing_report.md` | Markdown | Relatório abrangente com tabelas de Particionamento por Classes de Equivalência, Análise do Valor Limite, Def-Use Pairs, relatório de mutantes e benchmark k6 vs JMeter. |
| `docs/relatorios/2026-06-24_test_impact_report.md` | Markdown | Relatório quantitativo do impacto dos testes, medindo a evolução da cobertura de desvios (+12.99%) e linhas (+12.18%). |
| `docs/planos/2026-06-24_projeto_piloto_testes.md` | Markdown | Plano Diretor de Qualidade de Testes com as diretrizes das Fases 1 a 6. |

---

### 2.4. Trechos de Código Principais (Diffs dos Commits)

#### 1. Schema DDL Relacional de Categorias (Commit `043e0c6` em `schema.sql`)
```sql
-- Tabela para armazenamento de opções predefinidas por categoria de projeto
CREATE TABLE IF NOT EXISTS project_category_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE
);

-- Tabela relacional de junção para escolhas de categoria por artigo (elimina rótulos órfãos)
CREATE TABLE IF NOT EXISTS article_category_selections (
    article_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    PRIMARY KEY(article_id, category_id, option_id),
    FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
    FOREIGN KEY(option_id) REFERENCES project_category_options(id) ON DELETE CASCADE
);
```

#### 2. Exportação e Importação Relacional no SyncService (Commit `6d1c349` em `SyncService.ts`)
```typescript
// Exportação de opções relacionais de categoria e seleções por artigo
const categoryOptions = db
  .prepare(
    `SELECT pco.* FROM project_category_options pco
     JOIN project_categories pc ON pco.category_id = pc.id
     WHERE pc.project_id = ?`,
  )
  .all(projectId);

const categorySelections = db
  .prepare(
    `SELECT acs.* FROM article_category_selections acs
     JOIN project_categories pc ON acs.category_id = pc.id
     WHERE pc.project_id = ?`,
  )
  .all(projectId);

// Empacotamento no payload JSON do projeto (.emmapcarc)
const exportData = {
  project,
  articles,
  searchHistory,
  projectDocs,
  massiveInvs,
  projCategories,
  categoryOptions,
  articleCategories,
  categorySelections,
  annotations,
  highlights,
  pendingHighlights,
  diaryEntries,
  diaryHistory,
  questionSets,
  investigationResults,
};
```

#### 3. Configuração do Teste de Mutações com Stryker (`stryker.config.json` - Commit `136`/`143`)
```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "reporters": ["html", "clear-text", "progress"],
  "mutate": [
    "electron/services/PdfExtractor.ts",
    "electron/services/EmbeddingService.ts",
    "electron/repositories/AIModelConfigRepository.ts",
    "electron/repositories/QuestionSetRepository.ts"
  ],
  "coverageAnalysis": "perTest"
}
```

#### 4. Automação E2E para Electron via Playwright (`e2e-tests/app-launch.spec.ts` - Commit `136`/`139`)
```typescript
import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';

test('deve inicializar a janela principal do Electron e carregar o Dashboard', async () => {
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../electron/main.js')],
    env: { ...process.env, NODE_ENV: 'test' }
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const title = await window.title();
  expect(title).toContain("Emma's Librarian");

  await electronApp.close();
});
```

---

### 2.5. Tabela Mapeada de Commits da Fase 8 (Commits 130 a 155)

| Índice | Hash | Autor | Data (UTC-3) | Mensagem do Commit | Descrição & Escopo Principal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 130 | `9e00039` | João Pedro V | 2026-06-10 15:32:16 | `fix: ordenar citacao massiva por sobrenome do primeiro autor` | Ajusta a ordenação de citação em massa pelo sobrenome do primeiro autor. |
| 131 | `c17df04` | João Pedro V | 2026-06-19 21:32:38 | `fix: PDF reader zoom shortcuts and state, annotation line breaks, sidebar minimum width, categories state refresh, and Help menus updates` | Correções de atalhos e estado de zoom no PDF reader, quebra de linha em anotações, largura mínima da sidebar e atualização de menus. |
| 132 | `043e0c6` | João Pedro V | 2026-06-20 00:44:40 | `feat: refactor categories editing to use relation-based options to fix orphaned labels` | Refatora edição de categorias para modelo relacional (`project_category_options`), eliminando rótulos órfãos. |
| 133 | `cb0b167` | João Pedro V | 2026-06-20 01:03:22 | `test: add regression tests for category options refactor` | Adiciona testes de regressão automatizados para a refatoração relacional de categorias. |
| 134 | `172c5e6` | João Pedro V | 2026-06-24 01:43:34 | `fix: resolve bugs na UI, no logs e testes de AI` | Resolução de inconsistências visuais na interface, formatação de logs e testes da integração de IA. |
| 135 | `bbb0c7b` | João Pedro V | 2026-06-24 01:47:05 | `docs: add and update logs, agent rules and documentation` | Adiciona e atualiza logs de desenvolvimento, regras de agentes e documentação técnica. |
| 136 | `fe4b183` | João Pedro V | 2026-06-24 03:49:27 | `chore: implement pilot testing plan (Fases 1-6) including dual load & E2E tests, coverage boost and Stryker mutation reports` | Executa o Plano Diretor de Qualidade de Testes (Fases 1-6), incluindo E2E Playwright, testes de carga e relatórios Stryker Mutator. |
| 137 | `8af275b` | João Pedro V | 2026-06-24 12:43:05 | `chore: add wait-on check to performance tests inside package.json` | Adiciona verificação `wait-on` nos scripts de teste de performance no `package.json`. |
| 138 | `0f4223e` | João Pedro V | 2026-06-24 12:55:10 | `chore: add E2E devDependencies to package.json and update .gitignore` | Adiciona dependências de desenvolvimento E2E (Playwright) ao `package.json` e atualiza `.gitignore`. |
| 139 | `6050aa7` | João Pedro V | 2026-06-24 13:05:57 | `chore: throw custom environment errors in E2E tests under headless setups to avoid timeouts` | Trata erros de ambiente em testes E2E headless lançando exceções customizadas para evitar timeouts. |
| 140 | `8854fe7` | João Pedro V | 2026-06-24 13:09:43 | `chore: ensure native modules are rebuilt for electron before running E2E tests` | Adiciona rebuild automático dos módulos nativos C++ do Electron (`electron-rebuild`) antes da suíte E2E. |
| 141 | `42baf43` | João Pedro V | 2026-06-24 14:27:29 | `test: validate performance test execution for jmeter and k6 and update thresholds` | Valida execução dos harnesses de performance em k6 e Apache JMeter, ajustando limiares. |
| 142 | `bf7cedc` | João Pedro V | 2026-06-24 15:03:22 | `doc: add comprehensive testing report to docs/relatorios` | Adiciona o relatório consolidado de testes multidimensionais em `docs/relatorios/`. |
| 143 | `11cc889` | João Pedro V | 2026-06-24 15:09:34 | `test: expand stryker mutation targets to cover all main functions` | Expande o escopo de mutação do Stryker Mutator cobrindo todas as funções principais dos repositórios e serviços. |
| 144 | `7345071` | João Pedro V | 2026-06-24 17:03:23 | `doc: update comprehensive testing report with functional, structural and weak points analysis` | Atualiza relatório de testes com análise funcional, estrutural e pontos fracos do software. |
| 145 | `718f1b8` | João Pedro V | 2026-06-24 23:34:13 | `docs: temp_projetofinal_testes` | Adiciona documentação temporária de especificações da suíte de testes. |
| 146 | `6d1c349` | João Pedro V | 2026-06-29 23:40:03 | `feat: add article_category_selections, question_sets and investigation_results to emmapcarc export/import cycle` | Atualiza o `SyncService.ts` para exportar/importar tabelas relacionais de taxonomia e RAG em pacotes `.emmapcarc`. |
| 147 | `97f68be` | João Pedro V | 2026-06-29 23:41:41 | `chore: commit remaining test suite changes before release merge` | Commit de consolidação dos arquivos da suíte de testes antes do merge de release. |
| 148 | `5dc734b` | João Pedro V | 2026-06-29 23:41:59 | `merge: feature/comprehensive-testing-suite into main` | Realiza o merge do branch de testes abrangentes (`feature/comprehensive-testing-suite`) na branch `main`. |
| 149 | `e1293be` | João Pedro V | 2026-06-29 23:45:45 | `chore: release v1.1.13` | Lançamento oficial da versão v1.1.13 do projeto. |
| 150 | `afe9c42` | João Pedro V | 2026-06-30 01:08:37 | `chore: release v1.1.14` | Lançamento oficial da versão v1.1.14 do projeto. |
| 151 | `d818226` | João Pedro V | 2026-06-30 01:10:57 | `docs: update release-manager skill with path validation rules` | Atualiza a skill `release-manager` incluindo validações estritas de caminhos de arquivos. |
| 152 | `db2ded5` | João Pedro V | 2026-07-02 03:42:18 | `chore: release v1.1.15` | Lançamento oficial da versão v1.1.15 do projeto. |
| 153 | `aa68e5f` | João Pedro V | 2026-07-12 02:34:09 | `chore: release v1.1.16` | Lançamento oficial da versão v1.1.16 do projeto. |
| 154 | `37efcf0` | João Pedro V | 2026-07-22 15:07:29 | `chore: release v1.1.17` | Lançamento oficial da versão v1.1.17 do projeto. |
| 155 | `f22810e` | João Pedro V | 2026-07-22 18:34:16 | `chore: release v1.1.18` | Lançamento oficial da versão v1.1.18 do projeto. |


