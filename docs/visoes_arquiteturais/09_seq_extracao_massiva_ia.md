# Visão 9 — Caso de Uso: Extração Massiva de IA (Investigação em Massa)

> Diagrama de sequência do fluxo de extração de dados estruturados via IA para múltiplos artigos.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant PDP as ProjectDetailsPage
    participant Modal as AIExtractionModal
    participant API as api.ts (projectService)
    participant PRE as preload.ts
    participant IPC as handlers.ts
    participant AIS as AIService
    participant DB as DatabaseManager
    participant PDF as pdf-parse
    participant LLM as 🤖 LLM API (OpenAI / Gemini / Ollama)

    User->>PDP: Seleciona artigos com PDF
    User->>PDP: Abre AIExtractionModal
    PDP->>Modal: Renderiza modal

    User->>Modal: Define perguntas de extração
    User->>Modal: Clica em "Iniciar Extração"

    loop Para cada artigo selecionado
        Modal->>API: projectService.massiveExtraction(articleId, questions)
        API->>PRE: invoke('ai:massiveExtraction', articleId, questions)
        PRE->>IPC: ipcMain handle

        IPC->>DB: db.getArticle(articleId)
        DB-->>IPC: article (com local_file_path)

        alt PDF encontrado
            IPC->>AIS: massiveExtraction(articleId, pdfPath, questions)

            AIS->>PDF: extractTextFromPdf(pdfPath)
            Note right of PDF: fs.readFileSync → PDFParse → getText()
            PDF-->>AIS: texto bruto do PDF

            AIS->>AIS: Trunca texto a 80.000 chars (~20k tokens)
            AIS->>AIS: Monta prompt com perguntas numeradas

            Note over AIS: generateCompletion() prioriza: OpenAI → Gemini → Ollama
            AIS->>DB: getKeys() → recupera API keys do banco
            DB-->>AIS: { openai, gemini, ollama, ollamaModel }

            alt OpenAI configurado
                AIS->>LLM: POST api.openai.com/v1/chat/completions
                Note right of LLM: model: gpt-4o-mini, temperature: 0.2
            else Gemini configurado
                AIS->>LLM: POST generativelanguage.googleapis.com/.../generateContent
                Note right of LLM: model: gemini-2.5-flash
            else Ollama configurado
                AIS->>LLM: POST {baseUrl}/chat/completions
                Note right of LLM: model: configurado pelo usuário
            end

            LLM-->>AIS: JSON array com { question, answer, quote, contextBefore, contextAfter }

            AIS->>AIS: JSON.parse(resultado)

            loop Para cada resposta com quote
                AIS->>DB: savePendingHighlight(articleId, quote, contextBefore, contextAfter, answer)
            end

            AIS-->>IPC: parsed results array
        else PDF não encontrado
            IPC-->>API: throw Error("PDF not found")
        end

        IPC-->>API: extraction results
        API-->>Modal: resultados para este artigo
        Modal->>Modal: Atualiza progresso incremental
    end

    Modal->>API: projectService.saveMassiveInvestigation(projectId, questions, articleIds, model, status)
    API->>PRE: invoke('massiveInvestigations:save', ...)
    PRE->>IPC: ipcMain handle
    IPC->>DB: saveMassiveInvestigation(...)
    DB-->>IPC: investigation id

    Modal->>Modal: Exibe resultados formatados com respostas e citações
```

## Detalhes Técnicos

| Aspecto | Detalhe |
|---|---|
| **Extração de texto** | `pdf-parse` lê o buffer e extrai texto plano |
| **Limite de contexto** | Truncado em 80.000 chars (~20k tokens) |
| **Prioridade de LLM** | OpenAI → Gemini → Ollama (primeiro configurado) |
| **Formato de resposta** | JSON array com `question`, `answer`, `quote`, `contextBefore`, `contextAfter` |
| **Pending Highlights** | Citações extraídas são salvas como destaques pendentes para ancoragem visual no PDF |
| **Histórico** | Cada execução é registrada em `massive_investigations` |
