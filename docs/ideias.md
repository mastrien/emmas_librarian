# Ideias para depois

Ideias combinadas com o autor que ainda não viraram tarefa. Cada uma diz de onde veio, o que já se sabe
e quando faz sentido fazer. Quando uma virar branch, mova o que foi decidido para o plano ou o PR e apague daqui.

Situação em 2026-10-18: **feito** (Teste de atualização entre releases), **em parte** (Bases novas e download de PDFs
de acesso aberto) e **pendente** (as demais). O que está feito fica marcado aqui como registro, até alguém apagar.

## Bases novas e download de PDFs de acesso aberto (em parte feito)

Pedido em 2026-09-28. Fazer **depois da paginação e antes da atualização dos tutoriais**, para o capítulo 2 ser
escrito uma vez só. Ainda não se sabe quais bases o público mais usa.

- **OpenAlex (feito):** as respostas que o app já recebe trazem `best_oa_location.pdf_url` / `open_access.oa_url`;
  `normalizeOpenAlex` guarda só `is_oa` e descarta o link. É o primeiro passo, e o mais barato.
- **Unpaywall (pendente):** acha o PDF aberto pelo DOI (`best_oa_location.url_for_pdf`), o que cobre os resultados de
  Crossref, Scopus e WoS. Pede um e-mail em vez de chave; o limite sugerido é de 100 mil consultas por dia.
- **arXiv (feito)** (`export.arxiv.org/api/query`, Atom XML): sem chave, no máximo 1 requisição a cada 3 segundos e uma
  conexão por vez; o PDF fica em `arxiv.org/pdf/<id>`.
- **Candidatas a base nova (pendentes):** Semantic Scholar (campo `openAccessPdf`; com chave grátis é mais estável),
  CORE (baixa o PDF de repositórios; chave grátis, limite de ~5 requisições a cada 10 s), PubMed / Europe PMC
  (se o público for da saúde).
- **Cuidados:**
  - O "link do PDF" às vezes é uma página HTML ou um bloqueio da editora. Conferir o `content-type` e os bytes
    `%PDF` antes de salvar pelo `savePdfToStorage`.
  - Cada base nova precisa de um dialeto no `QueryTranslator` (é o custo principal), de conversão dos dados,
    de deduplicação, de UI e de texto no tutorial.
- **Onde entra na UI:** "Baixar PDFs de acesso aberto" na barra da seleção múltipla da tabela de artigos.
- **Feito (2026-09-29):** Europe PMC, arXiv e IEEE Xplore (PR #11) e o download de PDFs abertos (branch
  `feat/open-access-pdfs`, hoje no `main`). O download usa os links de `locations` do OpenAlex (PubMed Central,
  repositórios, editora), o PDF do arXiv e, quando o OpenAlex não tem link, o `citation_pdf_url` da página do artigo.
  **Pendentes:** Unpaywall, Semantic Scholar e CORE, para outro momento.

## Tarefas longas em segundo plano (pendente)

Pedido em 2026-09-28, para depois. Nada disso existe ainda no código (não há fila de tarefas nem progresso global).

Buscas grandes e investigação em massa com IA rodam sem travar o app. O usuário continua usando o sistema, e um
elemento flutuante num canto da tela mostra o progresso e avisa quando a tarefa terminou.

- Com a paginação, uma busca pode levar minutos (WoS espaça páginas em 1 s; arXiv exigiria 3 s).
- O processo principal já faz as chamadas; falta:
  - uma fila de tarefas com ID;
  - eventos de progresso por IPC (`webContents.send`), que o renderer escuta em qualquer página;
  - cancelamento;
  - um componente de progresso fora das rotas.
- Decidir: quantas tarefas ao mesmo tempo, o que acontece se o app fechar no meio e se o resultado da busca
  (a prévia) espera o usuário voltar para revisar.

## Teste de atualização entre releases (feito)

Pedido em 2026-09-28. Rodar só antes de publicar uma versão, fora do CI.

1. Baixar a release atual.
2. Alimentar com dados de todas as tabelas, mais PDFs e documentos (como `fullProjectFixture.ts`).
3. Simular a atualização: abrir a versão nova na mesma pasta de dados.
4. Conferir se tudo continua exatamente igual.

Pode ser lento.

- **Feito (2026-10-08):** a fixture com todas as tabelas (#18), o upgrade a partir da release publicada (#19) e a
  atualização pelo próprio app, com snapshot e verificação do primeiro boot (#20). Roda no workflow
  `release-upgrade-test.yml`.
- **Mudou (2026-10-15, PR #39):** deixou de ser só "fora do CI". O `release.yml` agora abre o app empacotado e roda o
  upgrade a partir da última release publicada, **com o instalador que vai ser publicado**, antes de criar o
  rascunho da release. Motivo: a 1.2.0 e a 1.2.1 saíram com o `better-sqlite3` do ABI errado e esses testes, que
  construíam o instalador em outra ordem, não pegaram.

## Separador do CSV (pendente)

Aberto em 2026-09-28. O CSV exportado usa vírgula, mas o Excel em português espera `;` ao abrir o arquivo com
duplo clique. Decisão de produto: trocar, oferecer as duas opções ou deixar como está (já tem BOM para os acentos).
Hoje o CSV segue com vírgula; já existe uma exportação XLSX com as mesmas colunas (`ExportService`).

## Mais fontes (pendente)

Testar viabilidade de permitir o usuário configurar fontes customizadas na plataforma dentre um grupo pré-definido de fontes (que deve incluir Lexend e uma fonte serifada)

## Loading customizado (pendente)

Desenvolver um loading customizado que lembre a logo do sistema, similar a um giroscópio que gira enquanto o loading está em andamento. Testar vários com testes A/B avaliando design e desempenho da animação (ou então fazer de outra forma que não uma animação, se for mais eficiente)

## Citações da IA que atravessam a quebra de página (pendente)

Aberto em 2026-10-18 (PR #62). Os chunks que a IA lê seguem de uma página para a outra, com o cabeçalho ou rodapé da
página no meio ("1702 JOURNAL OF CLIMATE VOLUME 23 Unauthenticated…"). A IA pula esse texto ao citar, com ou sem
"...", e o leitor procura a citação numa página só. No projeto de previsão de precipitação foram 5 das 102 citações.
Corrigir pede destaque em duas páginas e reconhecer o que pular no meio. Continua valendo depois da #63: a evidência
agora é copiada do chunk, mas uma cópia que atravessa a página traz o cabeçalho junto e o leitor ainda procura numa
página só.

## Chunks cortados no meio da palavra (pendente)

Aberto em 2026-10-18 (PR #62). `PdfExtractor` fecha um chunk a cada ~1000 caracteres (`rag_chunk_size`), mesmo no
meio de uma frase ou palavra ("precipita"), e a IA completa a palavra por conta própria ao citar. Cortar em fim de
frase deixaria os trechos mais limpos, mas muda os chunks e os embeddings de toda a biblioteca (reindexar) e a busca
semântica. Medir antes o efeito nas respostas.

## Limpar cabeçalhos, rodapés e afiliações do texto extraído (pendente)

Aberto em 2026-11-01 (#63). O texto que `PdfExtractor` entrega mistura o corpo do artigo com título, lista de autores
e instituições, cabeçalhos de página e rodapés de licença ("This is an open access article…", "See the Terms and
Conditions… Wiley"), às vezes no meio de uma frase. No teste da #63 (gpt-oss:120b, 40 casos de artigos abertos do
projeto de precipitação) isso fez a opção de frases numeradas apontar 6 de 70 evidências para linhas de autores e
rodapés, e errar um número do ERA5 ("de 67% para 77%" virou "para 67%", com a licença no meio da frase). Tirar esse
texto antes de montar os chunks deixaria as evidências e a busca semântica mais limpas, e poderia reabrir a opção de
frases numeradas. Muda os chunks e os embeddings da biblioteca (reindexar): medir antes.
