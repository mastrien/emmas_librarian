import { describe, it, expect } from 'vitest';
import { brazilianDate, prismaFlow, prismaOrder, NOT_RETRIEVED_KEY, type PrismaInput } from '../prismaFlow';
import { baseName, searchContribution } from '../prismaSearches';
import { excludedReports, prismaDataCsv, prismaExcludedCsv, referenceOf } from '../prisma/prismaTables';
import type {
  Article,
  PrismaRecords,
  ScreeningDecision,
  ScreeningKind,
  ScreeningLabel,
  ScreeningStage,
  SearchHistoryItem,
} from '../../types';

const label = (id: number, name: string, kind: ScreeningKind, preset_key: string | null = null): ScreeningLabel => ({
  id,
  project_id: 1,
  name,
  kind,
  position: id,
  preset_key,
  created_at: '',
});
const LABELS = [
  label(1, 'Incluso', 'include'),
  label(2, 'Em dúvida', 'maybe'),
  label(3, 'Excluído', 'exclude'),
  label(4, 'Duplicado', 'removed'),
  label(5, 'Texto completo não recuperado', 'exclude', NOT_RETRIEVED_KEY),
  label(6, 'População diferente', 'exclude'),
];
const INC = 1;
const MAYBE = 2;
const EXC = 3;
const DUP = 4;
const NOT_RETRIEVED = 5;
const POPULATION = 6;

const search = (
  id: number,
  breakdown: object,
  unique: number | null,
  added: number,
  query = 'q',
): SearchHistoryItem => ({
  id,
  unified_query: query,
  translated_queries: '{}',
  total_results: added,
  results_breakdown: JSON.stringify(breakdown),
  created_at: '2026-09-12 10:00:00',
  unique_results: unique,
});
const article = (id: number, extra: Partial<Article> = {}): Article =>
  ({ id, project_id: 1, title: `A${id}`, status: 'new', search_id: 1, ...extra }) as Article;
let decisionId = 0;
const decide = (articleId: number, labelId: number, stage: ScreeningStage = 'title'): ScreeningDecision => ({
  id: ++decisionId,
  article_id: articleId,
  label_id: labelId,
  stage,
  note: null,
  status_before: null,
  decided_at: '',
});
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const NO_RECORDS: PrismaRecords = { sources: [], origins: [], studyLinks: [] };

// A databases-only project that closes at every step: 19 results (10 + 9), 16 unique, 13 new to the project, 1
// marked duplicate; 5 excluded and 7 included at title; 1 not retrieved, 2 excluded and 4 included at full text.
function closingProject(): PrismaInput {
  const decisions = [
    decide(13, DUP),
    ...range(1, 5).map((id) => decide(id, EXC)),
    ...range(6, 12).map((id) => decide(id, INC)),
    decide(6, NOT_RETRIEVED, 'full'),
    ...[7, 8].map((id) => decide(id, POPULATION, 'full')),
    ...range(9, 12).map((id) => decide(id, INC, 'full')),
  ];
  return {
    searches: [search(1, { openalex: { count: 10, requested: 50 }, scopus: { count: 9, requested: 50 } }, 16, 13)],
    articles: range(1, 13).map((id) => article(id)),
    labels: LABELS,
    decisions,
    records: { ...NO_RECORDS },
  };
}

// The same project plus 4 articles from outside the searches: two added by hand (from Google Scholar), one copied
// from another project, one older than the history (origin untold). 21 is included, 22 excluded at title, 23 not
// retrieved, 24 excluded at full text.
function withOtherMethods(): PrismaInput {
  const input = closingProject();
  input.searches.push(
    search(2, { Manual: { count: 2 } }, null, 2, 'Adição manual de artigo avulso: A21'),
    search(3, { import: { count: 1 } }, null, 1, "Importação de artigos do projeto 'Chuvas'"),
  );
  input.articles.push(
    article(21, { search_id: 2 }),
    article(22, { search_id: 3 }),
    article(23, { search_id: undefined }),
  );
  input.articles.push(article(24, { search_id: 2 }));
  input.decisions.push(decide(21, INC, 'full'), decide(22, EXC), decide(23, NOT_RETRIEVED, 'full'));
  input.decisions.push(decide(24, POPULATION, 'full'));
  input.records = {
    sources: [
      { id: 1, project_id: 1, name: 'Google Scholar', method: 'websites', url: null, consulted_on: '2026-10-20' },
      { id: 2, project_id: 1, name: 'Projeto "Chuvas"', method: 'app_projects', url: null, consulted_on: null },
    ],
    origins: [
      { article_id: 21, source_id: 1 },
      { article_id: 24, source_id: 1 },
      { article_id: 22, source_id: 2 },
    ],
    studyLinks: [],
  };
  return input;
}

const numbers = (flow: ReturnType<typeof prismaFlow>) =>
  Object.fromEntries(prismaOrder(flow).map((k) => [k, flow[k].n]));

describe('prismaFlow (#50): the databases column of a project that closes', () => {
  const flow = prismaFlow(closingProject());

  it('counts every box from the searches, articles and decisions, in one column', () => {
    expect(flow.otherMethods).toBe(false);
    expect(numbers(flow)).toEqual({
      identified: 19,
      removed: 7,
      screened: 12,
      excluded: 5,
      sought: 7,
      notRetrieved: 1,
      assessed: 6,
      reasons: 2,
      included: 4,
    });
  });

  it('warns about nothing', () => {
    expect(prismaOrder(flow).flatMap((k) => flow[k].warnings)).toEqual([]);
  });

  it('draws one duplicates line and keeps where they came from for the panel and the table', () => {
    expect(flow.removed.lines).toEqual([{ label: 'Registros duplicados removidos', n: 7 }]);
    expect(flow.removed.details.map((l) => [l.label, l.n])).toEqual([
      ['Duplicados entre bases', 3],
      ['Já estavam no projeto (buscas anteriores)', 3],
      ['Marcados como duplicado na triagem', 1],
    ]);
  });

  it('says which articles make up a box, splits exclusions by label and counts studies and publications', () => {
    expect(flow.included.articleIds).toEqual([9, 10, 11, 12]);
    expect(flow.included.lines).toEqual([{ label: 'Publicações dos estudos incluídos', n: 4 }]);
    expect(flow.reasons.lines).toEqual([{ label: 'População diferente', n: 2 }]);
    expect(flow.identified.lines).toEqual([
      { label: 'OpenAlex', n: 10 },
      { label: 'Scopus', n: 9 },
    ]);
  });
});

describe('prismaFlow (#50): steps waiting for decisions, and numbers that do not agree', () => {
  it('says the screening is under way, not that the count is wrong, when articles wait at title', () => {
    const input = closingProject();
    input.decisions = input.decisions.map((d) =>
      d.article_id === 5 && d.stage === 'title' ? { ...d, label_id: MAYBE } : d,
    );

    expect(prismaFlow(input).screened.warnings).toEqual([
      {
        kind: 'pending',
        text: 'Triagem em andamento: 1 artigo(s) ainda "Em dúvida" ou sem decisão na triagem por título e resumo. Por isso 4 excluídos + 7 recuperados não somam 12. Os números estão certos; a conta fecha quando você decidir esses artigos.',
      },
    ]);
  });

  it('says the same on the assessed box when full texts are still undecided', () => {
    const input = closingProject();
    input.decisions = input.decisions.filter((d) => !(d.article_id === 12 && d.stage === 'full'));

    const [warning] = prismaFlow(input).assessed.warnings;
    expect(warning.kind).toBe('pending');
    expect(warning.text).toContain('2 excluídas + 3 incluídas não somam 6');
  });

  it('warns that numbers do not agree when an article of a search is gone from the project', () => {
    const input = closingProject();
    input.articles = input.articles.filter((a) => a.id !== 1);

    const [warning] = prismaFlow(input).screened.warnings;
    expect(warning.kind).toBe('mismatch');
    expect(warning.text).toContain('entrariam 12 na triagem (19 − 7); o projeto tem 11');
  });
});

describe('prismaFlow (#50): what the app cannot know or count', () => {
  it('leaves an old search without data, never estimated, and does not check that step', () => {
    const input = closingProject();
    input.searches.push(search(2, { arxiv: { count: 27 } }, null, 27));

    const flow = prismaFlow(input);

    expect(flow.removed.lines).toEqual([{ label: 'Registros duplicados removidos', n: null }]);
    expect(flow.removed.warnings).toEqual([
      expect.objectContaining({ kind: 'nodata', text: expect.stringContaining('Busca #2') }),
    ]);
    expect(flow.screened.warnings).toEqual([]);
  });

  it('says a base that returned its limit may be partial', () => {
    const input = closingProject();
    input.searches = [
      search(1, { scopus: { count: 100, requested: 100 }, openalex: { count: 3, available: 9 } }, 90, 80),
    ];

    expect(prismaFlow(input).identified.warnings.map((w) => w.text)).toEqual([
      'Scopus na busca #1 devolveu o limite pedido (100): a busca pode ser parcial.',
      'OpenAlex na busca #1 devolveu o limite pedido (3): a busca pode ser parcial.',
    ]);
  });

  it('shows articles archived on the project page without a label as a category of their own', () => {
    const input = closingProject();
    input.articles.push(article(20, { status: 'archived' }));

    const flow = prismaFlow(input);

    expect(flow.excluded.lines.at(-1)).toEqual({ label: 'Arquivado sem rótulo', n: 1 });
    expect(flow.excluded.n).toBe(6);
  });
});

describe('prismaFlow (#50): the "other methods" column', () => {
  const flow = prismaFlow(withOtherMethods());

  it('takes the articles added by hand, copied from a project or older than the history, and no base "Manual"', () => {
    expect(flow.otherMethods).toBe(true);
    expect(flow.omIdentified.articleIds).toEqual([21, 22, 23, 24]);
    expect(flow.identified.lines.map((l) => l.label)).toEqual(['OpenAlex', 'Scopus']);
    expect(numbers(flow)).toMatchObject({ identified: 19, removed: 7, screened: 12 });
  });

  it('counts by the method of each origin, and waits for the origin it was not told', () => {
    expect(flow.omIdentified.lines).toEqual([
      { label: 'Sites e buscadores', n: 2 },
      { label: 'Outros projetos do app', n: 1 },
    ]);
    expect(flow.omIdentified.warnings).toEqual([
      expect.objectContaining({ kind: 'pending', text: expect.stringContaining('1 artigo(s) ainda sem origem') }),
    ]);
  });

  it('goes straight to retrieval and reports title exclusions with the reasons', () => {
    expect(numbers(flow)).toMatchObject({ omSought: 4, omNotRetrieved: 1, omAssessed: 3, omReasons: 2 });
    expect(flow.omReasons.lines).toEqual([
      { label: 'População diferente', n: 1 },
      { label: 'Excluído (título e resumo)', n: 1 },
    ]);
  });

  it('sums the included publications of both columns', () => {
    expect(flow.included.articleIds).toEqual([9, 10, 11, 12, 21]);
    expect(flow.included.n).toBe(5);
  });

  it('counts publications marked as of the same study once, and names them for the panel', () => {
    const input = withOtherMethods();
    input.records.studyLinks = [{ article_id: 21, study_article_id: 9 }];

    const included = prismaFlow(input).included;

    expect(included.n).toBe(4);
    expect(included.lines).toEqual([{ label: 'Publicações dos estudos incluídos', n: 5 }]);
    expect(included.details).toEqual([{ label: '1 estudo: A9 + A21', n: 2 }]);
  });
});

describe('PRISMA tables (#50)', () => {
  const input = withOtherMethods();
  const flow = prismaFlow(input);

  it('writes the data table with the column of every box, its lines and details, "sem dados" where unknown', () => {
    const old = closingProject();
    old.searches.push(search(2, { arxiv: { count: 27 } }, null, 27));
    const oldFlow = prismaFlow(old);

    const csv = prismaDataCsv(oldFlow, prismaOrder(oldFlow)).split('\n');

    expect(csv[0]).toBe('"Coluna","Caixa","Linha","n","De onde vem","Aviso"');
    expect(csv).toContain(
      '"Bases de dados e repositórios","Registros removidos antes da triagem","Duplicados entre bases","sem dados","",""',
    );
    expect(csv.some((row) => row.startsWith('"As duas colunas","Estudos incluídos na revisão","","4"'))).toBe(true);
  });

  it('lists the reports excluded at full text or not retrieved, with reason and origin (item 16b)', () => {
    expect(excludedReports(input, flow).map((r) => [r.articleId, r.stage, r.reason, r.origin])).toEqual([
      [7, 'Texto completo', 'População diferente', 'Busca #1 · OpenAlex, Scopus'],
      [8, 'Texto completo', 'População diferente', 'Busca #1 · OpenAlex, Scopus'],
      [6, 'Texto completo', 'Texto completo não recuperado', 'Busca #1 · OpenAlex, Scopus'],
      [24, 'Texto completo', 'População diferente', 'Outros métodos · Google Scholar (Sites e buscadores)'],
      [22, 'Título e resumo', 'Excluído', 'Outros métodos · Projeto "Chuvas" (Outros projetos do app)'],
      [23, 'Texto completo', 'Texto completo não recuperado', 'Outros métodos · origem não informada'],
    ]);
    expect(prismaExcludedCsv(input, flow).split('\n')[0]).toBe('"Referência","Etapa","Motivo","Origem"');
  });

  it('writes a reference with what the article has', () => {
    const paper = { authors: 'Shi X; Chen Z', title: 'ConvLSTM.', journal: 'NeurIPS', year: 2015, doi: '10.1/x' };
    expect(referenceOf(paper as Article)).toBe('Shi X; Chen Z. ConvLSTM. NeurIPS, 2015. DOI: 10.1/x.');
    expect(referenceOf({ title: 'Só o título' } as Article)).toBe('Só o título.');
  });
});

describe('prisma helpers (#50)', () => {
  it('reads a search that failed on a base without counting that base', () => {
    const contribution = searchContribution(
      search(3, { wos: { count: 0, error: 'sem chave' }, crossref: { count: 4 } }, 4, 4),
    );

    expect(contribution.bases).toEqual([{ base: 'crossref', count: 4, partial: false }]);
  });

  it('names bases and writes dates as people read them', () => {
    expect([baseName('wos'), baseName('nova')]).toEqual(['Web of Science', 'nova']);
    expect(brazilianDate('2026-10-30 08:00:00')).toBe('30/10/2026');
  });
});
