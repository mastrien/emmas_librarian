import type { Article } from '../../types';
import { baseName, type SearchContribution } from '../prismaSearches';
import { box, Decisions, groupByLabel, sum } from './prismaDecisions';
import { NOT_RETRIEVED_KEY, type PrismaBox, type PrismaWarning } from './prismaTypes';

// Titles of the official Brazilian Portuguese translation of PRISMA 2020 (Galvão & Tiguman, RESS 2022).
const TEXT = {
  identified: {
    title: 'Registros identificados',
    how: 'Soma dos resultados de cada base em todas as buscas salvas do projeto, antes de tirar duplicados.',
  },
  removed: {
    title: 'Registros removidos antes da triagem',
    how: 'Registros duplicados: o mesmo artigo vindo de mais de uma base, de buscas anteriores, ou marcado como duplicado na triagem. O app não usa ferramentas de automação nem remove registros por outros motivos, então essas linhas do modelo não aparecem.',
  },
  screened: {
    title: 'Registros triados',
    how: 'Artigos das buscas que entram na triagem por título e resumo: todos, menos os marcados como duplicado.',
  },
  excluded: {
    title: 'Registros excluídos',
    how: 'Artigos das buscas com rótulo de exclusão na triagem por título e resumo, mais os arquivados na página do projeto sem rótulo, que aparecem como categoria própria em vez de sumir.',
  },
  sought: {
    title: 'Publicações recuperadas',
    how: 'Artigos das buscas incluídos na triagem por título e resumo, que seguem para o texto completo.',
  },
  notRetrieved: {
    title: 'Publicações não recuperadas',
    how: 'Artigos das buscas com o rótulo "Texto completo não recuperado" na etapa de texto completo.',
  },
  assessed: {
    title: 'Publicações avaliadas para elegibilidade',
    how: 'Recuperadas menos não recuperadas: os textos completos a ler e decidir.',
  },
  reasons: {
    title: 'Publicações excluídas',
    how: 'Artigos das buscas com rótulo de exclusão no texto completo, agrupados pelo rótulo, que é o motivo.',
  },
};

function identifiedBox(articles: Article[], searches: SearchContribution[]): PrismaBox {
  const perBase = new Map<string, number>();
  searches.flatMap((s) => s.bases).forEach((b) => perBase.set(b.base, (perBase.get(b.base) ?? 0) + b.count));
  const lines = [...perBase.entries()].map(([base, n]) => ({ label: baseName(base), n }));
  const result = { ...box('identified', 'databases', TEXT.identified, articles, lines), n: sum([...perBase.values()]) };
  result.warnings = searches.flatMap((s) =>
    s.bases
      .filter((b) => b.partial)
      .map((b) => ({
        kind: 'partial' as const,
        text: `${baseName(b.base)} na busca #${s.searchId} devolveu o limite pedido (${b.count}): a busca pode ser parcial.`,
      })),
  );
  return result;
}

function removedBox(searches: SearchContribution[], duplicates: Article[]): PrismaBox {
  const known = searches.filter((s) => s.unique !== null);
  const unknown = searches.filter((s) => s.unique === null);
  const between = sum(known.map((s) => s.found - s.unique!));
  const already = sum(known.map((s) => s.unique! - s.added!));
  const total = between + already + duplicates.length;
  const result = box('removed', 'databases', TEXT.removed, duplicates, [
    { label: 'Registros duplicados removidos', n: unknown.length ? null : total },
  ]);
  result.n = total;
  result.details = [
    { label: 'Duplicados entre bases', n: unknown.length ? null : between },
    { label: 'Já estavam no projeto (buscas anteriores)', n: unknown.length ? null : already },
    { label: 'Marcados como duplicado na triagem', n: duplicates.length },
  ];
  if (unknown.length) result.warnings.push(noDataWarning(unknown));
  return result;
}

function noDataWarning(unknown: SearchContribution[]): PrismaWarning {
  const which = unknown.map((s) => `#${s.searchId}`).join(', ');
  return {
    kind: 'nodata',
    text: `Busca ${which}: salva antes de o app registrar quantos resultados eram únicos e novos. Os duplicados dela ficam "sem dados", nunca estimados, e esta etapa não pode ser conferida.`,
  };
}

function screeningBoxes(articles: Article[], d: Decisions) {
  const duplicates = d.withKind(articles, 'title', 'removed');
  const pool = articles.filter((a) => !duplicates.includes(a));
  const unlabeled = d.archivedUnlabeled(pool);
  const excludedTitle = d.withKind(pool, 'title', 'exclude');
  const excluded = box(
    'excluded',
    'databases',
    TEXT.excluded,
    [...excludedTitle, ...unlabeled],
    [
      ...groupByLabel(excludedTitle, d, 'title'),
      ...(unlabeled.length ? [{ label: 'Arquivado sem rótulo', n: unlabeled.length }] : []),
    ],
  );
  const sought = d.withKind(pool, 'title', 'include');
  const pending = pool.filter((a) => !excluded.articleIds.includes(a.id) && !sought.includes(a));
  return { duplicates, pool, excluded, sought, pending };
}

function fullTextBoxes(sought: Article[], d: Decisions) {
  const notRetrieved = sought.filter((a) => d.labelAt(a.id, 'full')?.preset_key === NOT_RETRIEVED_KEY);
  const assessed = sought.filter((a) => !notRetrieved.includes(a));
  const reasons = d.withKind(assessed, 'full', 'exclude');
  const included = d.withKind(assessed, 'full', 'include');
  return {
    notRetrieved: box('notRetrieved', 'databases', TEXT.notRetrieved, notRetrieved),
    assessed: box('assessed', 'databases', TEXT.assessed, assessed),
    reasons: box('reasons', 'databases', TEXT.reasons, reasons, groupByLabel(reasons, d, 'full')),
    included,
    pending: assessed.filter((a) => !reasons.includes(a) && !included.includes(a)),
  };
}

/**
 * The warning of a step whose outputs do not reach its input yet because articles still wait for a decision:
 * the numbers are right, the count closes once they are decided (user feedback on the #50 prototype).
 *
 * @example pendingWarning(3, 'na triagem por título e resumo', '52 excluídos + 29 recuperados', 84)
 */
export function pendingWarning(count: number, where: string, outputs: string, input: number): PrismaWarning {
  return {
    kind: 'pending',
    text: `Triagem em andamento: ${count} artigo(s) ainda "Em dúvida" ou sem decisão ${where}. Por isso ${outputs} não somam ${input}. Os números estão certos; a conta fecha quando você decidir esses artigos.`,
  };
}

function checkScreened(boxes: DatabaseBoxes, pending: Article[]): void {
  const { identified, removed, screened, excluded, sought } = boxes;
  const fromIdentification = identified.n - removed.n;
  if (!removed.warnings.some((w) => w.kind === 'nodata') && fromIdentification !== screened.n) {
    screened.warnings.push({
      kind: 'mismatch',
      text: `Pela identificação, entrariam ${fromIdentification} na triagem (${identified.n} − ${removed.n}); o projeto tem ${screened.n}. A diferença pode ser de artigos apagados do projeto.`,
    });
  }
  if (!pending.length) return;
  const outputs = `${excluded.n} excluídos + ${sought.n} recuperados`;
  screened.warnings.push(pendingWarning(pending.length, 'na triagem por título e resumo', outputs, screened.n));
}

export type DatabaseBoxes = Record<
  'identified' | 'removed' | 'screened' | 'excluded' | 'sought' | 'notRetrieved' | 'assessed' | 'reasons',
  PrismaBox
>;

/**
 * The databases column of the PRISMA 2020 diagram, from the structured searches and the articles they brought.
 * Answers its boxes and the publications it includes, which the included box sums with the other column.
 *
 * @example databaseColumn(articles, searches, decisions).boxes.screened.n // 84
 */
export function databaseColumn(articles: Article[], searches: SearchContribution[], d: Decisions) {
  const screening = screeningBoxes(articles, d);
  const full = fullTextBoxes(screening.sought, d);
  const boxes: DatabaseBoxes = {
    identified: identifiedBox(articles, searches),
    removed: removedBox(searches, screening.duplicates),
    screened: box('screened', 'databases', TEXT.screened, screening.pool),
    excluded: screening.excluded,
    sought: box('sought', 'databases', TEXT.sought, screening.sought),
    notRetrieved: full.notRetrieved,
    assessed: full.assessed,
    reasons: full.reasons,
  };
  checkScreened(boxes, screening.pending);
  if (full.pending.length) {
    const outputs = `${boxes.reasons.n} excluídas + ${full.included.length} incluídas`;
    boxes.assessed.warnings.push(pendingWarning(full.pending.length, 'no texto completo', outputs, boxes.assessed.n));
  }
  return { boxes, included: full.included };
}
