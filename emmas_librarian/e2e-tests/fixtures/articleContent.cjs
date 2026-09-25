// Content of the synthetic test article (e2e-tests/fixtures/artigo-teste-emma.pdf).
// Written for this project; all people, institutions, data and references are fictitious.
// Released under CC0 1.0 — free to use, modify and redistribute without attribution.

const METADATA = {
  title:
    'Revisões sistemáticas assistidas por ferramentas digitais: um estudo exploratório com pesquisadores de pós-graduação',
  shortTitle: 'Revisões sistemáticas assistidas por ferramentas digitais',
  authors: 'Ana Beatriz Lima; Carlos Eduardo Souza; Marina Tavares Rocha',
  journal: 'Revista Brasileira de Métodos de Pesquisa (fictícia)',
  volume: '12',
  issue: '3',
  pages: '101-106',
  year: '2025',
  doi: '10.5555/emma.teste.2025.001',
};

// Phrases the E2E specs search for. Keep them unique within the document.
const SENTINELS = {
  // Appears once, on page 3 (section 4), for in-reader search.
  search: 'índice de saturação teórica',
  // First sentence of the abstract, used to create a highlight.
  highlight: 'Este estudo investiga como ferramentas digitais apoiam revisões sistemáticas',
};

/**
 * Blocks in reading order. `h` = section heading, `p` = paragraph, `table` = rows, `ref` = reference entry,
 * `pageBreak` = start a new page (keeps each sentinel on a known page: search term on page 3).
 */
const BLOCKS = [
  { type: 'abstractTitle', text: 'Resumo' },
  {
    type: 'abstract',
    text:
      `${SENTINELS.highlight} conduzidas por pesquisadores de pós-graduação. ` +
      'Por meio de um levantamento com 48 participantes de seis programas, analisamos o tempo gasto nas etapas de ' +
      'busca, triagem, extração e síntese, bem como a percepção de confiabilidade dos resultados. Os dados indicam ' +
      'redução média de 31% no tempo de triagem quando os participantes utilizaram critérios de inclusão ' +
      'explícitos e registros de decisão compartilhados. Discutimos implicações para a formação metodológica e ' +
      'propomos um roteiro mínimo de rastreabilidade para revisões conduzidas com apoio de software.',
  },
  {
    type: 'keywords',
    text: 'Palavras-chave: revisão sistemática; triagem de artigos; rastreabilidade; ferramentas digitais; pós-graduação.',
  },
  { type: 'h', text: '1 Introdução' },
  {
    type: 'p',
    text:
      'Revisões sistemáticas tornaram-se parte central da formação de pesquisadores. Diferentemente de revisões ' +
      'narrativas, elas exigem protocolos explícitos, bases de busca documentadas e critérios de inclusão ' +
      'reprodutíveis. Na prática, porém, grande parte do esforço se concentra em tarefas repetitivas: deduplicar ' +
      'resultados de diferentes bases, ler resumos, registrar decisões e reunir citações no formato exigido.',
  },
  {
    type: 'p',
    text:
      'Ferramentas digitais prometem reduzir esse esforço, mas pouco se sabe sobre como pesquisadores iniciantes ' +
      'as incorporam ao próprio fluxo de trabalho. Este artigo descreve um estudo exploratório que acompanhou ' +
      'esse uso e identificou quais práticas estão associadas a revisões mais rápidas e mais confiáveis.',
  },
  { type: 'h', text: '2 Trabalhos relacionados' },
  {
    type: 'p',
    text:
      'Estudos anteriores descrevem ganhos de produtividade com triagem assistida (Almeida; Prado, 2019) e com ' +
      'modelos de linguagem aplicados à extração de dados (Nogueira et al., 2023). Outros autores alertam para ' +
      'riscos de viés quando critérios de exclusão não são registrados (Ferraz, 2021). Nosso trabalho se ' +
      'diferencia por observar o processo completo, da busca inicial à redação da síntese.',
  },
  { type: 'pageBreak' },
  { type: 'h', text: '3 Metodologia' },
  {
    type: 'p',
    text:
      'Participaram 48 estudantes de mestrado e doutorado de seis programas de pós-graduação. Cada participante ' +
      'conduziu uma revisão curta, com pergunta de pesquisa previamente definida, ao longo de quatro semanas. ' +
      'Registramos o tempo dedicado a cada etapa por meio de um diário de pesquisa estruturado e aplicamos um ' +
      'questionário sobre confiança nos resultados ao final do período.',
  },
  {
    type: 'p',
    text:
      'Os participantes foram divididos em dois grupos: o grupo A utilizou critérios de inclusão escritos e um ' +
      'registro de decisões compartilhado; o grupo B conduziu a triagem sem registro formal. Ambos os grupos ' +
      'tiveram acesso às mesmas bases bibliográficas e ao mesmo gerenciador de referências.',
  },
  { type: 'pageBreak' },
  { type: 'h', text: '4 Resultados' },
  {
    type: 'p',
    text:
      'A Tabela 1 resume o tempo médio, em horas, gasto em cada etapa. O grupo A concluiu a triagem em menos ' +
      'tempo e relatou maior confiança na seleção final de artigos.',
  },
  {
    type: 'table',
    caption: 'Tabela 1 - Tempo médio por etapa (horas)',
    rows: [
      ['Etapa', 'Grupo A', 'Grupo B'],
      ['Busca', '6,1', '6,4'],
      ['Triagem', '9,8', '14,2'],
      ['Extração', '11,5', '12,0'],
      ['Síntese', '8,7', '9,9'],
    ],
  },
  {
    type: 'p',
    text:
      `Também calculamos um ${SENTINELS.search} para cada revisão, definido como a proporção de novos ` +
      'artigos lidos que não acrescentaram categorias à síntese. Revisões do grupo A atingiram saturação mais ' +
      'cedo, o que sugere critérios de busca mais bem delimitados.',
  },
  { type: 'pageBreak' },
  { type: 'h', text: '5 Discussão' },
  {
    type: 'p',
    text:
      'Os resultados indicam que o ganho de tempo não decorre apenas da ferramenta utilizada, mas da combinação ' +
      'entre software e disciplina de registro. Participantes que anotavam o motivo de cada exclusão revisitaram ' +
      'menos artigos e produziram sínteses mais consistentes. Recomendamos que programas de pós-graduação ' +
      'incluam, na formação metodológica, a prática de manter um diário de pesquisa e categorias explícitas ' +
      'para a classificação de artigos.',
  },
  { type: 'h', text: '6 Conclusão' },
  {
    type: 'p',
    text:
      'Ferramentas digitais aceleram revisões sistemáticas quando acompanhadas de rastreabilidade: critérios ' +
      'escritos, decisões registradas e citações geradas a partir de metadados confiáveis. Estudos futuros ' +
      'devem avaliar esse efeito em revisões mais longas e em outras áreas do conhecimento.',
  },
  { type: 'h', text: 'Referências' },
  {
    type: 'ref',
    text: 'ALMEIDA, J.; PRADO, L. Triagem assistida em revisões de literatura. Revista de Métodos, v. 4, n. 2, p. 10-25, 2019.',
  },
  {
    type: 'ref',
    text: 'FERRAZ, R. Viés de seleção em revisões conduzidas sem protocolo. Cadernos de Pesquisa Aplicada, v. 8, p. 55-70, 2021.',
  },
  {
    type: 'ref',
    text: 'NOGUEIRA, P. et al. Modelos de linguagem na extração de dados de artigos científicos. Anais do Simpósio de Ciência de Dados, p. 201-212, 2023.',
  },
  {
    type: 'ref',
    text: 'SILVA, T. Diários de pesquisa como instrumento de reflexão metodológica. Educação e Pesquisa, v. 15, n. 1, p. 88-104, 2020.',
  },
];

module.exports = { METADATA, SENTINELS, BLOCKS };
