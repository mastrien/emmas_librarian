# Bases novas para a busca

Data: 2026-09-28. Pedido do autor: ampliar as bases aceitas; conferir se Cochrane e IEEE têm API. Ainda não se
sabe quais bases o público do app mais usa.

## O que custa cada base nova

A chamada à API é a parte pequena. Cada base precisa de:

- um dialeto no `QueryTranslator` (a sintaxe de busca de cada base é diferente);
- um módulo em `electron/services/searchApis/` (requisição, paginação e normalização);
- teto e tamanho de página em `src/utils/searchLimits.ts`;
- chave em Configurações, quando a base exige;
- verificação da deduplicação por DOI e título, teste de paginação com o `FakeSearchApi` e texto no tutorial.

## Cochrane

**Não há API pública de busca.**

- A API documentada da Cochrane (Review Document API, no Archie) serve para trabalhar com revisões dentro da
  Cochrane. A autenticação é por conta Cochrane, com papéis como autor e editor. Não é uma busca aberta para
  aplicativos de terceiros.
- A própria Cochrane pede contato direto para quem quer acesso programático a texto completo, metadados ou
  citações.
- O CENTRAL (registro de ensaios) é montado a partir de outras fontes (PubMed, Embase, registros de ensaios) e não
  tem API aberta.

**Como cobrir mesmo assim:** as revisões Cochrane (Cochrane Database of Systematic Reviews) são indexadas no
MEDLINE/PubMed e aparecem na Crossref e na OpenAlex (DOI `10.1002/14651858...`). Uma integração com o PubMed ou o
Europe PMC já traz as revisões Cochrane, e um filtro pelo periódico "Cochrane Database Syst Rev" isola só elas.

Fontes: [Review Document API](https://documentation.cochrane.org/display/API/Review+Document+API),
[como o CENTRAL é criado](https://www.cochranelibrary.com/central/central-creation),
[acesso aberto na Cochrane](https://www.cochranelibrary.com/about/open-access).

## IEEE Xplore

**Tem API** (Metadata Search API), com chave gratuita. A chave é liberada depois de um cadastro que a IEEE aprova.

- Endpoint: `https://ieeexploreapi.ieee.org/api/v1/search/articles?...&apikey=`. A chave vai em toda requisição.
- Paginação: `start_record` (começa em 1) e `max_records`, que vale 25 por padrão e **200 no máximo** por
  chamada.
- Ordenação: `sort_field` só aceita `article_number`, `article_title` e `publication_title`. Não há ordenação por
  data nem por citações; o critério "Mais citados" do app não teria equivalente.
- Cota: definida no cadastro. Fontes de terceiros citam cerca de **200 chamadas por dia** no plano gratuito
  (até 40 mil resultados por dia). Isso ainda precisa ser confirmado com uma chave real.
- Cobre periódicos, anais de congressos, livros e normas da IEEE: engenharia e computação.

Fontes: [APIs disponíveis](https://developer.ieee.org/docs),
[paginação e ordenação](https://developer.ieee.org/docs/read/metadata_api_details/Sorting_and_Paging_Parameters),
[consulta](https://developer.ieee.org/docs/read/Searching_the_IEEE_Xplore_Metadata_API),
[termos de uso](https://developer.ieee.org/API_Terms_of_Use2).

## Demais candidatas

| Base | Área | Chave | Limites | Paginação | PDF aberto |
|---|---|---|---|---|---|
| Europe PMC | Saúde e ciências da vida; inclui PubMed/MEDLINE, PMC e preprints | Nenhuma | 10 req/s; até 1.000 por página | `cursorMark` | Sim: indica acesso aberto e o texto completo no PMC |
| PubMed (E-utilities) | Saúde | Opcional | 3 req/s sem chave, 10 com chave | `retstart` | Não direto (via PMC ou Unpaywall) |
| arXiv | Física, computação, matemática (preprints) | Nenhuma | 1 req a cada 3 s, uma conexão | `start` / `max_results` | Sim, sempre (`arxiv.org/pdf/<id>`) |
| Semantic Scholar | Multidisciplinar | Recomendada (grátis) | Busca em lote: até 1.000 por chamada | Token | Campo `openAccessPdf` |
| CORE | Repositórios de acesso aberto | Grátis | Apertado (~5 req a cada 10 s) | Offset | Sim (download) |
| IEEE Xplore | Engenharia e computação | Grátis, com aprovação | ~200 chamadas/dia (a confirmar); 200 por chamada | `start_record` | A confirmar com chave |

Fontes: [Europe PMC para desenvolvedores](https://europepmc.org/developers),
[chaves das E-utilities](https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities),
[termos da API do arXiv](https://info.arxiv.org/help/api/tou.html),
[tutorial do Semantic Scholar](https://www.semanticscholar.org/product/api/tutorial),
[API do CORE](https://api.core.ac.uk/docs/v3).

## Recomendação de ordem

1. **Europe PMC.** Uma integração cobre PubMed/MEDLINE, PMC e preprints, e com isso as revisões Cochrane. Não
   pede chave, os limites são folgados e o acesso aberto vem marcado, o que já prepara o download de PDFs.
2. **arXiv.** Não pede chave e tem PDF sempre. Precisa espaçar as requisições em 3 s (o paginador já faz isso para
   o WoS).
3. **IEEE Xplore**, se o público incluir engenharia e computação. Vale o autor pedir a chave logo, porque a
   aprovação é manual.
4. **Semantic Scholar** como base multidisciplinar extra, e **CORE** por último, por causa do limite apertado.

O PubMed direto fica redundante com o Europe PMC.

## O que foi implementado (2026-09-28)

Branch `feat/more-search-bases`. O autor escolheu Europe PMC, arXiv e IEEE, nessa ordem; Semantic Scholar e CORE
ficam para outro momento.

| Base | Chave | Por página | Teto por busca | Ordenação | Conferido na API real |
|---|---|---|---|---|---|
| Europe PMC | Nenhuma | 1.000 (`cursorMark`) | 10.000 | relevância, `CITED desc`, `P_PDATE_D desc` | Sim: sintaxe, as duas ordenações e os campos |
| arXiv | Nenhuma | 1.000 (`start`), 3 s entre páginas | 10.000 | relevância, `submittedDate`; "Mais citados" usa relevância e avisa | Sim: as três formas de consulta que o dialeto gera |
| IEEE Xplore | Obrigatória | 200 (`start_record`), 0,5 s entre chamadas | 2.000 | ordem padrão; data e citações avisam que não há | **Não**: falta uma chave |

- Cada base tem um dialeto próprio em `electron/services/queryDialects/`. "Não contém" vira `NOT` ou `ANDNOT`
  depois dos outros termos de um grupo E. As três bases recusam "não contém" dentro de um grupo OU, com o motivo.
- Achado na conferência do Europe PMC: autores coletivos (grupos de pesquisa de ensaios clínicos) vêm em
  `collectiveName`; o normalizador passou a guardá-los.
- arXiv: o DOI é o da revista quando o preprint foi publicado; senão, o DOI DataCite `10.48550/arXiv.<id>`, o
  mesmo que a OpenAlex usa, para as duplicatas se juntarem.
- **Pendente (IEEE):** com uma chave, conferir que a API aceita a forma de campo `("Document Title":termo)` dentro
  de `querytext`. A documentação só mostra os operadores. Conferir também a cota real do plano.
- As bases novas não entram marcadas por padrão numa busca nova; o usuário escolhe.
