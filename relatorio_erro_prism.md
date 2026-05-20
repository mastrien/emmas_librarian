# Relatório de Investigação: Erro de Inicialização do PrismJS em Produção

## O Problema
Ao executar a aplicação empacotada (produção), a tela permanece em branco. O console do desenvolvedor (Electron) reporta erros recorrentes relacionados à biblioteca **PrismJS**, especificamente no componente de Markdown.

### Sintomas
1. **`ReferenceError: Prism is not defined`**: Ocorria inicialmente porque dependências (provavelmente o `@mdxeditor/editor`) tentavam acessar o objeto global `Prism` antes do bundle principal do React ser carregado ou inicializado.
2. **`TypeError: Cannot read properties of undefined (reading 'inside')`**: Após a criação de um mock básico para o `Prism`, o erro evoluiu para falhas em acessos profundos de propriedades, especificamente na configuração de realce de sintaxe do Markdown:
   ```javascript
   t !== n && (e.languages.markdown[t].inside.content.inside[n] = e.languages.markdown[n])
   ```

## Tentativas de Solução e Por que Falharam

### 1. Inclusão de Assets e Configuração de Base
- **Ação:** Adição do `schema.sql` no `package.json` e criação do `vite.config.ts` com `base: './'`.
- **Resultado:** Resolveu o crash do processo principal e problemas de carregamento de assets via `file://`, mas revelou o erro de runtime do Prism.

### 2. HashRouter
- **Ação:** Troca de `BrowserRouter` para `HashRouter`.
- **Resultado:** Necessário para o protocolo `file://`, mas o erro de JS impedia o React de chegar na fase de roteamento.

### 3. Mock Rasos de Prism (window.Prism)
- **Ação:** Injeção de `window.Prism = {}` e posteriormente mocks manuais de `languages`.
- **Resultado:** Falhou porque o código do Prism/Markdown tenta acessar e atribuir propriedades em múltiplos níveis de profundidade (ex: `.inside.content.inside`).

### 4. Proxy Recursivo ("Bottomless Mock")
- **Ação:** Implementação de um `Proxy` recursivo no `index.html` para interceptar qualquer acesso a `Prism.languages` e retornar novos Proxies dinamicamente.
- **Resultado:** Teoricamente deveria satisfazer qualquer acesso profundo, mas o erro persistiu. Possíveis causas:
  - O código minificado pode estar usando referências locais que o `Proxy` global não captura.
  - O `Proxy` pode ter conflitado com a maneira como o Vite/Rollup renomeia variáveis em produção.
  - Atribuições complexas em objetos mockados podem estar falhando em lógica interna do Prism.

### 5. Configuração de Bundling (Vite CommonJS)
- **Ação:** Adição do `prismjs` ao `commonjsOptions` e imports explícitos no `main.tsx`.
- **Resultado:** O bundle de produção continuou apresentando o erro, sugerindo que a ordem de execução dos scripts ou a forma como o Rollup agrupa as dependências do `@mdxeditor` isola o Prism de forma incompatível com o esperado.

## Diagnóstico Atual
O erro reside na inicialização síncrona do plugin Markdown do PrismJS. Ele é disparado no momento em que o script é avaliado pelo navegador, antes de qualquer lógica do `main.tsx` ou do mock do `index.html` conseguir estabilizar o ambiente global de forma que o Prism não "se auto-destrua" ao tentar configurar seus plugins.

## Recomendação de Próximos Passos
1. **Isolamento do MDXEditor:** Tentar remover temporariamente o `@mdxeditor/editor` para confirmar se o restante da aplicação carrega normalmente.
2. **Externalização Total:** Configurar o `prismjs` como uma dependência externa (`external`) no Vite e carregá-lo via tag `<script>` estática no `index.html` a partir de uma pasta de assets, evitando que o bundler tente processá-lo.
3. **Verificação de Polyfills:** Verificar se há necessidade de polyfills globais adicionais que o Electron de produção possa estar omitindo em relação ao ambiente de desenvolvimento.
