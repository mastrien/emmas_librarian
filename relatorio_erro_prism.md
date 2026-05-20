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

---

## Solução Definitiva Aplicada (2026-05-20)

### Causa Raiz Confirmada

Ao inspecionar o bundle de produção do `@lexical/code` (`LexicalCode.prod.mjs`), foi identificado que o módulo importa o `prismjs` e todos os seus componentes de linguagem como side-effects síncronos no topo do arquivo:

```javascript
import "prismjs";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-markdown.js";
// ... etc
```

O componente `prism-markdown.js` executa este trecho durante sua avaliação:

```javascript
['url', 'bold', 'italic', 'strike'].forEach(function (token) {
    ['url', 'bold', 'italic', 'strike', 'code-snippet'].forEach(function (inside) {
        if (token !== inside) {
            Prism.languages.markdown[token].inside.content.inside[inside] = Prism.languages.markdown[inside];
        }
    });
});
```

Quando o Vite/Rollup empacota tudo em um único bundle, a ordem de avaliação dos módulos não é garantida da forma esperada pelo PrismJS. O `prism-markdown` precisa que o `prism-markup` já tenha populado `Prism.languages.markup` (pois faz `Prism.languages.extend('markup', {})`), e que os tokens `bold`, `italic` etc. já estejam definidos antes das linhas acima executarem. No bundle minificado de produção, essa interdependência se rompe.

A tentativa de usar `rollupOptions.external` não funcionou porque o Rollup mantém os `import "prismjs"` como bare specifiers no output final, que o browser não consegue resolver (sem import maps).

### Solução: Plugin Vite + Scripts Estáticos

A solução implementa a **Externalização Total** (opção 2 da recomendação), com uma abordagem mais robusta usando um plugin Vite customizado.

#### Arquivos modificados

**1. `frontend/vite.config.ts`** — Plugin `prismjsExternalPlugin` que intercepta todos os imports de `prismjs` e `prismjs/components/*` no nível do Vite, substituindo-os por módulos virtuais:
- `import "prismjs"` → vira um módulo que exporta `globalThis.Prism || window.Prism`
- `import "prismjs/components/*"` → vira um comentário no-op (componentes já carregados via `<script>`)

Isso elimina os bare specifiers do bundle final sem usar `rollupOptions.external`.

**2. `frontend/index.html`** — Scripts síncronos carregando o PrismJS antes do bundle React:

```html
<script src="./vendor/prismjs/prism.js"></script>
<script src="./vendor/prismjs/components/prism-markup.min.js"></script>
<script src="./vendor/prismjs/components/prism-clike.min.js"></script>
<!-- ... demais componentes em ordem de dependência ... -->
<script src="./vendor/prismjs/components/prism-markdown.min.js"></script>
<!-- O bundle React carrega DEPOIS, como type="module" (deferido) -->
<script type="module" src="/src/main.tsx"></script>
```

Scripts sem `type="module"` são síncronos e bloqueantes — executam completamente antes de qualquer módulo ES ser avaliado. Isso garante que `window.Prism` e todos os `Prism.languages.*` estejam totalmente inicializados antes do `@lexical/code` rodar.

**3. `frontend/src/main.tsx`** — Removidos os imports manuais de `prismjs` e a atribuição `window.Prism = Prism` (que eram tentativas anteriores de correção).

**4. `frontend/public/vendor/prismjs/`** — Arquivos do PrismJS copiados de `node_modules/prismjs/` para servir como assets estáticos. O Vite os copia automaticamente para `dist/vendor/prismjs/` no build, e o `electron-builder` os inclui no pacote via `"dist/**/*"`.

#### Ordem de carregamento garantida no `dist/index.html` gerado

```
prism.js         → inicializa window.Prism com o core
prism-markup     → define Prism.languages.markup (necessário para markdown)
prism-clike      → define Prism.languages.clike (necessário para js/ts)
prism-javascript → define Prism.languages.javascript
prism-typescript → define Prism.languages.typescript
prism-markdown   → usa extend('markup') e acessa tokens já definidos ✓
... demais componentes ...
[bundle React]   → @lexical/code acessa globalThis.Prism, já completo ✓
```

#### Verificação

```
npm run build  →  ✅ compila sem erros
```

- Bundle não contém bare `import "prismjs"` (verificado com grep)
- `dist/vendor/prismjs/` contém os 16 componentes + core
- `dist/index.html` carrega scripts na ordem correta
- `globalThis.Prism` e `window.Prism` referenciados corretamente no bundle
