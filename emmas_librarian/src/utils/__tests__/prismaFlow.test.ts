import { describe, it, expect } from 'vitest';
import { brazilianDate, prismaFlow, prismaTableCsv, NOT_RETRIEVED_KEY, type PrismaInput } from '../prismaFlow';
import { baseName, searchContribution } from '../prismaSearches';
import type {
  Article,
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

const search = (id: number, breakdown: object, unique: number | null, added: number): SearchHistoryItem => ({
  id,
  unified_query: 'q',
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

// A project that closes at every step: 18 results (10 + 8), 15 unique, 12 new to the project, 1 article added by
// hand, 1 marked duplicate; 5 excluded and 7 included at title; 1 not retrieved, 2 excluded and 4 included at full.
function closingProject(): PrismaInput {
  const articles = [...range(1, 12).map((id) => article(id)), article(13, { search_id: undefined })];
  const decisions = [
    decide(13, DUP),
    ...range(1, 5).map((id) => decide(id, EXC)),
    ...range(6, 12).map((id) => decide(id, INC)),
    decide(6, NOT_RETRIEVED, 'full'),
    ...[7, 8].map((id) => decide(id, POPULATION, 'full')),
    ...range(9, 12).map((id) => decide(id, INC, 'full')),
  ];
  return {
    searches: [search(1, { openalex: { count: 10, requested: 50 }, scopus: { count: 8, requested: 50 } }, 15, 12)],
    articles,
    labels: LABELS,
    decisions,
    manual: [],
  };
}

describe('prismaFlow (#50): a project that closes', () => {
  const flow = prismaFlow(closingProject());

  it('counts every box from the searches, articles and decisions', () => {
    const numbers = Object.fromEntries(
      (
        [
          'identified',
          'removed',
          'screened',
          'excluded',
          'sought',
          'notRetrieved',
          'assessed',
          'reasons',
          'included',
        ] as const
      ).map((k) => [k, flow[k].n]),
    );

    expect(numbers).toEqual({
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
    expect(Object.values(flow).flatMap((b) => ('warnings' in b ? b.warnings : []))).toEqual([]);
  });

  it('says which articles make up a box and splits exclusions by label', () => {
    expect(flow.included.articleIds).toEqual([9, 10, 11, 12]);
    expect(flow.reasons.lines).toEqual([{ label: 'População diferente', n: 2 }]);
    expect(flow.removed.lines.map((l) => [l.label, l.n])).toEqual([
      ['Duplicados entre bases', 3],
      ['Já estavam no projeto (buscas anteriores)', 3],
      ['Marcados como duplicado na triagem', 1],
    ]);
  });

  it('counts other sources from the articles added outside searches', () => {
    expect(flow.identified.lines.at(-1)).toEqual({ label: 'Outras fontes', n: 1, note: 'contado pelo app' });
  });
});

describe('prismaFlow (#50): steps that do not close', () => {
  it('warns on the screened box when articles are still undecided or in doubt at title', () => {
    const input = closingProject();
    input.decisions = input.decisions.map((d) =>
      d.article_id === 5 && d.stage === 'title' ? { ...d, label_id: MAYBE } : d,
    );

    const flow = prismaFlow(input);

    expect(flow.screened.warnings).toEqual([
      {
        kind: 'mismatch',
        text: 'Não fecha: 12 triados ≠ 4 excluídos + 7 buscados. 1 sem decisão ou em dúvida no título e resumo.',
      },
    ]);
  });

  it('warns on the assessed box when full texts are still undecided', () => {
    const input = closingProject();
    input.decisions = input.decisions.filter((d) => !(d.article_id === 12 && d.stage === 'full'));

    expect(prismaFlow(input).assessed.warnings[0].text).toContain('1 sem decisão ou em dúvida no texto completo');
  });

  it('warns when the identification does not lead to the screened articles, and keeps the hand-typed number', () => {
    const input = closingProject();
    input.manual = [{ count_key: 'other_sources', value: 3, updated_at: '2026-10-30 08:00:00' }];

    const flow = prismaFlow(input);

    expect(flow.identified.lines.at(-1)).toEqual({
      label: 'Outras fontes',
      n: 3,
      note: 'editado manualmente em 30/10/2026',
    });
    expect(flow.screened.warnings[0].text).toContain('entrariam 14 na triagem (21 − 7); o projeto tem 12');
  });
});

describe('prismaFlow (#50): what the app cannot know or count', () => {
  it('leaves an old search without data, never estimated, and does not check that step', () => {
    const input = closingProject();
    input.searches.push(search(2, { arxiv: { count: 27 } }, null, 27));

    const flow = prismaFlow(input);

    expect(flow.removed.lines.slice(0, 2).map((l) => l.n)).toEqual([null, null]);
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

describe('prisma helpers (#50)', () => {
  it('writes the data table with every box and line, "sem dados" where unknown', () => {
    const input = closingProject();
    input.searches.push(search(2, { arxiv: { count: 27 } }, null, 27));

    const csv = prismaTableCsv(prismaFlow(input)).split('\n');

    expect(csv[0]).toBe('"Caixa","Linha","n","De onde vem","Aviso"');
    expect(csv).toContain('"Registros removidos antes da triagem","Duplicados entre bases","sem dados","",""');
    expect(csv.some((row) => row.startsWith('"Estudos incluídos na revisão","","4"'))).toBe(true);
  });

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
