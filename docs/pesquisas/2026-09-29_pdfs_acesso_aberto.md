# Download de PDFs de acesso aberto

Data: 2026-09-29. Tudo abaixo foi testado com requisições reais, pedindo só os primeiros bytes e sem salvar nada.

## O problema: o link da editora quase nunca entrega o PDF a um programa

| Link testado | Resposta |
|---|---|
| NEJM (`nejm.org/doi/pdf/...`), apontado pela OpenAlex como PDF aberto | Página "Just a moment..." (Cloudflare), não PDF |
| Diabetes Care (`diabetesjournals.org/.../*.pdf`) | A mesma página do Cloudflare |
| PubMed Central direto (`pmc.ncbi.nlm.nih.gov/articles/PMC.../pdf/...`) | Página HTML, não PDF |
| Europe PMC (`europepmc.org/articles/PMC...?pdf=render`) | Página do Cloudflare |
| Repositório institucional (UCL Discovery) | PDF (`%PDF-1.3`) |
| arXiv (`arxiv.org/pdf/<id>`) | PDF (`%PDF-1.7`) |
| **Bucket do PMC na AWS** (`pmc-oa-opendata.s3.amazonaws.com/PMC<id>.<versão>/PMC<id>.<versão>.pdf`) | PDF (`%PDF-1.7`, `%PDF-1.3`) |

Consequências:

- Conferir sempre os bytes `%PDF-` antes de salvar. O `content-type` e a extensão `.pdf` não bastam.
- Tentar as cópias em repositório antes do link da editora.
- Quando a única cópia aberta está atrás de um bloqueio, dizer isso e oferecer a página para baixar no
  navegador, em vez de salvar HTML como se fosse PDF.

## O serviço antigo do PMC foi aposentado

O `oa.fcgi` (PMC OA Web Service) responde 404 desde o fim de agosto de 2026. O substituto é o
[PMC Cloud Service](https://pmc.ncbi.nlm.nih.gov/tools/cloud/): um bucket público na AWS com os arquivos de cada
artigo do subconjunto de acesso aberto (JSON, XML, texto e PDF). Fonte:
[NCBI Insights, 2026-02-12](https://ncbiinsights.ncbi.nlm.nih.gov/2026/02/12/pmc-article-dataset-distribution-services/).

- Organização: `PMC<id>.<versão>/PMC<id>.<versão>.pdf`.
- Versão: listar `?list-type=2&prefix=PMC<id>.&delimiter=/` e usar a maior.
- Nem todo artigo com PMCID está no bucket: só os do subconjunto de acesso aberto.

## Onde achar as cópias: uma consulta à OpenAlex por DOI

`GET https://api.openalex.org/works/doi:<doi>?select=ids,locations,open_access` traz:

- `locations[]`, cada uma com `is_oa`, `pdf_url`, `landing_page_url` e `source.type` (`journal` ou
  `repository`);
- o PMCID em `ids.pmcid` ou, quando falta ali, no `landing_page_url` da cópia no PubMed Central
  (`/pmc/articles/3006051` → `PMC3006051`).

O Unpaywall hoje é construído sobre a OpenAlex e pede o e-mail do usuário a cada consulta. Por isso fica de fora:
a OpenAlex já traz as mesmas cópias.

## Ordem de tentativa

1. arXiv, quando o DOI é do arXiv (`10.48550/arXiv.<id>`) ou há uma cópia no arXiv: `arxiv.org/pdf/<id>`.
2. Bucket do PMC, quando há PMCID.
3. Cópias em repositório (`source.type = repository`) com `pdf_url`.
4. Link da editora (`journal`) com `pdf_url`, por último.

A primeira que entregar `%PDF-` é salva pela biblioteca de PDFs (deduplicada por hash) e vinculada ao artigo.

## Quando a OpenAlex só conhece a página do artigo (2026-09-30)

Na captura de telas do tutorial, 7 de 8 artigos marcados como acesso aberto no projeto de exemplo voltaram como
"bloqueados". Nenhum estava bloqueado de fato: a OpenAlex não tinha `pdf_url` para eles, só a página do artigo
(comum em acesso aberto dourado). A página, porém, declara o PDF na meta tag `citation_pdf_url` (padrão Highwire,
que as editoras usam para o Google Scholar). Testado com o user agent do app:

| DOI | Página | `citation_pdf_url` | PDF |
|---|---|---|---|
| 10.5194/gmd-19-5207-2026 | Copernicus (200) | sim | `%PDF-`, 11,6 MB |
| 10.5194/wcd-7-787-2026 | Copernicus (200) | sim | `%PDF-`, 13,2 MB |
| 10.54302/mausam.v77i2.6571 | OJS da MAUSAM (200) | sim | `%PDF-`, 1,3 MB |
| 10.3390/rs18111786, cli14070146, atmos17050458 | MDPI (403) | página não abre | bloqueado de verdade |
| 10.1016/j.ejrh.2026.103561 | Elsevier (redirecionamento por script) | não | sem link |

Com isso, depois das cópias diretas, o serviço abre cada página de cópia aberta, lê a `citation_pdf_url` e tenta
esse link (`landingPagePdf.ts`). A mensagem de quem sobra passou de "o site bloqueia o download automático" (falso
na maioria dos casos) para "o download automático não funcionou".

## Resultado por artigo

| Resultado | Quando |
|---|---|
| Baixado | Uma cópia entregou o PDF (e diz de onde veio). |
| Bloqueado | Existem cópias abertas, mas nenhuma entregou PDF (nem o link da página do artigo); oferece abrir a página no navegador. |
| Sem cópia aberta | A OpenAlex não conhece cópia aberta. |
| Sem DOI | Não há como procurar (a não ser um preprint do arXiv, que tem identificador próprio). |
| Já tem PDF | Nada a fazer. |
| Falha | Erro de rede ou da OpenAlex. |

## O que foi implementado (2026-09-29)

Interface escolhida no mock-up https://claude.ai/artifact/Y1nEikQgAkkwGGBcJhkd1r: **B + V1**.

- **Por artigo (B):** "Vincular PDF" abre um menu com "Do computador…" e "Buscar PDF aberto". Durante a busca o
  botão mostra "Buscando PDF…". O resultado fica numa linha abaixo das ações, com "Abrir a página" quando a cópia
  está bloqueada.
- **Na seleção (V1):** "Baixar PDFs abertos" baixa um artigo por vez. O andamento ("Baixando 3 de 12…" e uma barra)
  fica dentro da barra da seleção, com "Cancelar". No fim, um relatório agrupa: baixados, precisam de você
  (bloqueados, com o link), falharam, sem cópia aberta ou sem DOI, já tinham PDF.
- A lista de artigos recarrega uma vez, depois dos downloads, para a tabela não pular enquanto a pessoa lê.
- O autor preferiu V1 ao V2 (janela com a lista ao vivo) porque, em seleções grandes, a lista mudando o tempo todo
  atrapalha a leitura.
- "Da biblioteca de PDFs…", que aparecia no mock-up, não entrou: a linha ainda não tem um seletor da biblioteca.

