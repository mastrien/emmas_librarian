# Paginação e limites das APIs de busca

Data: 2026-09-27. Pedido original: pesquisar paginação para contornar o limite por requisição
(ex.: pedidos acima de 50 rejeitados), item 4 da lista de 2026-09-24.

## Como o app faz hoje

`electron/services/ApiIntegrator.ts` faz **uma única requisição por base** e corta o limite
escolhido pelo usuário no máximo por chamada. Não há paginação. O campo "Limite por base"
aceita até 100.000, mas na prática:

| Base | Parâmetro | Corte no código | O que acontece acima disso |
|---|---|---|---|
| OpenAlex | `per_page` | 200 | recebe no máximo 200, sem aviso |
| Crossref | `rows` | 1.000 | aviso na tela, recebe 1.000 |
| Scopus | `count` | 200 | aviso na tela, recebe 200 (ou erro em assinaturas menores) |
| WoS Starter | `limit` + `page=1` | 50 | recebe 50, sem aviso |

## Limites oficiais (conferidos em 2026-09-27)

### OpenAlex

- `per_page`: **máximo suportado é 100**. `per_page=200` ainda funciona, mas está marcado como
  obsoleto e "vai ser removido". **O app usa 200 hoje**, então quando isso sair, qualquer limite
  acima de 100 deve falhar ou ser cortado.
- Paginação simples (`page`): até 10.000 resultados (`page * per_page <= 10.000`).
- Paginação por cursor (`cursor=*` e depois `next_cursor`): sem teto, só avança em sequência.
- Custo (modelo de 2026): sem chave, US$ 0,10 por dia; com chave grátis, US$ 1 por dia.
  Lista/filtro custa US$ 0,10 a cada mil chamadas, e busca (full-text/semântica) custa US$ 1 a
  cada mil. Sem chave, isso dá cerca de 100 buscas por dia; com chave, cerca de 1.000.
  O app não manda chave (`api_key=` ou `Authorization: Bearer`).
- Fontes: [paginação](https://help.openalex.org/guides/page-through-results),
  [autenticação](https://help.openalex.org/api/authentication/),
  [custos](https://help.openalex.org/access/example-costs/).

### Crossref

- `rows`: até 1.000 por requisição.
- Para ir além, a documentação recomenda cursor (`cursor=*`); não publica limite de
  profundidade, mas avisa que milhares de páginas aumentam a chance de erro. Em caso de 429,
  recuar.
- Fonte: [dicas da REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/).

### Scopus Search API

- `count`: até **200** por requisição na visão STANDARD (a padrão, que o app usa); **25** nas
  visões COMPLETE e COMPONENT.
- `start` (offset): até **5.000 resultados no total**; além disso, só com paginação por cursor.
- Cota: **20.000 requisições por semana**, 9 por segundo.
- Fonte: [API key settings da Elsevier](https://dev.elsevier.com/api_key_settings.html).

### Web of Science Starter API

- `limit`: **0 a 50** por página (padrão 10), `page` para as páginas seguintes.
- Cotas por plano:

| Plano | Req/s | Req/dia |
|---|---|---|
| Free Trial | 1 | 50 |
| Free Institutional Member | 5 | 5.000 |
| Free Institutional Integration | 5 | 20.000 |

- No Free Trial, 500 resultados custariam 10 das 50 requisições do dia.
- Fontes: [Clarivate Developer Portal](https://developer.clarivate.com/apis/wos-starter),
  [clientes oficiais](https://github.com/clarivate/wosstarter-javascript-client).

## Recomendação

1. **Paginar no `ApiIntegrator`, por base**, até atingir o limite pedido ou acabarem os
   resultados. Cada base com o seu tamanho de página e o seu mecanismo:
   - OpenAlex: `per_page=100` + cursor. Corrige também o uso de `per_page=200`, que é obsoleto.
   - Crossref: `rows=1000` + cursor.
   - Scopus: `count=200` + `start`, até 5.000 (cursor fica para depois; ninguém pede mais que
     isso numa revisão).
   - WoS: `limit=50` + `page`.
2. **Proteger as cotas**: um teto de páginas por base e por busca (ex.: WoS no máximo 10 páginas),
   parar na primeira página vazia ou incompleta, e mostrar no resumo quando o limite pedido não
   foi atingido por causa do teto ou da cota (o `breakdown` já tem espaço para `error`).
3. **Mensagens de limite**: trocar os avisos fixos do `SearchOptionsCard` pelos limites reais
   depois da paginação (ex.: "WoS: 50 por página; o plano gratuito permite 50 requisições por
   dia").
4. **Chave da OpenAlex (opcional)**: um campo nas Configurações, como os de Scopus e WoS, para
   quem faz muitas buscas. Sem chave continua funcionando, dentro do orçamento diário menor.
5. **Tutorial, capítulo 2**: separar os dois tipos de limite, requisições (cota) e resultados
   por requisição e por busca, com os números acima.

Ordem sugerida: 1 com testes da paginação por base (fake de `fetch` com páginas), depois 2 e 3,
e por último 4 e 5.
