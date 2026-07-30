# Análise do Sistema RAG Atual (Investigação Massiva)

Este documento detalha o fluxo de funcionamento do sistema RAG (Retrieval-Augmented Generation) utilizado na funcionalidade de Investigação Massiva do Emma's Librarian, servindo de base para o diagnóstico de problemas atuais e o planejamento de melhorias na Fase 4.

## Fluxo Atual de Funcionamento

O sistema RAG atual funciona através das seguintes etapas sequenciais quando uma Investigação Massiva é iniciada:

### 1. Extração de Texto (`PdfExtractor.ts`)
O backend utiliza a biblioteca `pdfjs-dist` para ler o PDF.
- A biblioteca percorre página por página e extrai os blocos de texto (`textContent.items`).
- **Problema Crítico de Fragmentação**: O código atual itera sobre a lista de itens de texto do PDF e cria um "chunk" (fragmento) no banco de dados para **cada item da array**. No PDF.js, um `item` muitas vezes não é um parágrafo inteiro, mas sim uma linha de texto solta ou até mesmo pedaços de palavras. 
- Assim, o sistema está gerando chunks minúsculos (ex: "O objetivo principal", "deste estudo é"), perdendo completamente a coesão e o contexto do texto original.

### 2. Geração de Embeddings (`EmbeddingService.ts`)
- O sistema percorre esses fragmentos microscópicos de texto e envia ao provedor configurado (Ollama/OpenAI/Gemini) para gerar vetores de "embeddings" (representação numérica do significado do texto).
- Por serem textos extremamente curtos e descontextualizados, os vetores gerados capturam significados muito limitados.

### 3. Indexação e Armazenamento (`VectorStore.ts`)
- Os "chunks" de texto e coordenadas (Bounding Boxes) são inseridos na tabela relacional `pdf_chunks`.
- Os "embeddings" são indexados e otimizados para busca vetorial na tabela virtual `pdf_chunk_embeddings`, gerida pela extensão `sqlite-vec`.

### 4. Recuperação (Retrieval) (`AIService.ts` > `massiveExtraction`)
Quando uma pergunta é iterada:
- A pergunta é vetorizada (gerando um novo embedding).
- O sistema executa uma busca de distância espacial (`vectorStore.searchSimilar`) comparando a pergunta contra o artigo.
- **Outro gargalo estrutural**: O código atual limita a busca aos **3 fragmentos mais similares** (`topK = 3`). Como cada fragmento equivale a meia frase ou uma linha isolada, a "memória" passada à IA no prompt equivale a menos de 5 segundos de leitura humana.

### 5. Síntese pela IA (Geração Módulo RAG)
O modelo de Inteligência Artificial final (Gemini, ChatGPT ou Ollama) recebe o seguinte prompt:
> "Baseado nos trechos do texto fornecidos, responda à pergunta..."

Como os trechos são desmembrados ("O objetivo prin-", "-cipal deste estudo", "apresentar métodos"), a IA:
1. Afirma que não há informação suficiente (*"não foi possível encontrar a partir dos trechos"*).
2. Tenta adivinhar de forma incorreta por conta de falhas na janela de contexto.

---

## Análise das Observações Levantadas

### 1. Avisos no Terminal do Node (`Warnings`)
1. **`Warning: Please use the legacy build in Node.js environments.`**
   - A biblioteca `pdfjs-dist` exibe este aviso no Node.js (Electron backend) pois está importando o build "moderno" primariamente focado para navegadores (Browser), em vez de sua versão `/legacy/build/pdf.js` específica para Node de certas versões.
2. **`Warning: TT: undefined function: 21`**
   - Este é um aviso inofensivo interno da engine da `pdf.js` associado ao parser de tipografias em fontes embutidas (*Truetype / TTF*). Em alguns arquivos PDFs com subconjuntos customizados de fontes, o parser emite esse aviso, mas o texto normalmente é extraído sem problemas.

### 2. Botão "Visualizar no Documento" Não Funcional
A interface de visualização do artigo no documento depende do repasse preciso de **Coordenadas Exatas (Bounding Boxes)** que o componente leitor de PDF consiga entender e pintar em amarelo. Embora a extração emita e armazene coordenadas base, a vinculação entre a evidência que a IA aponta no JSON gerado e a ativação remota do modal leitor (via estado de Redux ou contexto React) não foi finalizada ainda. O botão atualmente existe na UI como mockup pronto para ser programado na próxima fase, que seria a etapa de "Acoplamento Leitor-IA".

### 3. Respostas Incorretas ou com Ausência de Resposta (Problemas na Arquitetura Chunking)
A queixa de respostas evasivas ou incorretas provém diretamente dos Gargalos **1 (Fragmentação no Extrator)** e **4 (Limite de `topK`)**. O modelo de RAG em fase de produção não pode extrair fragmentos tão esparsos e curtos. Ele precisará de:
- **Estratégia de Chunking em Janelas / Sentenças (Sliding Window):** Juntar o texto em parágrafos de 500-1000 caracteres, mantendo sempre uns 100-200 caracteres se sobrepondo ao próximo chunk para nunca quebrar frases importantes pela metade.
- **Aumento do Espaço de Busca (`topK`):** Para modelos LLMs modernos, enviar 10 a 20 chunks grandes relevantes é fácil e barato e garante contexto massivo para a extração não falhar.
