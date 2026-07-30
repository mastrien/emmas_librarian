# Visão 10 — Caso de Uso: Adição e Leitura de PDF

> Dois fluxos complementares: (a) vincular um PDF a um artigo e (b) abrir e ler o PDF no leitor integrado.

## Fluxo A — Adição / Upload de PDF

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant PDP as ProjectDetailsPage
    participant API as api.ts
    participant PRE as preload.ts
    participant IPC as handlers.ts
    participant FS as File System (Node.js)
    participant DB as DatabaseManager

    User->>PDP: Clica em "Vincular PDF" no artigo
    PDP->>API: projectService.openPdfDialog()
    API->>PRE: invoke('dialog:openFile')
    PRE->>IPC: ipcMain handle
    IPC->>IPC: dialog.showOpenDialog({ filters: ['pdf'] })
    IPC-->>API: sourceFilePath (caminho selecionado)

    PDP->>API: projectService.uploadPdf(articleId, sourceFilePath)
    API->>PRE: invoke('pdf:upload', articleId, sourceFilePath)
    PRE->>IPC: ipcMain handle

    IPC->>FS: mkdirSync(userData/storage/pdfs/)
    IPC->>FS: copyFileSync(source → pdfs/{articleId}_{timestamp}.pdf)
    FS-->>IPC: arquivo copiado com sucesso

    IPC->>DB: updateArticleFilePath(articleId, destPath)
    DB-->>IPC: OK

    IPC-->>API: destPath
    API-->>PDP: destPath
    PDP->>PDP: Atualiza ícone visual (badge PDF vinculado)
```

## Fluxo B — Leitura de PDF no Leitor Integrado

```mermaid
sequenceDiagram
    actor User as 👤 Usuário
    participant PDP as ProjectDetailsPage
    participant Router as react-router
    participant ARP as ArticleReaderPage
    participant API as api.ts
    participant PRE as preload.ts
    participant IPC as handlers.ts
    participant FS as File System
    participant DB as DatabaseManager
    participant PDFJS as pdfjs-dist / PdfHighlighter

    User->>PDP: Clica no artigo com PDF
    PDP->>Router: navigate('/articles/:id')
    Router->>ARP: Renderiza ArticleReaderPage

    ARP->>API: projectService.getArticle(articleId)
    API->>PRE: invoke('articles:getOne', articleId)
    PRE->>IPC: ipcMain handle
    IPC->>DB: getArticle(articleId)
    DB-->>IPC: article (com local_file_path)
    IPC-->>API: article
    API-->>ARP: article

    ARP->>API: projectService.getPdfBuffer(articleId)
    API->>PRE: invoke('pdf:get', articleId)
    PRE->>IPC: ipcMain handle
    IPC->>FS: fs.readFileSync(article.local_file_path)
    FS-->>IPC: Buffer binário do PDF
    IPC-->>PRE: Buffer (serializado via IPC)
    PRE-->>API: ArrayBuffer
    API-->>ARP: ArrayBuffer

    ARP->>ARP: new Uint8Array(buffer)
    ARP->>PDFJS: Renderiza PDF com PdfHighlighter
    Note right of PDFJS: key={scale} força remontagem no zoom

    par Carrega dados persistidos
        ARP->>API: getHighlights(articleId)
        API-->>ARP: Highlight[] (position_data parseado)
        ARP->>API: getAnnotations(articleId)
        API-->>ARP: Annotation[]
        ARP->>API: getPendingHighlights(articleId)
        API-->>ARP: PendingHighlight[] (sugestões da IA)
    end

    ARP->>PDFJS: Aplica destaques e anotações no canvas

    opt Usuário cria novo destaque
        User->>PDFJS: Seleciona texto no PDF
        PDFJS->>ARP: onSelectionFinished(selection)
        ARP->>API: createHighlight(articleId, color, positionData, contentText, comment)
        API->>PRE: invoke('highlights:create', ...)
        PRE->>IPC: ipcMain handle
        IPC->>DB: saveHighlight(...) + saveAnnotation(...)
        DB-->>IPC: highlight id
        IPC-->>API: id
        ARP->>ARP: Re-renderiza destaques
    end

    opt Usuário cria anotação avulsa
        User->>ARP: Escreve anotação em Markdown
        ARP->>API: createAnnotation(articleId, content)
        API->>PRE: invoke('annotations:create', ...)
        PRE->>IPC: handle
        IPC->>DB: saveAnnotation(articleId, content)
        DB-->>IPC: annotation id
    end
```

## Detalhes Técnicos

| Aspecto | Detalhe |
|---|---|
| **Armazenamento de PDFs** | Copiados para `userData/storage/pdfs/{articleId}_{timestamp}.pdf` |
| **Transferência IPC** | Buffer binário serializado, reconstruído como `Uint8Array` no renderer |
| **Renderização** | `react-pdf-highlighter` + `pdfjs-dist` com worker local |
| **Zoom reativo** | `key={scale}` no `PdfHighlighter` força remontagem do React |
| **Destaques pendentes** | Criados pela IA na extração massiva, exibidos como sugestões |
| **Desvinculação** | `pdf:unlink` apaga arquivo físico + limpa `local_file_path` (preserva anotações) |
