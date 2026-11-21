# Landing page: o que está defasado em relação ao app redesenhado

Levantamento de `landing_page/index.html` e `style.css` (base: `origin/main`, b84a1a6) contra o app depois do redesign
(Arca 134, PRs #150 a #187) e as versões 1.2.0 a 1.3.1. Só levantamento e proposta: nenhuma alteração na página ainda.

## 1. Levantamento

### 1.1 Capturas de tela (as quatro imagens da página)

| Arquivo | O que mostra | Defasagem |
|---|---|---|
| `busca-federada.png` | "Fazer Nova Busca", construtor visual com 4 bases | Moldura antiga (barra "Ajuda" e menu ⋮ no topo, link "Voltar para o Projeto"). A busca de hoje tem barra de título com caminho e Ctrl K, coluna de módulos, barra do projeto, 7 bases e o seletor "Publicados desde" |
| `agenda.png` | Agenda | Moldura antiga; a agenda foi refeita (calendário e lista de prazos no padrão novo) |
| `rag-ia.png` | Modal "Investigação Massiva com IA" | Duplamente velha: o nome mudou para "Investigação com IA" e deixou de ser modal, virou página (respostas em grade, revisão de cada resposta, auditoria por amostra) |
| `biblioteca-pdf.png` | Biblioteca de PDFs | Moldura antiga; a tela ganhou cartões de resumo (Arquivos, Espaço usado, Reutilizados, Órfãos), busca, filtros e tabela nova |

Todas têm a data de 11/09/2026, antes do redesign. `docs/tutorial-capturas.md` já concluiu o mesmo para as 58 imagens dos tutoriais.
`og-image.png` (cartão de compartilhamento) é de 26/09 e também precisa ser conferida.

### 1.2 Identidade visual

| Item | Landing | App hoje |
|---|---|---|
| Fonte | Outfit (Google Fonts, carregada de fora) | Lexend (interface), Source Serif 4 (leitura), JetBrains Mono (código, DOI, atalhos), todas empacotadas |
| Cor de destaque | Rosa `#db2777` no título e botões | Azul/índigo por padrão (`--color-primary: #4f46e5`), com 6 acentos à escolha |
| Fundo do topo | `#0f172a` escuro fixo | Claro por padrão, com modo escuro e 2 tons por modo (branco/quente, neutro/quente) |
| Superfícies | Cinzas soltos (`#f8fafc`, `#fff`) | Tokens `--bg-surface`, `--bg-sunken`, `--border-subtle`, com raios e sombras padronizados |
| Selo "Experimental" | Não existe | Componente próprio, usado nas bases e na ajuda da IA |

A landing e o app hoje parecem produtos diferentes: quem baixa encontra azul e Lexend onde viu rosa e Outfit.

### 1.3 Texto e funcionalidades

- **Subtítulo e descrições citam só "Scopus e Web of Science"** (meta description, Open Graph, Twitter, JSON-LD, bloco de busca). O app busca em 7 bases (`SEARCH_DATABASES`): OpenAlex, Crossref, Scopus, Web of Science, Europe PMC, arXiv e IEEE Xplore (experimental). O FAQ diz que a chave institucional é necessária, o que só vale para parte delas; conferir em Configurações > Chaves das bases quais exigem chave antes de escrever o texto novo.
- **Nome antigo "Investigação Massiva com IA"** na imagem; o texto da seção diz só "RAG".
- **Faltam seções para o que hoje é o centro do app**: revisão sistemática (rótulos, triagem guiada, PRISMA 2020), Perguntar aos projetos (conversa com PDFs de vários projetos, com artigo e página em cada afirmação), ajuda da IA na triagem (experimental), baixar PDFs em acesso aberto, relatório da estratégia de busca, backup e restauração antes de atualizar.
- **Faltam aparência e atalhos**: modo escuro, tons e acentos, paleta Ctrl K.
- **Plataformas**: o JSON-LD diz "Windows, Linux" e o botão de download já foi tratado em #203; falta um bloco que explique o Linux (AppImage, experimental) e que não há versão para Mac.
- **FAQ**: não responde sobre Linux, celular, modo escuro, nem sobre quais bases funcionam sem chave.
- **O texto promete "busca simultânea … unificando os resultados"** mas não diz nada do fluxo novo de revisar os resultados antes de salvar.
- **"Segurança e Privacidade First"** mostra a imagem da biblioteca de PDFs, que não ilustra o argumento (dados locais, backup, cópia antes de atualizar).
- **Tutoriais**: o texto de `tutoriais.html` já foi atualizado para o redesign (#713813a), mas as imagens não; a landing aponta para eles.

### 1.4 Dependências de outras branches

- O FAQ e o rodapé de "celular" (#194) e o cliente `app/` estão em `epic-27` / `feat/agente-local`, **não em `main`**. Qualquer texto sobre celular só entra depois desse merge.
- O agente local e o CLI (#196, #200, #201) não têm versão publicada: não devem aparecer na landing antes do release.

## 2. Proposta de atualizações

Ordem de prioridade. Cada item vira um commit `docs(landing):` ou `feat(landing):`.

1. **Capturas novas das 4 seções (alta)**: gerar no app atual, 1440x900, modo claro, acento padrão, relógio fixo e projeto de exemplo, pelo roteiro de `docs/tutorial-capturas.md` (`_electron.launch`, sem a biblioteca do autor). Reaproveitar o que for gerado para os tutoriais, uma só rodada de captura. Dimensões `width`/`height` nas `<img>` para evitar salto de layout.
2. **Identidade visual alinhada ao app (alta)**: trocar Outfit por Lexend (hospedada junto, sem Google Fonts, como no app), levar os tokens de cor do app para o `style.css` e trocar o rosa pelo acento padrão. Decisão do autor: o hero escuro fica como assinatura da página ou vira claro como o app?
3. **Reescrever as 4 seções existentes e acrescentar 3 (alta)**:
   - Busca federada em 7 bases, dizendo quais não exigem chave (nova imagem);
   - Revisão sistemática: triagem guiada e PRISMA (nova seção, nova imagem);
   - Investigação com IA (nome e imagem novos);
   - Perguntar aos projetos (nova seção);
   - Agenda, Biblioteca e Privacidade com imagens novas; Privacidade passa a falar de backup e da cópia antes de atualizar.
4. **Metadados e dados estruturados (média)**: meta description, Open Graph, Twitter e JSON-LD falando em "busca federada em 7 bases", revisão sistemática e PRISMA; regenerar `og-image.png` com a tela nova.
5. **FAQ (média)**: acrescentar "Quais bases funcionam sem chave?", "Tem modo escuro?", "Funciona no Linux e no Mac?"; manter as respostas atuais, corrigindo a de IAs (modelos locais via Ollama, nuvem opcional).
6. **Faixa "O que o app tem" com aparência e atalhos (baixa)**: modo escuro, acentos, Ctrl K, numa faixa curta com uma captura do modo escuro.
7. **Depois dos merges (baixa)**: bloco do celular quando #194 entrar em `main`; agente local/CLI só depois do release.

### Verificação proposta

- Abrir a página em 1440, 768 e 375 px e conferir que nenhuma imagem estoura nem salta (as dimensões vão nas tags).
- Comparar a lista de bases da landing com `searchQueries.ts` e as versões com o `README.md` antes de publicar.
- Validar o JSON-LD no validador do schema.org.

## 3. Decisões do autor (2026-11-20)

- [x] **Fundo do hero: teste A/B com três variantes**: o escuro antigo (`#0f172a`), o escuro neutro novo e o escuro quente novo (os tons do modo escuro do app).
- [x] **Rosa continua sendo a cor de marca** da página.
- [x] **Capturas só com bases totalmente abertas** (OpenAlex, Crossref, Europe PMC, arXiv): gerar um `.emmapcarc` novo, de preferência pelo CLI, em uma pasta de dados vazia. Nunca a biblioteca real.
- [x] **Revisão sistemática e PRISMA ganham seção própria.**
- Ideias para testar depois (o anel animado no hero e o corredor de estantes) estão em `docs/ideias.md`.

## 4. Estado da implementação (2026-11-20)

Feito em `landing_page/`:

- Capturas novas (1440x900) de busca, triagem, PRISMA, investigação, Perguntar aos projetos, biblioteca e agenda, todas do projeto de exemplo com bases abertas. A investigação e a conversa são ilustrativas: respostas escritas por um modelo a partir de PDFs reais, com cada trecho conferido na página citada, e o modelo aparece como "Modelo de exemplo".
- `index.html` reescrito: 7 seções (busca, triagem, PRISMA, investigação, perguntar, biblioteca, agenda), faixa "O aplicativo do seu jeito", FAQ com bases sem chave, plataformas e modo escuro, metadados e JSON-LD alinhados.
- Fonte trocada para Lexend na landing e nos tutoriais; o rosa continua como cor de marca.
- Fundo do hero e do rodapé com três variantes: `?hero=antigo` (padrão), `?hero=neutro` e `?hero=quente`. Não há medição de conversão na página: a escolha é por comparação visual.

Pendente:

- `og-image.png` (cartão de compartilhamento) continua o antigo.
- Capturas dos tutoriais (58 imagens) seguem para outra rodada; reaproveitar o projeto de exemplo.
- Bloco do celular só depois de #194 ir para `main`; agente local e CLI só depois do release.
- Anel animado e corredor de estantes no hero: `docs/ideias.md`.
