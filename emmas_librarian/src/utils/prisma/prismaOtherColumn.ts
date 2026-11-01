import type { Article, PrismaRecords, PrismaSourceMethod } from '../../types';
import { box, Decisions, groupByLabel } from './prismaDecisions';
import { pendingWarning } from './prismaDatabaseColumn';
import { NOT_RETRIEVED_KEY, type PrismaBox, type PrismaLine } from './prismaTypes';

/** The "other methods" of PRISMA 2020 as the person picks them, in the template's order. */
export const METHOD_NAMES: Record<PrismaSourceMethod, string> = {
  citations: 'Buscas por citações',
  websites: 'Sites e buscadores',
  organisations: 'Organizações',
  app_projects: 'Outros projetos do app',
  other: 'Outros',
};

const TEXT = {
  identified: {
    title: 'Registros identificados',
    how: 'Artigos que entraram no projeto fora das buscas (adição manual, importação de PDFs, importação de outro projeto), contados pelo método da origem de cada um. Ninguém digita número: o app conta os artigos.',
  },
  sought: {
    title: 'Publicações recuperadas',
    how: 'Os artigos de fora das buscas seguem direto para o texto completo, como no modelo PRISMA: esta coluna não tem triagem por título nem caixa de duplicados.',
  },
  notRetrieved: {
    title: 'Publicações não recuperadas',
    how: 'Artigos de fora das buscas com o rótulo "Texto completo não recuperado".',
  },
  assessed: { title: 'Publicações avaliadas para elegibilidade', how: 'Recuperadas menos não recuperadas.' },
  reasons: {
    title: 'Publicações excluídas',
    how: 'Artigos de fora das buscas com rótulo de exclusão, agrupados pelo rótulo. Uma exclusão feita já no título e resumo entra aqui, com o rótulo como motivo, porque esta coluna não tem triagem por título.',
  },
};

/**
 * The method each article came by, through the source the person said it came from; undefined when not told.
 *
 * @example methodOf(records)(42) // 'websites'
 */
export function methodOf(records: PrismaRecords): (articleId: number) => PrismaSourceMethod | undefined {
  const methods = new Map(records.sources.map((s) => [s.id, s.method]));
  const origins = new Map(records.origins.map((o) => [o.article_id, methods.get(o.source_id)]));
  return (articleId) => origins.get(articleId);
}

function identifiedBox(articles: Article[], records: PrismaRecords): PrismaBox {
  const method = methodOf(records);
  const lines: PrismaLine[] = (Object.keys(METHOD_NAMES) as PrismaSourceMethod[])
    .map((m) => ({ label: METHOD_NAMES[m], n: articles.filter((a) => method(a.id) === m).length }))
    .filter((l) => l.n > 0);
  const result = box('omIdentified', 'other', TEXT.identified, articles, lines);
  const untold = articles.filter((a) => method(a.id) === undefined).length;
  if (untold) {
    result.warnings.push({
      kind: 'pending',
      text: `${untold} artigo(s) ainda sem origem informada. Eles contam no total desta coluna, mas não aparecem em nenhum método até você dizer de onde vieram. Os números estão certos; falta só a informação.`,
    });
  }
  return result;
}

// Title-stage exclusions and duplicates are reported here, with "(título e resumo)" after the label's name.
function reasonsBox(assessed: Article[], d: Decisions): PrismaBox {
  const full = d.withKind(assessed, 'full', 'exclude');
  const atTitle = assessed.filter(
    (a) => !full.includes(a) && ['exclude', 'removed'].includes(d.kindAt(a.id, 'title') ?? ''),
  );
  const unlabeled = d.archivedUnlabeled(assessed);
  const titleLines = groupByLabel(atTitle, d, 'title').map((l) => ({ ...l, label: `${l.label} (título e resumo)` }));
  return box(
    'omReasons',
    'other',
    TEXT.reasons,
    [...full, ...atTitle, ...unlabeled],
    [
      ...groupByLabel(full, d, 'full'),
      ...titleLines,
      ...(unlabeled.length ? [{ label: 'Arquivado sem rótulo', n: unlabeled.length }] : []),
    ],
  );
}

export type OtherBoxes = Record<'omIdentified' | 'omSought' | 'omNotRetrieved' | 'omAssessed' | 'omReasons', PrismaBox>;

/**
 * The "other methods" column of PRISMA 2020: the articles that came from outside the structured searches go
 * straight to retrieval, as in the template. Answers its boxes and the publications it includes.
 *
 * @example otherColumn(outside, records, decisions).boxes.omIdentified.lines // [{ label: 'Sites e buscadores', n: 1 }]
 */
export function otherColumn(articles: Article[], records: PrismaRecords, d: Decisions) {
  const notRetrieved = articles.filter((a) => d.labelAt(a.id, 'full')?.preset_key === NOT_RETRIEVED_KEY);
  const assessed = articles.filter((a) => !notRetrieved.includes(a));
  const reasons = reasonsBox(assessed, d);
  const included = d.withKind(assessed, 'full', 'include').filter((a) => !reasons.articleIds.includes(a.id));
  const boxes: OtherBoxes = {
    omIdentified: identifiedBox(articles, records),
    omSought: box('omSought', 'other', TEXT.sought, articles),
    omNotRetrieved: box('omNotRetrieved', 'other', TEXT.notRetrieved, notRetrieved),
    omAssessed: box('omAssessed', 'other', TEXT.assessed, assessed),
    omReasons: reasons,
  };
  const pending = assessed.filter((a) => !reasons.articleIds.includes(a.id) && !included.includes(a));
  if (pending.length) {
    const outputs = `${reasons.n} excluídas + ${included.length} incluídas`;
    boxes.omAssessed.warnings.push(pendingWarning(pending.length, 'no texto completo', outputs, assessed.length));
  }
  return { boxes, included };
}
