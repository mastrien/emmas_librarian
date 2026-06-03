# Visão 12 — Stack Tecnológico (Tech Stack Map)

> Ecossistema de dependências externas e bibliotecas-chave do projeto.

## Diagrama

```mermaid
mindmap
  root((Emma's Librarian))
    Runtime
      Electron 41.x
        Main Process - Node.js
        Renderer Process - Chromium
        electron-log
        electron-updater
      React 19.x
        react-dom
        react-router-dom 7.x
        react-pdf-highlighter
        react-chartjs-2
        react-markdown
        react-virtuoso
      TypeScript 6.x
    Banco de Dados
      better-sqlite3
        SQLite local
        schema.sql - 11 tabelas
    PDF
      pdfjs-dist 4.x
        Worker local
      pdf-parse 2.x
        Extração de texto
    IA
      OpenAI - gpt-4o-mini
      Gemini - gemini-2.5-flash
      Ollama - Local LLM
    Rede
      axios
      fetch - Node native
    Exportação
      xlsx
      citation-js
    UI e Estilos
      lucide-react - Ícones
      prismjs - Syntax highlighting
      chart.js - Gráficos
      remark-gfm - Markdown GFM
      MDX Editor
    Utilitários
      uuid
      lodash
      adm-zip
      open
    Build
      Vite 8.x
      vitejs plugin-react
      electron-builder
      concurrently
      wait-on
    Testes
      Vitest 3.x
      Testing Library
        react
        jest-dom
        dom
      jsdom
      vitest coverage-v8
    Qualidade
      ESLint 8.x
      Prettier 3.x
      Husky
```

## Tabela de Dependências Principais

| Categoria | Biblioteca | Versão | Finalidade |
|---|---|---|---|
| **Core** | Electron | 41.7.1 | Desktop app framework |
| **Core** | React | 19.2.6 | UI framework |
| **Core** | TypeScript | 6.0.2 | Type safety |
| **Core** | Vite | 8.0.12 | Bundler e dev server |
| **Dados** | better-sqlite3 | 12.10.0 | Banco SQLite embutido |
| **PDF** | pdfjs-dist | 4.4.168 | Renderização de PDF |
| **PDF** | pdf-parse | 2.4.5 | Extração de texto de PDF |
| **PDF** | react-pdf-highlighter | 7.0.0 | Destaques e anotações em PDF |
| **Rede** | axios | 1.16.1 | HTTP client |
| **UI** | lucide-react | 1.16.0 | Biblioteca de ícones |
| **UI** | chart.js | 4.5.1 | Gráficos bibliométricos |
| **Exportação** | xlsx | 0.18.5 | Geração de planilhas |
| **Exportação** | citation-js | 0.7.22 | Formatação de citações |
| **Editor** | @mdxeditor/editor | 4.0.0 | Editor Markdown rico |
| **Build** | electron-builder | 26.8.1 | Empacotamento e distribuição |
| **Atualização** | electron-updater | 6.8.3 | Auto-update via GitHub Releases |
| **Testes** | vitest | 3.0.0 | Test runner |
