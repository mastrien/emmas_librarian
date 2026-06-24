# Relatório de Impacto de Testes e Ferramentas (Emma's Librarian)

Este relatório apresenta os resultados obtidos após a reestruturação e ampliação da suíte de testes do projeto **Emma's Librarian**, comparando a linha de base inicial (Fase 1) com os resultados finais (Fase 6). Ele também avalia a experiência do desenvolvedor (DX) no comparativo das ferramentas duplicadas para testes de desempenho (k6 vs. JMeter) e aceitação (Playwright vs. Selenium).

---

## 📊 1. Cobertura de Código (Antes vs. Depois)

Abaixo estão as métricas de cobertura estrutural geradas via Vitest e `@vitest/coverage-v8` para os arquivos do Electron (`electron/**/*`):

| Métrica de Cobertura | Antes (Baseline) | Depois (Final) | Diferença | Status do Limiar (80%) |
| :--- | :---: | :---: | :---: | :---: |
| **Linhas / Comandos (Statement)** | 68.86% | **81.04%** | **+12.18%** | **Aprovado ✅** |
| **Desvios (Branch)** | 71.35% | **84.34%** | **+12.99%** | **Aprovado ✅** |

> **Nota:** O aumento expressivo na cobertura foi obtido pela introdução de testes detalhados com classes de equivalência e análise de valor limite no `EmbeddingService`, além de novas coberturas no Logger de sistema e canais IPC. Com isso, o projeto passou a atingir a barreira mínima obrigatória de **80%** de cobertura no Electron.

---

## 🧬 2. Qualidade dos Testes - Mutation Score (Antes vs. Depois)

Métricas geradas via Stryker Mutator limitadas a `PdfExtractor.ts` e `citationService.ts`:

| Métrica Stryker | Antes (Baseline) | Depois (Final) | Diferença |
| :--- | :---: | :---: | :---: |
| **Mutation Score Global** | 41.47% | **50.99%** | **+9.52%** |
| **Mutantes Mortos (Killed)** | 123 | **154** | **+31** |
| **Mutantes Sobreviventes (Survived)** | 102 | **111** | **+9** |
| **Sem Cobertura (No Coverage)** | 73 | **38** | **-35** |

### Destaque por Arquivo
* **`PdfExtractor.ts`**: Mutation score atingiu **68.48%** (com 62 mutantes mortos).
* **`citationService.ts`**: Mutation score subiu para **43.40%** (com 92 mutantes mortos e os sem cobertura reduzidos pela metade).

---

## 🚦 3. Análise Comparativa: Desempenho (k6 vs. JMeter)

Duas ferramentas foram utilizadas para implementar testes de Carga, Estresse, Capacidade, Soak e Volume:

### k6 (JavaScript/Go)
* **Facilidade de Uso / DX:** Excelente. O script é escrito em Javascript moderno (`load_tests.js`), permitindo o uso de modularização e reaproveitamento de código em funções limpas de menos de 20 linhas.
* **Manutenção no Git:** Extremamente simples. Versiona-se o código-fonte puro, facilitando o code review e Pull Requests.
* **Consumo de Recursos:** Muito leve, escrito em Go, ideal para pipelines de CI/CD.

### Apache JMeter (XML / UI)
* **Facilidade de Uso / DX:** Baixa em ambientes de terminal pura. Depende essencialmente de uma interface gráfica (GUI) para modelar os planos de teste (`load_tests.jmx`).
* **Manutenção no Git:** Complexa. O arquivo gerado é um XML muito verboso de 160+ linhas para apenas 5 requisições simples, tornando revisões de código de diffs inviáveis.
* **Consumo de Recursos:** Alto devido à JVM necessária para rodar o executor.

> **Recomendação:** Para a realidade ágil do *Emma's Librarian*, o **k6** é a ferramenta ideal, mantendo os testes de performance próximos ao ciclo de vida do código dos desenvolvedores.

---

## 🎭 4. Análise Comparativa: Aceitação / E2E (Playwright vs. Selenium)

Os fluxos de aceitação do usuário (Criação de projeto, Adição/Leitura manual e Busca via QueryBuilder) foram automatizados nas duas ferramentas:

### Playwright (Experimental Electron)
* **DX & Integration:** Fantástica. Oferece suporte nativo experimental para o Electron através do módulo `_electron`, permitindo inicializar o aplicativo empacotado (`main.js`) com poucas linhas de código.
* **Robustez:** Recursos de auto-waiting eliminam a maior parte dos problemas de "flakiness" (testes instáveis).
* **Velocidade:** Execução extremamente rápida no Chromium interno.

### Selenium WebDriver
* **DX & Integration:** Complexa. Requer configurar o `chromedriver` combinando-o manualmente com a versão do Chromium embarcada no Electron (`41.7.1`).
* **Boilerplate:** Demanda mais código para realizar esperas explícitas (`driver.wait(until.elementLocated(...))`), aumentando a verbosidade.
* **Portabilidade:** Vantajoso apenas se houvesse necessidade de testar em múltiplos navegadores legados (que não se aplica ao empacotamento nativo Electron).

> **Recomendação:** O **Playwright** provou ser superior em todos os quesitos para o desenvolvimento do Electron, garantindo testes robustos e de fácil legibilidade.
