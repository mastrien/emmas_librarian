# Plano Diretor de Qualidade e Testes - Emma's Librarian

> **⚠️ INSTRUÇÕES CRÍTICAS PARA O AGENTE DE CODIFICAÇÃO (AI DEVELOPER) ⚠️**
> 1. **Criação de Branch:** Antes de iniciar qualquer modificação no código, você **DEVE** criar e fazer checkout para uma nova branch isolada dedicada a esta implementação. Nome sugerido: `feature/comprehensive-testing-suite`.
> 2. **Abordagem Incremental:** Siga as fases estritamente na ordem apresentada.
> 3. **Comparabilidade:** Nas Fases 4 e 5, você receberá a instrução de escrever os **mesmos cenários de teste em duas ferramentas diferentes**. Isso é intencional e obrigatório para permitir o comparativo técnico do projeto.

---

## 🎯 Objetivo Geral
Elevar a maturidade do projeto *Emma's Librarian* expandindo a cobertura atual, gerando novos casos de teste focados em limites e partições, e introduzindo ferramentas de mutação, desempenho e aceitação (E2E) com redundância deliberada para benchmarking de ferramentas.

---

## 🚀 Fase 1: Fundação de Qualidade e Cobertura (Prioridade Máxima)

Como o projeto já possui uma base de testes (Vitest + RTL), nossa primeira ação é avaliar a qualidade real dessa cobertura antes de adicionar novos casos.

### 1.1. Consolidação da Cobertura Estrutural
* **Ação:** Garantir que o script de coverage existente (`@vitest/coverage-v8`) gere relatórios detalhados.
* **Técnicas Aplicadas:** Cobertura de Comandos (Statement) e Cobertura de Desvios (Branch).
* **Agente:** Execute `npm run coverage` para gerar a baseline atual. Analise os arquivos gerados (ex: no diretório `coverage/`) para identificar os gaps exatos nos arquivos do Electron (Backend) e Componentes React.

### 1.2. Implementação de Testes de Mutantes (Stryker)
* **Objetivo:** Medir a qualidade dos testes existentes tentando "quebrar" o código fonte para ver se os testes falham.
* **Ferramenta:** Stryker Mutator.
* **Ação para o Agente:**
    1.  Instalar dependências: `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner`.
    2.  Criar o arquivo de configuração `stryker.config.json` na raiz do projeto apontando para o runner do Vitest e definindo as pastas alvo (`src/` e `electron/`).
    3.  Adicionar script no `package.json`: `"test:mutate": "stryker run"`.
    4.  Executar a primeira rodada para gerar o "Mutation Score" base.

---

## 🧩 Fase 2: Robustez dos Testes de Unidade

Com os gaps identificados pela Fase 1, gerar novos testes utilizando metodologias funcionais de Caixa Preta para os módulos de parsing de PDF, formatação de citações e lógicas de banco de dados (`better-sqlite3`).

### 2.1. Aplicação de Técnicas Funcionais
* **Ferramenta:** Vitest (existente).
* **Técnica 1: Particionamento de Equivalência**
    * *Agente:* Para funções que recebem parâmetros numéricos ou de string (ex: tamanho de arquivo PDF aceito, queries de busca de artigos), crie casos de teste para classes de entrada válidas e inválidas (arquivos corrompidos, formatos não suportados).
* **Técnica 2: Análise do Valor Limite**
    * *Agente:* Foque nas extremidades. Se o projeto pagina resultados de busca em blocos de 50, escreva testes exatos para cenários com 0, 1, 49, 50 e 51 artigos inseridos no banco.

---

## 🔗 Fase 3: Testes de Integração (Abordagem Bottom-Up)

Testar a comunicação entre os módulos internos do Electron e a Interface.

* **Estratégia:** Integração Bottom-Up.
* **Ação para o Agente:**
    1.  **Nível Base:** Testar integrações diretamente com o banco de dados (SQLite `better-sqlite3`) utilizando uma base de dados em memória (`:memory:`) para garantir que os esquemas (`schema.sql`) funcionam em conjunto com os Repositórios de dados.
    2.  **Nível Intermediário:** Testar a camada de IPC (Inter-Process Communication) do Electron. Criar testes que simulam o envio de mensagens do Frontend e validam a resposta do `handlers.ts` do main process.
    3.  **Nível Superior:** Utilizar o **React Testing Library** para criar testes de integração montando componentes pais (ex: `ArticleReaderPage`) que integram múltiplos contextos e hooks simultaneamente, "mockando" apenas os canais IPC estritamente necessários.

---

## 🚦 Fase 4: Testes de Desempenho (Comparativo Duplicado)

**Regra Estrita para o Agente:** Todo cenário de teste abaixo DEVE ser escrito duas vezes: uma vez em **k6** e uma vez em **Apache JMeter** (ou exportado como script `.jmx`).

### 4.1. Configuração do Comparativo
* **Ferramenta A:** `k6` (Instalação via SO / script).
* **Ferramenta B:** `Apache JMeter` (Geração do plano de teste `.jmx`).
* *Nota arquitetural:* Como Emma's Librarian é desktop, os testes focarão nos gargalos de I/O em background e processamento (simulação de chamadas massivas às APIs internas do app, simulando múltiplos workers do Node/Electron).

### 4.2. Cenários a serem implementados (em ambas as ferramentas):
1.  **Teste de Carga:** Simular a importação assíncrona e leitura de metadados de 50 PDFs simultaneamente.
2.  **Teste de Estresse:** Injetar requisições de parsing e inserções no SQLite até o limite de CPU/Memória do processo Node falhar ou degradar severamente.
3.  **Teste de Capacidade:** Identificar qual o teto máximo de artigos que a engine de busca de texto rápido suporta mantendo a resposta abaixo de 200ms.
4.  **Teste de Resistência (Soak Test):** Simular um uso contínuo da biblioteca (abrindo abas, lendopdfs, fechando, renderizando Markdown) ininterruptamente para checar *memory leaks* (vazamento de memória) na engine V8.
5.  **Teste de Volume:** Preencher o SQLite mockado com 100.000 registros bibliográficos e medir a performance das queries e do preenchimento das tabelas React (usando o `react-virtuoso` já presente no projeto).

---

## 🎭 Fase 5: Testes de Aceitação / E2E (Comparativo Duplicado)

Verificar se o aplicativo empacotado atende aos requisitos do usuário final interagindo com o DOM real montado pelo Electron.

**Regra Estrita para o Agente:** Os fluxos de usuário DEVEM ser automatizados em ambas as ferramentas abaixo para avaliação de DX (Developer Experience) e velocidade de execução.

### 5.1. Configuração do Comparativo
* **Ferramenta A:** **Playwright** (Configurado com seu plugin nativo experimental para Electron).
* **Ferramenta B:** **Selenium WebDriver** (Configurado utilizando o `chromedriver` compatível com a versão do Chromium embutida na versão do Electron definida no `package.json`).

### 5.2. Casos de Teste de Aceitação (A serem duplicados):
* **Fluxo 1 (Criação):** O usuário abre o app -> Clica em "Novo Projeto" -> Preenche detalhes -> Cria -> Verifica se foi redirecionado ao Dashboard.
* **Fluxo 2 (Adição e Leitura):** O usuário abre um projeto -> Realiza upload manual de uma referência -> Adiciona categorias usando o componente `CategoryCell` -> Clica no artigo -> Verifica se o Modal de Detalhes ou o Leitor abre com as informações corretas.
* **Fluxo 3 (Busca):** O usuário digita um termo complexo no `QueryBuilder` -> Aciona a busca -> Verifica se a tabela filtra e exibe os resultados esperados.

---

## 📊 Fase 6: Avaliação de Impacto e Comparativo Final

Após a implementação estrutural e a adição dos novos cenários de teste das Fases 2 a 5, é mandatório medir o ganho real de qualidade e robustez da aplicação.

* **Objetivo:** Quantificar a melhoria da suíte de testes comparando os índices atuais com a *baseline* (linha de base) extraída na Fase 1, gerando um artefato de comprovação.
* **Ação para o Agente:**
    1. **Re-executar Cobertura de Código:** Rode novamente o comando `npm run coverage`. Extraia as novas porcentagens de *Statement Coverage* (Comandos) e *Branch Coverage* (Desvios).
    2. **Re-executar Testes de Mutantes:** Rode novamente o comando de mutação configurado na Fase 1 (`npm run test:mutate`). Extraia o novo *Mutation Score* global.
    3. **Geração de Artefato (Relatório):** Crie um arquivo chamado `test_impact_report.md` na raiz do projeto (ou na pasta `/docs/relatorios`, se existir). Este documento **DEVE** conter:
        * Uma tabela clara de **"Antes vs. Depois"** para a Cobertura de Código (Statements e Branches).
        * Uma tabela clara de **"Antes vs. Depois"** para o *Mutation Score* (indicando quantos mutantes sobreviviam antes e quantos sobrevivem agora).
        * Uma breve análise de viabilidade e experiência do desenvolvedor (DX) baseada na implementação da Fase 4 (k6 vs. JMeter) e Fase 5 (Playwright vs. Selenium), indicando qual ferramenta performou melhor na realidade arquitetural do *Emma's Librarian*.

---

> **Agente:** Finalize salvando os resultados das integrações, scripts de teste de carga (pasta `/performance-tests`) e scripts de UI (pasta `/e2e-tests`). Certifique-se de não subir arquivos temporários ou relatórios grandes gerados por essas ferramentas. Atualize o `.gitignore` conforme necessário.