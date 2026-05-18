# Plano de Implementação MVP - Emma's Librarian

Este documento detalha as etapas para a construção do Mínimo Produto Viável (MVP) do Emma's Librarian, integrando as decisões técnicas e funcionais estabelecidas.

## 1. Visão Geral da Arquitetura

- **Modelo de Operação:** Servidor Local + Interface Web (Acessada via Navegador).
- **Backend:** Python (FastAPI). Escolhido pela facilidade de manipulação de dados científicos e bibliotecas bibliométricas.
- **Frontend:** React (TypeScript). Necessário para gerenciar a complexidade do construtor de queries visual e a integração com `react-pdf-highlighter`.
- **Banco de Dados:** SQLite3. Persistência em arquivo local `.db`.
- **Formato de Dados Interno:** CSL-JSON (Citation Style Language) para normalização.

## 2. Estrutura do Banco de Dados (SQLite)

- **Projetos:** `id, nome, query_original, data_criacao, ultima_execucao`.
- **Artigos:** `id, projeto_id, doi, titulo, autores, ano, base_origem (JSON list), csl_json (raw content), status (novo/lido/arquivado)`.
- **Anotações:** `id, artigo_id, conteudo_markdown, data_criacao`.
- **Highlights:** `id, artigo_id, color, position_data (JSON), annotation_id`.

## 3. Fases de Desenvolvimento

### Fase 1: Fundação e Busca (O "Coração")
- [ ] Setup do projeto FastAPI e Banco de Dados SQLite.
- [ ] Implementação do módulo de tradução de Query (Blocos Visuais -> Sintaxe OpenAlex/Crossref).
- [ ] Integração com API OpenAlex (v1).
- [ ] Integração com API Crossref (v1).
- [ ] Lógica de Desduplicação (baseada em DOI/Título).

### Fase 2: Interface e Listagem
- [ ] Setup do projeto React.
- [ ] UI de "Novo Projeto" com o Construtor de Query Visual.
- [ ] Tela de resultados (Tabela) com filtros básicos.
- [ ] Persistência dos resultados da busca no SQLite.

### Fase 3: Leitura e Anotação
- [ ] Implementação do Leitor de PDF local integrado.
- [ ] Integração do `react-pdf-highlighter`.
- [ ] Persistência de Destaques (Highlight) e Notas (Markdown) vinculadas.
- [ ] Gerenciamento de arquivos PDF (Download automático opcional ou link local).

### Fase 4: Refinamento e Exportação
- [ ] Exportação básica para CSV (Metadados + Anotações).
- [ ] Interface para gerenciamento de chaves de API do usuário.
- [ ] Tratamento de erros de conexão e limites de taxa (Rate Limit).

## 4. Diferenciais Técnicos do MVP

1. **Privacidade Total:** Nenhum dado de pesquisa sai da máquina do usuário.
2. **Normalização CSL-JSON:** Facilita futuras integrações com Biblioshiny, Zotero e Mendeley.
3. **Persistência de Contexto:** O usuário não apenas salva o artigo, mas o "momento" da leitura (highlights).

## 5. Próximos Passos Imediatos
1. Definir o esquema detalhado das tabelas do SQLite.
2. Criar os endpoints básicos de busca (Search Proxy).
3. Iniciar o protótipo do Construtor de Query Visual no React.
