Este é um plano de implementação de nível sênior projetado para elevar a arquitetura do **Emma's Librarian**. O plano aborda a transição de uma abordagem "força bruta com texto plano" para uma arquitetura modular, multimodal e baseada em RAG (Retrieval-Augmented Generation), maximizando a confiabilidade, a transparência e a flexibilidade.

---

### Fase 1: Decisões Arquiteturais e Infraestrutura

A atual classe `AIService` depende do `pdf-parse`, o que destrói o layout espacial do PDF e não suporta armazenamento vetorial.

#### 1. Banco de Dados Vetorial (Vector DB)

* **A Decisão:** Como o Emma's Librarian é uma aplicação Desktop (Electron) focada em privacidade e funcionamento offline (via Ollama), não podemos depender de bancos vetoriais em nuvem (Pinecone) ou que exijam Docker (Milvus).
* **A Escolha Ideal:** **LanceDB** ou a extensão **`sqlite-vec`**.
* Recomendo o **`sqlite-vec`** pois o projeto já utiliza o `DatabaseManager.ts` baseado em SQLite (via `better-sqlite3`). Adicionar a extensão vetorial permite guardar os *embeddings* (vetores dos parágrafos) no mesmo banco local do usuário, sem overhead.


* **Framework:** Utilizar o **LlamaIndex.TS** para lidar com o particionamento do PDF (Chunking) e orquestração do RAG.

#### 2. Extração Multimodal e Coordenadas

* Substituir o `pdf-parse` pelo **`pdfjs-dist`** (versão Node) ou **LlamaParse**. O objetivo é extrair texto associado às coordenadas `(X, Y)` e ao número da página. Isso elimina a falha atual de busca de strings (case-sensitive) e permite desenhar retângulos de destaque (bounding boxes) perfeitos no leitor de PDF.

---

### Fase 2: Granularidade de Modelos nas Configurações

Atualmente, o `AIService` tenta usar o primeiro modelo configurado em uma ordem fixa (OpenAI -> Gemini -> Ollama). Isso impede o uso de modelos eficientes para tarefas simples e modelos pesados para tarefas complexas.

**Modificação no Frontend (`SettingsPage.tsx`) e Banco de Dados (`schema.sql`):**
Criar um painel de "Configurações Avançadas de IA" onde o usuário mapeia um modelo para cada "Skill":

1. **Modelo de Metadados (VLM/Visão):** Ex: `gemini-2.5-flash` ou `llama3.2-vision` (Ollama). Tarefa rápida, modelo barato.
2. **Modelo de Resumos (Contexto Longo):** Ex: `gemini-1.5-pro` (janela de contexto gigante).
3. **Modelo RAG / Extração Massiva:** Ex: `gpt-4o` ou `claude-3.5-sonnet` (Alto QI lógico).
4. **Modelo de Embeddings:** Ex: `text-embedding-3-small` (OpenAI) ou `nomic-embed-text` (Ollama) para gerar os vetores.

*O Tradeoff:* A UI fica mais complexa, mas o usuário economiza dinheiro da API nas tarefas fáceis e ganha precisão máxima nas tarefas difíceis.

---

### Fase 3: Refatoração das Funcionalidades no `AIService.ts`

#### A. Extração de Metadados (`extractMetadataFromPdf`)

* **Como é:** Trunca 40k caracteres e pede JSON.
* **Como será:** O backend renderiza a página 1 e 2 do PDF como imagem (PNG/Base64). Envia para a API de Visão (VLM) selecionada nas configurações, utilizando *Structured Outputs* (Esquema JSON rigoroso) para garantir que não haja marcação Markdown a ser limpa.

#### B. Geração de Resumos (`generateSummary`)

* **Como é:** Trunca 80k caracteres e tenta fazer parse limpo.
* **Como será:** Substitui a requisição por um modelo configurado para contexto longo. Se o documento for maior que a janela do modelo (ex: LLMs locais), usa o LlamaIndex para fazer um *Map-Reduce Summary* (resume capítulos individualmente e depois faz um resumo final dos resumos). Também protegido por *Structured Outputs*.

#### C. Extração Massiva / Investigação (`massiveExtraction`)

* **O Novo Fluxo de Ingestão:** Quando o usuário importa o PDF, o backend não lê apenas texto. O LlamaIndex particiona o PDF em *chunks* de ~500 tokens. Cada chunk é vetorizado pelo modelo de Embeddings e salvo no SQLite (`sqlite-vec`) com os metadados visuais (`page`, `bbox`).
* **A Execução (Retrieval & Generation):** Para cada pergunta da extração massiva, o backend busca os "Top K=3" chunks mais similares no banco. O prompt final enviado ao modelo principal recebe apenas a pergunta e estes 3 chunks.

---

### Fase 4: Implementação do Frontend para Extração Massiva (RAG Transparency)

A interface deve abandonar o conceito de `contextBefore`/`contextAfter` e adotar um layout de "Cartões de Evidência".

#### Estrutura de Dados Retornada (Nova Interface TypeScript)

```typescript
interface RAGResponse {
  question: string;
  synthesized_answer: string;
  confidence_score: "ALTA" | "MÉDIA" | "BAIXA";
  evidences: Array<{
    id: number;
    text_snippet: string;
    metadata: {
      page: number;
      similarity_score: number; // 0 a 1, vindo do banco vetorial
      logprob_confidence?: number; // Certeza da IA na extração
      bounding_box?: { x: number, y: number, w: number, h: number };
      reasoning: string; // Explicação em Chain of Thought do porquê o trecho é relevante
    }
  }>;
}

```

#### Layout e Componentização React (Exemplo Conceitual)

No modal de resultados (`AIExtractionModal.tsx`), cada resposta seria renderizada assim:

```tsx
// JSX Conceitual de como renderizar o RAG no Emma's Librarian

<div className="rag-result-card bg-white p-6 rounded-lg shadow-sm border border-gray-200">
  {/* Cabeçalho */}
  <div className="header border-b pb-3 mb-4">
    <h3 className="text-lg font-semibold text-gray-800">
      Pergunta 1 - Qual a metodologia principal descrita no estudo?
    </h3>
    <p className="text-gray-700 mt-2 font-medium">
      <span className="text-blue-600 font-bold">Resposta da IA:</span> 
      "O estudo utilizou uma abordagem qualitativa de grupo focal, baseada em..."
    </p>
  </div>

  {/* Lista de Evidências */}
  <div className="evidences-container space-y-4">
    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
      Fontes e Transparência
    </h4>

    {/* Mapeamento das evidências (1/3, 2/3, 3/3) */}
    {data.evidences.map((evidence, index) => (
      <div key={evidence.id} className="evidence-item bg-gray-50 rounded p-4 border border-gray-100 flex flex-col relative">
        
        {/* Marcador de Numeração (Ex: 1/3) */}
        <div className="absolute top-4 right-4 text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">
          Evidência {index + 1}/{data.evidences.length}
        </div>

        {/* Trecho Bruto */}
        <blockquote className="text-sm italic text-gray-600 border-l-4 border-blue-400 pl-3 mb-3 pr-12">
          "{evidence.text_snippet}"
        </blockquote>

        {/* Metadados de Transparência */}
        <div className="metadata-grid grid grid-cols-2 gap-2 text-xs mt-2 bg-gray-100 p-2 rounded">
          <div className="flex items-center text-gray-600">
            <span className="font-semibold mr-1">📄 Página Original:</span> 
            {evidence.metadata.page}
          </div>
          <div className="flex items-center text-gray-600">
            <span className="font-semibold mr-1">🎯 Confiança Semântica:</span> 
            <span className={evidence.metadata.similarity_score > 0.85 ? 'text-green-600' : 'text-yellow-600'}>
              {(evidence.metadata.similarity_score * 100).toFixed(1)}% (Vector DB)
            </span>
          </div>
          <div className="col-span-2 text-gray-500 mt-1">
            <span className="font-semibold mr-1">🧠 Raciocínio da IA:</span>
            {evidence.metadata.reasoning}
          </div>
        </div>

        {/* Botão de Ação que interage com o Leitor de PDF do Electron */}
        <button 
           onClick={() => goToPdfPage(evidence.metadata.page, evidence.metadata.bounding_box)}
           className="mt-3 text-xs bg-white border border-gray-300 hover:bg-gray-50 py-1.5 px-3 rounded shadow-sm w-max transition">
           👁️ Visualizar no Documento Original
        </button>
      </div>
    ))}
  </div>
</div>

```

### Resumo do Impacto

Essa refatoração transforma um fluxo experimental de IA em uma **ferramenta de auditoria científica de nível empresarial**. O usuário não precisa mais confiar cegamente no modelo. Ele tem acesso não apenas à resposta, mas ao raciocínio (CoT), ao grau matemático de confiança do banco de dados (Similaridade) e um link direto para a coordenada exata no PDF, permitindo um atrito zero para o cientista verificar a veracidade da extração. A configuração por modelos também otimiza o uso do `AIService`, combinando o ecossistema local do usuário com o poder da nuvem apenas quando necessário.