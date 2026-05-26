# Relatório de Auditoria: Qualidade do Código

## 1. Estado Atual
O projeto faz uso de React, TypeScript, e Electron, contudo apresenta fortes sinais de deterioração da qualidade (código "espaguete") em seus arquivos de visualização (views). 
- O projeto sofre da síndrome do "Componente Deus" (*God Component*), com páginas que superam 1.000 linhas de código (ex: `ProjectDetailsPage.tsx` e `ArticleReaderPage.tsx`).
- O TypeScript está sendo ignorado em diversos trechos através do uso excessivo de `any` (identificado em pelo menos 10 arquivos diferentes, inclusive em catch blocks como `err: any` e em tipos de props).
- O projeto não possui configuração de Linter (ESLint) ou formatador (Prettier) em seu `package.json`.

## 2. Pontos Críticos
- **Manutenibilidade e Legibilidade:** Arquivos enormes como `ProjectDetailsPage.tsx` (65 KB) declaram vários subcomponentes (Modais de Arquivamento, Modais Manuais, Modais de IA) todos no mesmo arquivo, tornando a navegação, correção de bugs e testes extremamente difíceis.
- **Perda da Tipagem Estática (TypeScript):** O uso da palavra `any` anula os benefícios de segurança em tempo de desenvolvimento que o TypeScript oferece, permitindo a injeção de propriedades não existentes e mascarando erros que poderiam ser pegos no VSCode antes de o código rodar.
- **Ausência de Padrão de Estilo (Linting):** A falta de ferramentas de linting leva a inconsistências de estilo e práticas inseguras ao longo do time, com componentes e estilos inline flutuando sem organização estrutural padronizada.
- **Estilos Inline Misto com Classes:** Muitos modais estão construídos com estilos inline maciços (ex: `style={{ position: 'fixed', top: 0... }}`). Isso dificulta a responsividade, reaproveitamento e uso de temas.

## 3. Mudanças Propostas
- **Refatoração (Clean Code):** Dividir arquivos enormes. A pasta `src/components/` deve ser utilizada ativamente. Modais como `ArchiveModal`, `AIExtractionModal`, `ManualArticleModal` devem viver em seus próprios arquivos, importados onde necessário.
- **Tipagem Estrita (Remoção de `any`):** Substituir o uso de `any` por tipos bem definidos em `types/index.ts`. Nas capturas de exceções (`catch`), usar `unknown` e verificar as propriedades de erro adequadamente, ou definir o tipo específico que é esperado.
- **Adição de Linters (ESLint/Prettier):** Instalar e configurar as dependências de linting de código (ex: `eslint-plugin-react-hooks`, `eslint-plugin-react`) com formatação no pre-commit ou no VSCode, padronizando espaços, indentações e coibindo más práticas (como hooks chamados condicionalmente).
- **Limpeza de Estilos:** Migrar a estilização em linha (*inline styles*) pesada para classes CSS no arquivo `style.css` (ou preferencialmente utilizar abordagens modernas como CSS Modules).
