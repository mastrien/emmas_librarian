# Ideias para depois

Ideias combinadas com o autor que ainda não viraram tarefa. Cada uma diz de onde veio, o que já se sabe
e quando faz sentido fazer. Quando uma virar branch, mova o que foi decidido para o plano ou o PR e apague daqui.

## Bases novas e download de PDFs de acesso aberto

Pedido em 2026-09-28. Fazer **depois da paginação e antes da atualização dos tutoriais**, para o capítulo 2 ser
escrito uma vez só. Ainda não se sabe quais bases o público mais usa.

- **OpenAlex:** as respostas que o app já recebe trazem `best_oa_location.pdf_url` / `open_access.oa_url`;
  `normalizeOpenAlex` guarda só `is_oa` e descarta o link. É o primeiro passo, e o mais barato.
- **Unpaywall:** acha o PDF aberto pelo DOI (`best_oa_location.url_for_pdf`), o que cobre os resultados de
  Crossref, Scopus e WoS. Pede um e-mail em vez de chave; o limite sugerido é de 100 mil consultas por dia.
- **arXiv** (`export.arxiv.org/api/query`, Atom XML): sem chave, no máximo 1 requisição a cada 3 segundos e uma
  conexão por vez; o PDF fica em `arxiv.org/pdf/<id>`.
- **Candidatas a base nova:** Semantic Scholar (campo `openAccessPdf`; com chave grátis é mais estável),
  CORE (baixa o PDF de repositórios; chave grátis, limite de ~5 requisições a cada 10 s), PubMed / Europe PMC
  (se o público for da saúde).
- **Cuidados:**
  - O "link do PDF" às vezes é uma página HTML ou um bloqueio da editora. Conferir o `content-type` e os bytes
    `%PDF` antes de salvar pelo `savePdfToStorage`.
  - Cada base nova precisa de um dialeto no `QueryTranslator` (é o custo principal), de conversão dos dados,
    de deduplicação, de UI e de texto no tutorial.
- **Onde entra na UI:** "Baixar PDFs de acesso aberto" na barra da seleção múltipla da tabela de artigos.
- **Feito (2026-09-29):** Europe PMC, arXiv e IEEE Xplore (PR #11) e o download de PDFs abertos (branch
  `feat/open-access-pdfs`). Semantic Scholar e CORE continuam para outro momento.

## Tarefas longas em segundo plano

Pedido em 2026-09-28, para depois.

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

## Teste de atualização entre releases

Pedido em 2026-09-28. Rodar só antes de publicar uma versão, fora do CI.

1. Baixar a release atual.
2. Alimentar com dados de todas as tabelas, mais PDFs e documentos (como `fullProjectFixture.ts`).
3. Simular a atualização: abrir a versão nova na mesma pasta de dados.
4. Conferir se tudo continua exatamente igual.

Pode ser lento.

## Separador do CSV

Aberto em 2026-09-28. O CSV exportado usa vírgula, mas o Excel em português espera `;` ao abrir o arquivo com
duplo clique. Decisão de produto: trocar, oferecer as duas opções ou deixar como está (já tem BOM para os acentos).

## Mais fontes

Testar viabilidade de permitir o usuário configurar fontes customizadas na plataforma dentre um grupo pré-definido de fontes (que deve incluir Lexend e uma fonte serifada)

## Loading customizado

Desenvolver um loading customizado que lembre a logo do sistema, similar a um giroscópio que gira enquanto o loading está em andamento. Testar vários com testes A/B avaliando design e desempenho da animação (ou então fazer de outra forma que não uma animação, se for mais eficiente)