# Relatório de Auditoria: Eficiência e Resiliência de Requisições HTTP

**Projeto**: `emmas_librarian`  
**Data**: 2026-08-05  
**Auditor**: Antigravity (Auditoria Exaustiva R3)

---

## 1. Escopo da Auditoria
Esta auditoria avaliou a infraestrutura de comunicação de rede do backend (Electron), focando especificamente nas chamadas `fetch` realizadas para serviços de terceiros (provedores de LLM e APIs de busca de artigos). 

Foi verificado que as requisições não implementam estratégias de resiliência recomendadas, podendo causar intertravamento da interface ou falhas silenciosas na extração em lote. Conforme as regras do projeto, os códigos *não foram modificados*, e este documento serve como base para uma futura refatoração manual ou assistida.

## 2. Pontos Críticos Encontrados

Foram identificadas **18 instâncias de chamadas `fetch` brutas** espalhadas pela camada de serviços, todas compartilhando vulnerabilidades fundamentais:

### 2.1. Omissão de Timeouts (Bloqueio Indefinido)
Nenhum dos provedores de IA ou integradores possui controle de tempo limite.
Se a API da OpenAI ou do Gemini congelar a conexão (sem fechar a porta), a promessa do `fetch` ficará pendente indefinidamente, travando o processo de extração de metadados ou a geração de embeddings do usuário.

**Locais Críticos:**
- `electron/services/AIService.ts`
- `electron/services/EmbeddingService.ts`
- `electron/services/llm/*` (Anthropic, Gemini, OllamaCloud, Ollama e OpenAI)

### 2.2. Inexistência de Política de Repetição (Retry / Backoff)
Chamadas para a rede estão sujeitas a falhas transientes, como o erro `429 Too Many Requests` (comum em extrações em lote de PDFs grandes) ou `502 Bad Gateway`. A aplicação falha instantaneamente no primeiro erro HTTP e repassa a exceção para o frontend.
Em `ApiIntegrator.ts` (buscas arXiv, PubMed, Crossref, etc), não há retentativas em falhas de rede de provedores sabidamente instáveis.

### 2.3 Falta de Circuit Breaker para LLMs em Massa
Na rotina de extração massiva (`AIService.ts`), múltiplas requisições são disparadas em sequência. Caso o limite de tokens da API estoure (429), a aplicação continua martelando a API, recebendo falhas repetidas em vez de pausar a extração (Circuit Breaker ou Backoff exponencial).

---

## 3. Recomendações de Refatoração

Para estabilizar o produto, as seguintes arquiteturas deverão ser implementadas:

1. **Implementar `AbortSignal.timeout(ms)`**: 
   - Adicionar limites rígidos de 30 a 60 segundos para LLMs (dependendo do prompt).
   - Adicionar limites de 10 segundos para requisições de busca no `ApiIntegrator`.
2. **Criar um Utilitário Centralizado de HTTP (`fetchWithRetry`)**:
   - Centralizar todas as requisições em uma única função utilitária em `electron/utils/httpClient.ts`.
   - Implementar *Exponential Backoff* (ex: espera 1s, depois 2s, depois 4s) antes de desistir definitivamente.
3. **Tratamento Específico de Rate Limits**:
   - Inspecionar cabeçalhos `Retry-After` nas respostas 429 e paralisar a fila automaticamente pelo tempo indicado pelo provedor.

*Status: Nenhuma chamada HTTP foi modificada durante esta auditoria. Aguardando decisão para implementar as refatorações sugeridas.*
