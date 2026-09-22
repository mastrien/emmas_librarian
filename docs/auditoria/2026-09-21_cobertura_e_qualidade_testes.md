# Relatório de Auditoria: Cobertura e Qualidade da Suíte de Testes

**Projeto**: `emmas_librarian`
**Data**: 2026-09-21
**Escopo**: `emmas_librarian/` (app Electron + React/TS) — testes unitários/integração (Vitest), E2E (Playwright), mutação (Stryker) e performance (k6). Auditoria somente-leitura: nenhuma alteração de código foi feita.
**Comparação**: existe uma auditoria anterior equivalente em [`2026-07-29_testes.md`](./2026-07-29_testes.md); esta revisão reexecuta os testes do zero e reavalia o estado atual.

---

## Estado Atual

### 1. Execução da suíte (medida nesta auditoria, `npx vitest run --coverage`)
- **Arquivos de teste**: 91 (todos passando)
- **Testes**: 770 passando, 2 `it.skip` (em `ProjectDetailsPage.test.tsx`)
- **Falhas**: 0 — a incompatibilidade de ABI do `better-sqlite3` relatada na auditoria de 2026-07-29 (10 arquivos/77 testes falhando) **não se reproduz mais**; o ambiente atual roda de ponta a ponta sem rebuild manual.
- **Duração**: ~104s
- **Densidade de asserções**: 2103 `expect()` em 770 testes (~2,7 por teste) — saudável, não há sinal de testes "vazios".
- **Uso de mocks**: 100 chamadas `vi.mock(...)` em 42 dos 91 arquivos (46%) — proporção razoável, mas ver Ponto Crítico 3.

### 2. Cobertura de código (v8, thresholds configurados em `vitest.config.mts`)

Threshold configurado: **100%** em lines/branches/functions/statements, tanto globalmente quanto para `electron/**/*`.

| Escopo | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **Global** | 79.55% | 80.48% | **61.04%** | 79.55% |
| **`electron/**`** | 87.27% | 85.99% | 94.56% | 87.27% |

O comando `npm run coverage` **falha** com 8 erros de threshold (`ERROR: Coverage for ... does not meet ... threshold (100%)`). Ou seja, o gate de cobertura configurado nunca é satisfeito — ver Ponto Crítico 1.

Cobertura por área (destaques; tabela completa disponível via `npm run coverage`):

| Área | Stmts | Branches | Funcs |
|---|---|---|---|
| `electron/database` | 96.4% | 91.4% | 93.5% |
| `electron/services` | 86.7% | 82.7% | 97.0% |
| `electron/services/llm` | 85.9% | 76.1% | 100% |
| `electron/ipc` | 68.3% | 78.0% | 90.0% |
| `src/services` | 44.4% | 73.8% | **5.0%** |
| `src/components/reader` | 49.7% | 31.0% | 19.0% |
| `src/pages/Settings/components` | 69.1% | 42.9% | 23.8% |
| `src/hooks`, `src/contexts`, `src/types` | 100% | 100% | 100% |

### 3. Testes E2E (Playwright)
- 11 specs em `e2e-tests/` (647 linhas), cobrindo agenda, config de IA, backup, fluxos de erro, export, investigação massiva, import de PDF, questionário, busca semântica, compartilhamento/biblioteca de PDF.
- Apenas **39 `expect()`** no total — baixa densidade de asserção relativa ao volume de fluxos cobertos; muitos specs provavelmente validam navegação/renderização sem checar profundamente o resultado.
- Exige Electron real (`headless: false`), roda sequencialmente (`workers: 1`, `fullyParallel: false`) e depende de build prévio (`rebuild:electron` + `tsc` + `vite`). Não é trivial de rodar em CI sem runner com GUI/Xvfb — e hoje **não roda em CI** (ver Ponto Crítico 1).

### 4. Testes de mutação (Stryker)
- Configurado em `stryker.config.json` para mutar `electron/**/*.ts`, `src/services/**/*.ts` e `src/utils/**/*.ts`.
- Existe um relatório em `reports/mutation/mutation.html`, mas ao inspecionar seu conteúdo (JSON embutido) constatou-se que ele cobre **um único arquivo**: `src/utils/pdfTextSearch.ts`, com data de 2026-08-06 (~7 semanas desatualizado). Não há evidência de que a suíte de mutação tenha rodado alguma vez sobre o escopo completo configurado.
- Resultado desse recorte único: **171 mutantes**, 109 `Killed`, 57 `Survived`, 5 `Timeout` → **score de mutação ≈ 66,7%**.
- Achado relevante: `pdfTextSearch.ts` tem **100% de cobertura de linha/branch/statement** no Vitest, mas apenas 66,7% dos mutantes morrem — prova concreta, dentro do próprio projeto, de que cobertura de linha não implica testes efetivos (ver Ponto Crítico 2).

### 5. Performance (k6) e CI
- Scripts `test:k6` / `test:performance:*` existem e usam um harness dedicado (`performance-tests/`), mas não há evidência de execução recorrente nem de integração com pipeline.
- `.github/workflows/` contém apenas `deploy-pages.yml` (landing page) e `release.yml` (build + publish de instalador). **Nenhum workflow executa `npm test`, `npm run coverage`, `npm run test:e2e` ou `npm run test:mutate`.**
- Único gate automatizado é o hook `.husky/pre-commit`, que roda `npm test` (sem coverage, sem thresholds) — local, e contornável com `git commit --no-verify`.

---

## Pontos Críticos

### 1. Gate de qualidade inexistente em CI + threshold de cobertura inatingível e não aplicado (Severidade: Alta)
- O `vitest.config.mts` declara threshold de **100%** em todas as métricas, mas a cobertura real está em 61–87% dependendo da métrica. Esse threshold nunca passou e provavelmente nunca foi pensado para ser cumprido literalmente — na prática funciona como "ruído", pois `npm run coverage` sempre falha e ninguém reage a isso.
- Nenhum workflow do GitHub Actions roda testes. O workflow `release.yml`, que builda e **publica o instalador para os usuários finais**, não executa `npm test` nem `npm run typecheck` antes do build — um build quebrado (typecheck ou teste) pode ser publicado sem qualquer verificação automatizada.
- O único gate é o pre-commit local (`husky`), que é opcional na prática (bypassável) e não cobre PRs de outros ambientes/máquinas.
- **Risco concreto**: uma regressão que quebra testes só é pega se o desenvolvedor rodar `npm test` localmente e não usar `--no-verify`; releases de produção não têm nenhuma rede de segurança automatizada.

### 2. Cobertura de linha não reflete qualidade real dos testes (Severidade: Média-Alta)
- O único arquivo com mutação testada (`pdfTextSearch.ts`) tem 100% de cobertura de linha e apenas 66,7% de mutation score — 57 mutantes sobreviventes em um arquivo "totalmente coberto". Isso indica que testes existentes tendem a *exercitar* código sem *afirmar* (assert) todos os comportamentos esperados (mutantes de `StringLiteral` e `ConditionalExpression` sobrevivendo em maior número sugerem asserções fracas sobre valores exatos e sobre condições de borda).
- Como a suíte de mutação nunca rodou no escopo completo (`electron/**`, `src/services/**`, `src/utils/**`), não há visibilidade real sobre a qualidade dos testes fora desse único arquivo — a auditoria só pode alertar pelo padrão observado, não medir o restante.

### 3. `src/services/api.ts` — camada central de IPC do frontend, praticamente sem teste direto (Severidade: Alta)
- `src/services/api.ts` (510 linhas) é o único ponto de entrada que todo componente/página usa para falar com o processo principal via `window.electronAPI.invoke`, incluindo o wrapper `safeInvoke` que padroniza erros via `parseIpcError`.
- Cobertura real: **2,06% de funções, 28,3% de linhas**. Não existe nenhum arquivo de teste dedicado (`src/services/__tests__/` só tem `citationService.test.ts` e `fakes/`).
- Causa raiz identificada: **17 arquivos de teste** fazem `vi.mock('.../services/api')` e substituem todo o módulo por mocks, então a implementação real (incluindo o tratamento de erro de IPC) nunca é exercitada pelos testes de página/componente.
- **Risco concreto**: um erro de digitação num nome de canal IPC, uma regressão em `parseIpcError`, ou uma mudança na assinatura de qualquer uma das ~90 funções exportadas em `api.ts` não seria pega por nenhum teste automatizado — só apareceria em uso manual ou E2E (que também não roda em CI).

### 4. Componentes de UI grandes e centrais com cobertura zero ou quase zero (Severidade: Média-Alta)
| Arquivo | Linhas | Stmts | Observação |
|---|---|---|---|
| `src/pages/ProjectDetails/components/ArticleTable.tsx` | 368 | **0%** | Tabela principal de artigos de um projeto — feature central, sem teste algum (não confundir com o `ArticleTable.tsx` de `src/components/common`, que tem 91,9% e é testado). |
| `src/components/modals/MassCitation/MassCitationEditor.tsx` | 344 | **0%** | Editor de citação em massa. |
| `src/components/common/DiarySection.tsx` | 537 | 1.58% | Diário do projeto — quase totalmente sem cobertura. |
| `src/components/reader/SearchTab.tsx` | 145 | 1.68% | Aba de busca dentro do leitor de artigo. |
| `src/components/reader/AiInsightsTab.tsx` | 107 | 4.59% | Aba de insights de IA no leitor. |
| `src/components/reader/TipContent.tsx` | 84 | 2.81% | — |
| `src/components/common/ErrorBoundary.tsx` | 88 | 0% | Error boundary React — nenhum teste garante que a UI de fallback realmente aparece quando um componente filho lança exceção. |

No conjunto, a área de **abas do leitor de artigo** (`src/components/reader/*`) está em 49,7% stmts / 19% functions — um bloco funcional inteiro (leitura/anotação/IA sobre o PDF) é o ponto mais fraco do frontend.

*Observação de controle*: `LLMProviderGateway.ts` e `ProjectServiceInterface.ts` também aparecem com 0%, mas são apenas `interface`/tipos TypeScript sem código executável — 0% aí é esperado e **não** é um problema real (diferente dos itens da tabela acima).

### 5. Tratamento de erro do processo principal (Electron) parcialmente não testado (Severidade: Média)
- `electron/ipc/errorHandler.ts` (59,52% stmts / 73,07% branches): os ramos que classificam `SQLITE_BUSY` → `ERR_DATABASE_LOCKED`, falha de rede (`fetch failed`/`ECONNREFUSED`) → `ERR_API_CONNECTION`, e o fallback genérico `ERR_INTERNAL` **não são exercitados** por nenhum teste (linhas 85-92, 101-108 descobertas). Esse é o módulo que traduz falhas brutas (SQLite, rede, IA) em mensagens de erro estruturadas mostradas ao usuário — regressões aqui mudam silenciosamente a mensagem que o usuário final vê num erro real.
- `electron/ipc/ipcRegistries.ts` (879 linhas, 64,39% stmts) é o maior arquivo de registro de handlers IPC do processo principal e tem mais de um terço sem cobertura.
- `electron/services/llm/jsonRepair.ts` (59,45% stmts, **33,33% branches**) — utilitário que tenta reparar JSON malformado vindo de respostas de LLM; branches de reparo pouco testadas é especialmente arriscado porque esse código já existe justamente para lidar com entradas imprevisíveis.

### 6. Avisos de React `act(...)` indicando testes assíncronos mal encapsulados (Severidade: Baixa-Média)
- 105 ocorrências do aviso `An update to <Componente> inside a test was not wrapped in act(...)`, concentradas em `ArticleReaderPage.test.tsx`, `ProjectDetailsPage.test.tsx` e `AIExtractionModal.test.tsx`.
- Esse padrão (já apontado na auditoria de 2026-07-29 e ainda presente) indica atualizações de estado assíncronas não aguardadas corretamente nos testes (falta de `await act(...)` / `waitFor(...)`). Não quebra os testes hoje, mas mascara condições de corrida reais e deixa a suíte mais frágil a mudanças de timing.

### 7. Configurações de teste que não refletem a realidade do projeto
- Threshold de cobertura 100% (item 1) é o exemplo mais visível, mas o próprio `test:mutate` roda sem `--incremental` ou filtro, e o relatório existente sugere que rodá-lo no escopo completo hoje seria a primeira vez — não há dado sobre quanto tempo isso levaria nem se passaria.

---

## Mudanças Necessárias (priorizadas)

### Prioridade 1 — Fechar a lacuna de CI e tornar a cobertura configurada realista
1. Adicionar um workflow do GitHub Actions (`.github/workflows/test.yml`) que rode `npm test` (e idealmente `npm run coverage` + `npm run typecheck`) em push/PR para `main` e para branches de feature.
2. Adicionar `npm run typecheck && npm test` como pré-requisito do `release.yml` antes do `electron:build`, para impedir publicar um instalador com testes quebrados.
3. Recalibrar os thresholds de `vitest.config.mts` para valores que reflitam o estado real (ex.: começar em ~75-80% global e ~85% para `electron/**`, com um plano incremental de subir), em vez de manter 100% inatingível e ignorado.

### Prioridade 2 — Cobrir a camada de API/IPC do frontend
4. Criar `src/services/__tests__/api.test.ts` testando `safeInvoke` diretamente (canal correto sendo invocado, propagação de erro via `parseIpcError`) sem mockar o módulo inteiro — pelo menos para os fluxos mais usados (projects, articles, highlights, AI).
5. Nos 17 testes que hoje fazem `vi.mock('.../services/api')`, avaliar quais podem ser convertidos para usar o `api.ts` real contra um `window.electronAPI.invoke` mockado (o setup global já mocka isso em `src/setupTests.ts`), preservando isolamento de página mas exercitando o wrapper real.

### Prioridade 3 — Testar os componentes de UI críticos sem cobertura
6. Escrever testes para `ProjectDetails/components/ArticleTable.tsx` (0%, componente central) e `MassCitationEditor.tsx` (0%).
7. Escrever testes para `ErrorBoundary.tsx` (renderizar um filho que lança, confirmar fallback UI).
8. Cobrir as abas do leitor (`SearchTab.tsx`, `AiInsightsTab.tsx`, `TipContent.tsx`, `DiarySection.tsx`) — hoje é o bloco funcional mais fraco do frontend.

### Prioridade 4 — Reforçar caminhos de erro do processo principal
9. Adicionar casos de teste em `electron/ipc/__tests__/errorHandler.test.ts` para os ramos hoje descobertos: `SQLITE_BUSY`, `fetch failed`/`ECONNREFUSED`, e o fallback `ERR_INTERNAL`.
10. Ampliar testes de `jsonRepair.ts` para cobrir os branches de reparo de JSON malformado (markdown fences, vírgulas sobressalentes, aspas não escapadas) mencionados na auditoria anterior.

### Prioridade 5 — Mutação e higiene de testes
11. Rodar `npm run test:mutate` no escopo completo configurado (fora de horário de desenvolvimento, dado o custo) para obter uma linha de base real de mutation score, e usar esse dado — não apenas cobertura de linha — para orientar onde escrever/reforçar asserções, especialmente em `electron/services` e `src/utils`.
12. Corrigir os 105 avisos de `act(...)` em `ArticleReaderPage.test.tsx`, `ProjectDetailsPage.test.tsx` e `AIExtractionModal.test.tsx` envolvendo as atualizações assíncronas em `await act(async () => ...)` / `waitFor(...)`.
13. Aumentar a densidade de asserções nos specs E2E (Playwright) — hoje 39 `expect()` para 11 specs — e avaliar viabilidade de rodar ao menos um subconjunto de fumaça em CI (headless via Xvfb, se aplicável ao Electron).

---

## Resumo Executivo

A suíte de testes é **ampla e estável** (91 arquivos, 770 testes, 0 falhas, boa densidade de asserção média), o que representa uma melhora real em relação à auditoria de 2026-07-29 (que tinha 77 testes falhando por incompatibilidade nativa). Os problemas principais não são de volume de testes, mas de **três lacunas estruturais**:

1. **Nenhum gate automatizado em CI** — o threshold de 100% configurado é ficção, e um release pode sair com testes quebrados.
2. **Um ponto único de falha crítico sem teste direto** — `src/services/api.ts`, a única porta de entrada IPC do frontend, mascarado por mocks em todo lugar.
3. **Evidência concreta (via mutação) de que cobertura de linha superestima a qualidade real dos testes**, combinada com blocos de UI inteiros (abas do leitor, tabela de artigos do projeto, editor de citação em massa) sem nenhuma cobertura.
