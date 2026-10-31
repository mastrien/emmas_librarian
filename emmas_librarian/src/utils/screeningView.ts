import type { Article, ScreeningDecision, ScreeningKind, ScreeningLabel, ScreeningStage } from '../types';

/** An article as the review page shows it: with its current decision and that decision's label. */
export interface ReviewRow {
  article: Article;
  decision: ScreeningDecision | null;
  label: ScreeningLabel | null;
}

/** One label's articles (a section of the page, or a group inside "Excluídos"). */
export interface LabelGroup {
  label: ScreeningLabel;
  rows: ReviewRow[];
}

/** How many articles each kind holds, plus the undecided ones and those archived by hand without a label. */
export interface ReviewCounts {
  include: number;
  maybe: number;
  exclude: number;
  removed: number;
  pending: number;
  unlabeled: number;
}

/** Everything the review page lists, already grouped (#49). */
export interface ReviewView {
  sections: LabelGroup[];
  excluded: LabelGroup[];
  unlabeled: ReviewRow[];
  pending: ReviewRow[];
  counts: ReviewCounts;
}

/**
 * Each article's current decision: the full-text one when there is one, else the title-and-abstract one.
 *
 * @example currentDecisions(decisions).get(articleId)?.stage // 'full'
 */
export function currentDecisions(decisions: ScreeningDecision[]): Map<number, ScreeningDecision> {
  const current = new Map<number, ScreeningDecision>();
  for (const decision of decisions) {
    const known = current.get(decision.article_id);
    if (!known || decision.stage === 'full') current.set(decision.article_id, decision);
  }
  return current;
}

/**
 * The stage a decision made from the list goes to: full text once the article has a full-text decision, so
 * changing a label from the list never leaves an older title decision hiding behind it.
 */
export function listStage(articleId: number, decisions: ScreeningDecision[]): ScreeningStage {
  return decisions.some((d) => d.article_id === articleId && d.stage === 'full') ? 'full' : 'title';
}

function rowsOf(articles: Article[], labels: ScreeningLabel[], decisions: ScreeningDecision[]): ReviewRow[] {
  const current = currentDecisions(decisions);
  return articles.map((article) => {
    const decision = current.get(article.id) ?? null;
    return { article, decision, label: labels.find((l) => l.id === decision?.label_id) ?? null };
  });
}

function groupsOf(labels: ScreeningLabel[], rows: ReviewRow[], kinds: ScreeningKind[]): LabelGroup[] {
  return labels
    .filter((label) => kinds.includes(label.kind))
    .map((label) => ({ label, rows: rows.filter((r) => r.label?.id === label.id) }))
    .filter((group) => group.rows.length > 0);
}

/**
 * Groups a project's articles for the review page: a section per inclusion or doubt label, the exclusions
 * grouped by label (duplicates last), the articles archived on the project page without a label, and the
 * undecided ones.
 *
 * @example buildReview(articles, labels, decisions).counts.pending // 12
 */
export function buildReview(articles: Article[], labels: ScreeningLabel[], decisions: ScreeningDecision[]): ReviewView {
  const rows = rowsOf(articles, labels, decisions);
  const unlabeled = rows.filter((r) => r.label === null && r.article.status === 'archived');
  const pending = rows.filter((r) => r.label === null && r.article.status !== 'archived');
  const count = (kind: ScreeningKind) => rows.filter((r) => r.label?.kind === kind).length;
  return {
    sections: groupsOf(labels, rows, ['include', 'maybe']),
    excluded: [...groupsOf(labels, rows, ['exclude']), ...groupsOf(labels, rows, ['removed'])],
    unlabeled,
    pending,
    counts: {
      include: count('include'),
      maybe: count('maybe'),
      exclude: count('exclude'),
      removed: count('removed'),
      pending: pending.length,
      unlabeled: unlabeled.length,
    },
  };
}

/**
 * The articles the guided screening walks through at a stage: every article not archived by hand for title and
 * abstract, and those kept (included or in doubt) at title and abstract for full text.
 */
export function guidedPool(
  articles: Article[],
  labels: ScreeningLabel[],
  decisions: ScreeningDecision[],
  stage: ScreeningStage,
): Article[] {
  const kindAt = (articleId: number, at: ScreeningStage) => {
    const decision = decisions.find((d) => d.article_id === articleId && d.stage === at);
    return labels.find((l) => l.id === decision?.label_id)?.kind ?? null;
  };
  if (stage === 'full') {
    return articles.filter((a) => {
      const kind = kindAt(a.id, 'title');
      return kind === 'include' || kind === 'maybe';
    });
  }
  return articles.filter((a) => a.status !== 'archived' || kindAt(a.id, 'title') !== null);
}

/** The decision on an article at exactly this stage, or null. */
export function decisionAt(
  decisions: ScreeningDecision[],
  articleId: number,
  stage: ScreeningStage,
): ScreeningDecision | null {
  return decisions.find((d) => d.article_id === articleId && d.stage === stage) ?? null;
}
