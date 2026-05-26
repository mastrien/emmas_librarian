# Relatório de Auditoria: Desempenho e Eficiência

## 1. Estado Atual
A aplicação é construída com React no frontend (Vite) e Electron no backend. Atualmente, o frontend apresenta componentes extremamente densos, o que impacta negativamente o ciclo de renderização (React Lifecycle) e o tempo de *First Contentful Paint* (FCP).
- Arquivos como `ProjectDetailsPage.tsx` (65 KB, mais de 1200 linhas) e `ArticleReaderPage.tsx` (61 KB) contêm a definição de modais inteiros e lógicas complexas dentro do mesmo arquivo.
- No Electron, a opção `backgroundThrottling: false` está configurada para manter o efeito *glassmorphism* fluido, mas mantê-la desativada consome mais ciclos de CPU em segundo plano.

## 2. Pontos Críticos
- **Renderizações Desnecessárias:** Como os estados globais e modais (ex: `AIExtractionModal`, `ManualArticleModal`) estão no mesmo escopo ou arquivo que a página principal, mudanças de estado disparam a re-renderização de árvores inteiras de componentes não relacionados.
- **Tamanho do Bundle Inicial:** A ausência de *code-splitting* em nível de componentes ou modais pode estar carregando lógicas pesadas logo na abertura da página.
- **Uso de Memória (Electron):** O não estrangulamento de recursos (`backgroundThrottling: false`) e o uso de componentes gigantes em memória sem virtualização (em listas longas de artigos) pode levar a vazamento de memória e lentidão ao longo do tempo.

## 3. Mudanças Propostas
- **Desacoplamento de Componentes:** Extrair os modais internos (`ArchiveModal`, `ManualArticleModal`, `AIExtractionModal`) para arquivos próprios na pasta `src/components`.
- **Implementação de Memoização:** Utilizar `React.memo`, `useMemo` e `useCallback` para evitar a re-renderização de componentes filhos, especialmente listas de artigos.
- **Code-Splitting e Lazy Loading:** Carregar rotas e modais pesados via `React.lazy()` para diminuir o tamanho do bundle inicial e reduzir o tempo de carregamento.
- **Avaliação de Listas Virtuais:** Utilizar bibliotecas de virtualização (como `react-window`) para a renderização de listas extensas de artigos na interface.
- **Revisar Throttling:** Avaliar se o `backgroundThrottling: false` é estritamente necessário para todos os SOs. Se o custo na bateria/CPU for alto, isolar essa configuração ou permitir que o usuário a desabilite.
