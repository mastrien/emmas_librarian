# Plano de Melhoria: Estratégia de Chunking para RAG

Este plano detalha as etapas para implementar a janela deslizante (*Sliding Window*) no processo de extração e vetorização de textos de PDFs, e como as configurações serão expostas ao usuário.

## 1. Objetivo
Mitigar a quebra de contexto no sistema RAG durante a Investigação Massiva, agrupando as linhas extraídas do PDF em parágrafos ou grandes blocos de texto (chunks) controlados por tamanho, mantendo uma sobreposição (overlap) de segurança para preservar conexões de frases longas.

## 2. Novas Configurações (Avançadas)
Adicionar três novos parâmetros na tabela `settings` e expô-los na interface (Página de Configurações -> Aba/Seção "Avançado"):
- **`rag_chunk_size`**: Tamanho alvo do trecho em caracteres. Padrão inicial: `1000`.
- **`rag_chunk_overlap`**: Tamanho da sobreposição entre trechos em caracteres. Padrão inicial: `200`.
- **`rag_top_k`**: Número de fragmentos mais similares que a IA irá ler ao extrair informações. Padrão inicial: `10` (no lugar do atual `3`).

## 3. Modificações no Backend

### A. Atualização do `PdfExtractor.ts`
- Modificar o fluxo de iteração dos `textContent.items`. Em vez de gerar um *chunk* por item, acumular os `str` em um buffer (uma janela).
- Quando o buffer atingir o tamanho definido por `rag_chunk_size`, salvar o chunk e deslizar a janela descartando o começo, mantendo o equivalente ao `rag_chunk_overlap` do final do buffer, e continuar a leitura.
- **Desafio Geométrico (Bounding Boxes)**: Como um chunk agregado agora terá várias linhas e possivelmente múltiplas partes do papel, o novo tipo de `PdfTextChunk` precisará suportar um array de `bboxes` ou fundir `bboxes` próximos em uma macro-caixa delimitadora.

### B. Atualização do `VectorStore.ts` e Serviços Relacionados
- Nenhuma alteração estrutural grande. O banco de dados já está pronto para receber os vetores independentemente do tamanho do chunk de texto.
- O limite máximo de tokens do `ollama` (nomic-embed-text) é amplo e deve suportar pedaços de 1000+ caracteres sem grandes estresses.

### C. Atualização do `AIService.ts`
- A função de `massiveExtraction` deverá ser alterada para:
  1. Ler as chaves `rag_top_k` do banco antes da busca.
  2. Fornecer o Top-K correspondente para o `searchSimilar`.
  3. Com isso o LLM receberá uma massa de contexto de aproximadamente `1000 * 10 = 10.000` caracteres (cerca de 5 a 6 páginas de contexto super focado por pergunta), em vez de fragmentos minúsculos.

## 4. Modificações no Frontend (Página Configurações)
- Adicionar no formulário de configuração um bloco `<Card>` ou painel colapsável ("Ajustes de Motor de IA e RAG").
- Campos:
  - Tamanho do Texto (`rag_chunk_size`)
  - Sobreposição (`rag_chunk_overlap`)
  - Fragmentos da Busca (`rag_top_k`)
- Salvar via IPC handlers já existentes de configurações genéricas (`app:getSettings` / `app:saveSettings` ou similares).

## 5. Validação
- Testar a reconstrução de artigos pré-existentes. O sistema precisará possivelmente apagar e re-processar ("Re-indexar") documentos de testes na base, pois os vetores antigos estão defasados.
- Checar se as bounding boxes em pedaços agrupados não ficam distorcidas quando a funcionalidade "Visualizar no PDF" for construída na Fase 4.
