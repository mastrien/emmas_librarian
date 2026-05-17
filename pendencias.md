# Pontos Pendentes e Considerações Técnicas - Emma's Librarian

Este documento centraliza as questões técnicas e de negócio ainda em aberto, para guiar as atualizações do `ideia.md` e a formulação da arquitetura do projeto.

---

## 1. Stack Tecnológica (Frontend, Backend e Banco de Dados)
Como a aplicação será uma interface web executada localmente:
- **Linguagens/Frameworks:** Qual será a tecnologia do backend (ex: Node.js com TypeScript, ou Python com FastAPI)? E do frontend (React, Vue, HTML/JS puro)?
  - *Dica:* Python costuma ter bibliotecas bibliométricas excelentes, mas o ecossistema Node.js costuma facilitar a criação de interfaces locais via web/Electron.
- **Armazenamento (Banco de Dados):** Para suportar um volume alto de metadados, persistir anotações e lidar futuramente com PDFs locais de maneira robusta, utilizar **SQLite** seria ideal. O SQLite roda de forma leve, num único arquivo `.db` gerado na máquina do usuário, dispensando configurações ou instalação de servidores externos. Satisfeito com SQLite?

## 2. Estrutura Interna de Dados (O Formato Universal)
- Como precisaremos compatibilizar futuramente com o `biblioshiny` (que no momento de exportação exige padrões como BibTeX, RIS, etc), o sistema precisa de um padrão universal próprio.
- **Proposta:** Normalizar internamente todas as resopstas das APIs num formato único e completo utilizando a especificação do **CSL-JSON** (Citation Style Language JSON). Assim que a pesquisa for baixada no formato nativo (OpenAlex JSON / Crossref JSON), o sistema mapeia os campos para o CSL-JSON. Concorda com essa padronização primária para os dados brutos e manter as conversões complexas (RIS, BibTeX) exclusivamente no processo de exportação?

## 3. Lógica do Módulo de Query Normalizada
O tradutor de queries é o coração do projeto.
- **Interface e Construção da Query:** O usuário vai digitar as buscas de texto complexas usando uma "Linguagem Própria do Emma" (`title:"machine learning" AND year:>2020`) gerando assim a necessidade do nosso sistema ter uma gramática/parser léxico para traduzir nas sintaxes da base destino? Ou você prefere uma "Busca Avançada Visual" contendo blocos (combos) prontos de "AND/OR", "Título=", "Ano de publicação entre=", de onde nós extraímos as regras sem precisar analisar strings livremente escritas?

## 4. Gerenciamento de Limites e Paginação
- APIs como o OpenAlex e Crossref podem retornar desde 10 artigos até 2 milhões para determinados termos de busca. 
- **Volume:** Qual é comportamento esperado quando uma página de resultados tiver dezenas de milhares de itens? O sistema avisa o usuário do volume antes de começar a baixar? Ofereceremos opções como "Baixar apenas os primeiros X registros" ou o padrão é um processo agendado "deixe varrendo os servidores em background até acabar"?

## 5. Anotações e Exportação Complementar
- A ferramenta permitirá extrair não só as listas de referência (via `.ris`, `.bib`) mas também as **anotações escritas pelo usuário** no formato de relatório (ex: arquio `.csv` ou `.docx`), de modo que possam ser usadas ativamente na geração do paper final?

## 6. Sincronia e Atualização (Os "Projetos", embora não-prioritário)
- Apesar de não ser prioridade imediata, é bom prever: quando os dados em um projeto ficarem "desatualizados" na sua máquina, um processo de atualização de query irá puxar novos dados e *apenas* incluí-los junto aos atuais e marcá-los como "novo", gerando um fluxo de delta/incremental? O ideal seria sempre salvar a `string original da busca + o timestamp da última execução` associado ao Projeto criado.

## 7. Tratamento de Erros de APIs Externas (Limitação Temporária de Rede ou API)
- E se durante o processo de *fetch* a rede cair ou formos barrados pelo limite global da API rest/gratuita?
- Deveremos projetar uma fila local inteligente para as tarefas, ou seja, onde trabalhos que não finalizam na totalidade ganhem status "Interrompido", podendo ser re-iniciados pelo usuário exatamente na página onde pararam? 

---
*Anote por cima deste arquivo ou incremente diretamente as definições no seu `ideia.md` com base nessas questões!*
