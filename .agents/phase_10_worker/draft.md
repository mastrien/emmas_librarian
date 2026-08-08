# Fase 10: Provedores IA Cloud & Transição do Motor de Vetorização Local para ONNX/WASM

**Posição**: Fase 10 (Commits 170 a 182)  
**Intervalo de Commits**: `74f51f0` ao `0d80939`  
**Período de Desenvolvimento**: 04/08/2026 a 05/08/2026  
**Autoria**: João Pedro V  

---

## 1. Resumo Executivo

A **Fase 10 (Commits 170 a 182)** consolida o ecossistema de Inteligência Artificial e Busca Semântica (RAG - *Retrieval-Augmented Generation*) do `emmas_librarian`, modernizando a conectividade com serviços de IA na nuvem e realizando um pivô arquitetural decisivo na vetorização local de artigos acadêmicos.

Durante esta fase, a arquitetura evoluiu em três frentes principais:
1. **Conectividade Cloud Expandida (`ollama_cloud`)**: Implementação do `OllamaCloudGateway`, viabilizando o uso de modelos remotos de larga escala hospedados na nuvem via autenticação Bearer Token e protocolo compatível com OpenAI. O gateway inclui auto-migração de URLs legadas (`api.ollama.cloud` para `https://ollama.com/v1`) e sanitização rigorosa de payloads de erro retornados em formato HTML por servidores de borda.
2. **Resiliência e Vetorização em Lote (Gemini Embeddings)**: Atualização do `EmbeddingService` para suportar o endpoint em lote `batchEmbedContents` da API Google Gemini, reduzindo drasticamente o *overhead* de rede no processamento de grandes acervos acadêmicos. Foi introduzido um mecanismo de *exponential backoff* (`fetchWithRetry`) para contornar automaticamente os limites de taxa (HTTP 429 / Resource Exhausted).
3. **Pivô Tecnológico da Vetorização Local (Llama.cpp vs. ONNX/WASM)**: Inicialmente, tentou-se implementar um processo *sidecar* baseado no binário compilado `llama.cpp` (`LlamaServerManager` e `LlamaDownloader`) para execução de modelos no formato `.gguf`. No entanto, devido à complexidade de distribuição, dependência de binários compilados por plataforma e consumo elevado de recursos, a arquitetura foi reformulada. O sistema migrou definitivamente para o motor **ONNX / WebAssembly** via pacote `@xenova/transformers` (modelo `Xenova/all-MiniLM-L6-v2`). Essa solução garantiu um motor de vetorização local com **zero configuração**, empacotado diretamente no ambiente Node.js/Electron, sem necessidade de *downloads* binários externos e funcionando 100% offline.

---

## 2. Detalhamento Profundo

### 2.1. Decisões de Engenharia & Racional Arquitetural

#### Decisão 1: Arquitetura do Gateway Ollama Cloud & Sanitização de Proxies Remotos (Commits 170–172)
- **Problema**: O suporte prévio ao Ollama era limitado a instâncias locais (`http://localhost:11434`). Usuários corporativos e pesquisadores necessitavam acessar modelos de maior porte hospedados em instâncias de nuvem (`ollama_cloud`), que exigem autenticação por token Bearer e seguem a especificação OpenAI Chat Completions. Além disso, erros de proxy/reverse-proxy costumavam retornar páginas HTML cruas (ex: 502 Bad Gateway ou 403 Forbidden), quebrando o *parser* JSON e ocultando o motivo real da falha.
- **Solução**:
  - Criação da classe `OllamaCloudGateway` implementando a interface `LLMProviderGateway`.
  - Injeção do cabeçalho `Authorization: Bearer <apiKey>` nas requisições POST para `/chat/completions`.
  - Método privado `sanitizeHtml(text: string)` para remover tags HTML via expressão regular (`/<[^>]*>?/gm`) e extrair mensagens de erro legíveis para o usuário.
  - No commit `172`, foi inserida uma regra de sanitização de URL que reescreve automaticamente os endereços legados no formato `api.ollama.cloud` para a URL oficial padronizada `https://ollama.com/v1`.

#### Decisão 2: Otimização do Gemini Embeddings com Batching e Backoff Exponencial (Commit 174)
- **Problema**: Ao gerar *embeddings* para centenas de parágrafos/artigos utilizando a API gratuita do Google Gemini, a emissão de requisições individuais excedia rapidamente a cota de 100 requisições por minuto (RPM), gerando erros de limite de taxa (HTTP 429 / `RESOURCE_EXHAUSTED`).
- **Solução**:
  - Transição do método individual `:embedContent` para a API de lote `:batchEmbedContents` no `EmbeddingService.ts`, agrupando os textos em blocos de até 50 elementos por requisição.
  - Criação do método utilitário `fetchWithRetry<T>()` em `EmbeddingService`, realizando até 3 tentativas automáticas com atrasos exponenciais duplicados (`initialDelayMs = 2000`, 4000ms, 8000ms) quando detectado erro de cota (HTTP 429 ou código `ERR_API_QUOTA_EXCEEDED`).
  - Tratamento e remoção do prefixo `models/` na propriedade `model_name` para evitar duplicidade de caminho no endpoint REST da Google API (`models/models/text-embedding-004`).

#### Decisão 3: Pivô Tecnológico do Motor Local de Embeddings — De Llama.cpp Sidecar para ONNX Runtime em JS/WASM (Commits 176–182)
- **O Experimento Llama.cpp (Commits 176–179)**:
  - Nos commits 176 a 179, a equipe construiu uma infraestrutura baseada no `llama.cpp`: os componentes `LlamaServerManager.ts` (para gerenciamento de subprocesso e ciclo de vida do servidor HTTP local em portas dinâmicas) e `LlamaDownloader.ts` (para download transparente do executável `llama-server.exe` e do modelo `.gguf`).
  - *Fatores de Rejeição*: A abordagem exigia o download de dezenas/centenas de megabytes de binários nativos específicos por sistema operacional (Windows/macOS/Linux), apresentava alto risco de bloqueio por antivírus e demandava a gestão complexa de processos *sidecar* no Electron.
- **A Solução Definitiva ONNX (`@xenova/transformers`) (Commits 180–182)**:
  - No commit 180, integrou-se o pacote `@xenova/transformers`, que utiliza a biblioteca ONNX Runtime compilada para WebAssembly/JavaScript.
  - No commit 181, padronizou-se o provedor local de embeddings para utilizar o pipeline `'feature-extraction'` com o modelo quantizado ultraleve `Xenova/all-MiniLM-L6-v2` (~23MB).
  - O motor é carregado sob demanda via `import('@xenova/transformers')` e mantido em memória estática em `EmbeddingService.transformerExtractor`. A extração do vetor utiliza *mean pooling* e normalização vetorial (`pooling: 'mean', normalize: true`).
  - No commit 182, a opção obsoleta `llama_cpp` foi completamente removida da interface de configurações (`SettingsPage.tsx`), consolidando a experiência do usuário sob o rótulo "Local Embutido (ONNX)".

#### Decisão 4: Aprimoramento da Interface de Configurações e UX de Provedores AI (Commits 173, 175)
- **Sugestões de Modelo em 1-Clique**: Adicionou-se a função `getModelSuggestions(skill, provider)` na `SettingsPage.tsx`, oferecendo botões rápidos para preenchimento de modelos populares (ex: `all-MiniLM-L6-v2`, `text-embedding-004`, `gpt-4o-mini`, `gemini-2.5-flash`).
- **Avisos Orientativos**: Inclusão de banners explicativos informando que a funcionalidade de *Embeddings* tem melhor desempenho e privacidade utilizando o motor "Local Embutido (ONNX)" ou instâncias dedicadas.

---

### 2.2. Diagrama de Arquitetura & Fluxo da Híbrida de IA

O diagrama abaixo ilustra o fluxo de roteamento de solicitações de IA e o pivô arquitetural realizado no motor de vetorização local:

```mermaid
flowchart TD
    subgraph Frontend["Interface do Usuário (React / SettingsPage & SearchPage)"]
        UI_Config["Configuração de Provedores AI & Embeddings"]
        UI_Search["Busca Semântica & RAG (ArticleSearch)"]
    end

    subgraph IPC["Camada IPC Electron"]
        IPC_AI["ipcRegistries / AIService"]
    end

    subgraph ServiceLayer["Serviços de IA & Vetorização (electron/services)"]
        LLM_Gateways{"LLM Gateway Factory"}
        Cloud_Ollama["OllamaCloudGateway\n(Bearer Token / OpenAI API Format)"]
        Cloud_Gemini["GeminiGateway & EmbeddingService\n(batchEmbedContents + Backoff Retry 429)"]
        Cloud_OpenAI["OpenAIGateway / Embeddings"]
        Cloud_Anthropic["AnthropicGateway"]
        
        EmbService{"EmbeddingService"}
        
        subgraph LocalPivoting["Evolução da Arquitetura Local (Pivô Tecnológico)"]
            Sidecar_Legacy["[Descontinuado - Commits 176-179]\nLlamaServerManager & LlamaDownloader\n(Sidecar Binário C++ & Modelos GGUF)"]
            Engine_ONNX["[Definitivo - Commits 180-182]\nMotor ONNX / WebAssembly\n(@xenova/transformers)\nModelo: Xenova/all-MiniLM-L6-v2"]
        end
    end

    UI_Config -->|Atualiza AIModelConfig| IPC_AI
    UI_Search -->|Solicita Embedding / Prompt| IPC_AI
    IPC_AI --> LLM_Gateways
    IPC_AI --> EmbService

    LLM_Gateways -->|Provider = ollama_cloud| Cloud_Ollama
    LLM_Gateways -->|Provider = gemini| Cloud_Gemini
    LLM_Gateways -->|Provider = openai| Cloud_OpenAI
    LLM_Gateways -->|Provider = anthropic| Cloud_Anthropic

    EmbService -->|Provider = local / ONNX| Engine_ONNX
    EmbService -.->|Provider = llama_cpp (Substituído)| Sidecar_Legacy
```

---

### 2.3. Tabela de Estrutura de Diretórios e Arquivos Alterados

A tabela a seguir apresenta os arquivos criados ou modificados na Fase 10 e suas respectivas responsabilidades no sistema:

| Caminho do Arquivo | Status | Finalidade e Responsabilidade Arquitetural |
|---|---|---|
| `electron/services/llm/OllamaCloudGateway.ts` | **Criado** (Commit 170) | Gateway de comunicação com a nuvem do Ollama via protocolo HTTP Bearer Token e sanitização de respostas HTML. |
| `electron/services/llm/__tests__/OllamaCloudGateway.test.ts` | **Criado** (Commit 170) | Suíte de testes unitários TDD validando autenticação, parsing de respostas e tratamento de erros HTTP no Ollama Cloud. |
| `electron/services/EmbeddingService.ts` | **Modificado** (Commits 172–181) | Motor central de geração de *embeddings*. Integra suporte a ONNX (`@xenova/transformers`), lote no Gemini (`batchEmbedContents`), retentativas com backoff e Ollama Cloud. |
| `electron/services/LlamaServerManager.ts` | **Criado/Refatorado** (Commits 176–178) | *Sidecar manager* desenvolvido para controlar o processo binário `llama-server.exe` (substituído pelo ONNX no commit 180). |
| `electron/services/LlamaDownloader.ts` | **Criado** (Commit 179) | Gerenciador de download transparente de binários e modelos GGUF (tornado obsoleto pelo ONNX). |
| `src/pages/SettingsPage.tsx` | **Modificado** (Commits 171–182) | Interface gráfica de configurações. Adiciona campos para Ollama Cloud, sugestões de modelo de 1-clique, avisos de desempenho e seleção de provedor ONNX. |
| `package.json` | **Modificado** (Commit 180) | Adição da dependência `@xenova/transformers` para vetorização ONNX/WASM no ambiente Node/Electron. |

---

### 2.4. Trechos de Código Principais (Extraídos dos Diffs)

#### Trecho 1: Implementação do `OllamaCloudGateway.ts` (Commit `74f51f0` / `c54ad5a`)
Demostra a autenticação via token Bearer, chamada ao endpoint compatível com OpenAI e sanitização de mensagens de erro formatadas em HTML.

```typescript
export class OllamaCloudGateway implements LLMProviderGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async complete(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Chave de API do Ollama Cloud não configurada.');
    }

    const endpoint = this.buildEndpointUrl();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-oss:120b-cloud',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new AppError('ERR_API_QUOTA_EXCEEDED', 'SYSTEM_ERROR', 'QUOTA_EXCEEDED');
      }
      const rawText = await response.text();
      const cleanText = this.sanitizeHtml(rawText);
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          'ERR_API_UNAUTHORIZED',
          'USER_ERROR',
          `[ERR_API_UNAUTHORIZED] Credenciais do Ollama Cloud inválidas (HTTP ${response.status}): ${cleanText}`,
        );
      }
      throw new AppError(
        'ERR_API_CONNECTION',
        'SYSTEM_ERROR',
        `[ERR_API_CONNECTION] Erro no serviço Ollama Cloud (HTTP ${response.status}): ${cleanText}`,
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? data.content;
    return content;
  }

  private sanitizeHtml(text: string): string {
    if (!text) return 'Nenhum detalhe retornado pelo servidor.';
    const clean = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    return clean || 'Serviço indisponível no provedor remoto.';
  }
}
```

#### Trecho 2: Batching e Backoff Exponencial para Gemini em `EmbeddingService.ts` (Commit `91a21f5`)
Ilustra a lógica de retentativa para HTTP 429 (`fetchWithRetry`) e o agrupamento em lote via `:batchEmbedContents`.

```typescript
private async fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelayMs = 2000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isQuotaErr =
        err?.code === 'ERR_API_QUOTA_EXCEEDED' ||
        (err?.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')));

      if (isQuotaErr && attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.warn(
          `[EmbeddingService] Quota 429/Resource Exhausted detectada. Aguardando ${delay}ms para tentativa ${attempt + 2}/${maxRetries}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Execução em lote (batchEmbedContents)
if (this.config.provider === 'gemini') {
  const BATCH_SIZE = 50;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + BATCH_SIZE);
    const requestsPayload = batchTexts.map((txt) => ({
      model: fullModel,
      content: { parts: [{ text: txt }] },
    }));

    const batchEmbeddings = await this.fetchWithRetry(async () => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fullModel}:batchEmbedContents?key=${this.keys.gemini}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: requestsPayload }),
        },
      );
      const data = await response.json();
      return data.embeddings.map((item: any) => item.values as number[]);
    });

    allEmbeddings.push(...batchEmbeddings);
  }
  return allEmbeddings;
}
```

#### Trecho 3: Motor de Vetorização Local ONNX em `EmbeddingService.ts` (Commit `8bd5b20`)
Apresenta o carregamento dinâmico do `@xenova/transformers` e a extração vetorial usando o modelo `Xenova/all-MiniLM-L6-v2`.

```typescript
if (this.config.provider === 'local' || this.config.provider === 'llama_cpp') {
  try {
    const { pipeline } = await import('@xenova/transformers');
    if (!EmbeddingService.transformerExtractor) {
      console.log('[EmbeddingService] Inicializando motor local de vetorização ONNX (Xenova/all-MiniLM-L6-v2)...');
      EmbeddingService.transformerExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const output = await EmbeddingService.transformerExtractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data) as number[];
  } catch (err: any) {
    throw new AppError(
      'ERR_API_CONNECTION',
      'SYSTEM_ERROR',
      `[ERR_API_CONNECTION] Erro no motor local de vetorização ONNX (@xenova/transformers): ${err.message || String(err)}`,
    );
  }
}
```

---

## 3. Tabela Completa de Commits da Fase 10 (170 ao 182)

| # | Hash | Data | Autor | Mensagem do Commit (*Subject*) | Escopo / Componentes Principais |
|---|---|---|---|---|---|
| 170 | `74f51f0` | 2026-08-04 | João Pedro V | feat(llm): add ollama_cloud provider support with Bearer token authentication and TDD tests | `OllamaCloudGateway.ts`, `OllamaCloudGateway.test.ts` |
| 171 | `c54ad5a` | 2026-08-04 | João Pedro V | fix(ui/llm): simplify Ollama Cloud UI, sanitize HTML proxy errors, and improve AppError handling | `SettingsPage.tsx`, `OllamaCloudGateway.ts` |
| 172 | `8460a3f` | 2026-08-04 | João Pedro V | fix(llm): auto migrate legacy api.ollama.cloud URLs to https://ollama.com/v1 | `OllamaCloudGateway.ts`, `EmbeddingService.ts` |
| 173 | `936d27d` | 2026-08-04 | João Pedro V | feat(ui): add 1-click model suggestions and provider auto-fill for embeddings in SettingsPage | `SettingsPage.tsx` |
| 174 | `91a21f5` | 2026-08-04 | João Pedro V | fix(embeddings): add Gemini batchEmbedContents, auto retries for 429 rate limits, and model name sanitization | `EmbeddingService.ts` |
| 175 | `d99b703` | 2026-08-04 | João Pedro V | docs(ui): add recommendation notice stating embeddings currently perform best with local Ollama | `SettingsPage.tsx` |
| 176 | `e554ed7` | 2026-08-04 | João Pedro V | feat(embeddings): integrate local embedded llama.cpp provider (llama_cpp) and LlamaServerManager sidecar | `LlamaServerManager.ts`, `EmbeddingService.ts` |
| 177 | `e6b4515` | 2026-08-04 | João Pedro V | fix(ipc/embeddings): handle raw fetch failed exceptions as AppError('ERR_API_CONNECTION') | `EmbeddingService.ts`, `errorHandler.ts` |
| 178 | `30d88fe` | 2026-08-04 | João Pedro V | feat(llmacpp): add models/ and bin/ directory resolution with download README instructions | `LlamaServerManager.ts` |
| 179 | `abab3c6` | 2026-08-05 | João Pedro V | feat(llmacpp): add transparent auto-downloader (LlamaDownloader) for GGUF model and server binary | `LlamaDownloader.ts` |
| 180 | `e779c69` | 2026-08-05 | João Pedro V | feat(embeddings): integrate zero-setup local ONNX fallback engine (@xenova/transformers) | `EmbeddingService.ts`, `package.json` |
| 181 | `8bd5b20` | 2026-08-05 | João Pedro V | refactor(embeddings): standardize local embedded provider to primary ONNX engine (Local Embutido ONNX) | `EmbeddingService.ts` |
| 182 | `0d80939` | 2026-08-05 | João Pedro V | fix(settings): remove obsolete llama_cpp option from provider select dropdown | `SettingsPage.tsx` |

---

## 4. Conclusão da Fase

A Fase 10 representou o ápice da maturidade do ecossistema de IA do `emmas_librarian`. A escolha de aposentar o *sidecar* `llama.cpp` em favor do motor **ONNX / WebAssembly** (`@xenova/transformers`) exemplifica uma excelente decisão de arquitetura pragmática: trocou-se uma solução com alta complexidade operacional e *downloads* pesados por um motor leve embutido no Node.js/Electron, capaz de gerar *embeddings* locais em tempo real com zero configuração para o usuário final. Paralelamente, o suporte a `ollama_cloud` e as otimizações de *batching* e retentativas exponenciais para a API do Google Gemini garantiram robustez de classe empresarial às operações em nuvem.
