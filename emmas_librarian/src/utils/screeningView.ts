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
 * With a `stage` (board 164's "Título e resumo | Texto completo"), the page is that stage alone: the articles that go
 * through it (guidedPool) and only the decisions made at it. Without one, each article shows its latest decision.
 *
 * @example buildReview(articles, labels, decisions).counts.pending // 12
 * @example buildReview(articles, labels, decisions, 'full').counts.include // included at full text
 */
export function buildReview(
  articles: Article[],
  labels: ScreeningLabel[],
  decisions: ScreeningDecision[],
  stage?: ScreeningStage,
): ReviewView {
  const atStage = stage ? decisions.filter((d) => d.stage === stage) : decisions;
  // Title and abstract takes every article (the hand-archived ones stay in their own bucket); full text only the kept ones.
  const pool = stage === 'full' ? guidedPool(articles, labels, decisions, 'full') : articles;
  const rows = rowsOf(pool, labels, atStage);
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

/**
 * The pool in the order the classifier predicts: what is decided first, in its place, then the pending likeliest first,
 * then those it has no vector for, so no article ever leaves the queue (#55).
 *
 * @example predictedOrder(pool, [3, 1], decisions) // decided, then 3, then 1, then the rest
 */
export function predictedOrder(pool: Article[], order: number[], decisions: ScreeningDecision[]): Article[] {
  const undecided = (article: Article) => decisionAt(decisions, article.id, 'title') === null;
  const position = new Map(order.map((id, i) => [id, i]));
  const ranked = pool
    .filter((article) => undecided(article) && position.has(article.id))
    .sort((a, b) => (position.get(a.id) as number) - (position.get(b.id) as number));
  const unranked = pool.filter((article) => undecided(article) && !position.has(article.id));
  return [...pool.filter((article) => !undecided(article)), ...ranked, ...unranked];
}

/**
 * Of the last decisions at title and abstract, how many were relevant. A fact, shown instead of an estimate of how many
 * are left, which would look safer than it is (author's decision, #55). Duplicates are not a screening decision.
 *
 * @example recentRelevant(decisions, labels, 50) // { relevant: 3, looked: 50 }
 */
export function recentRelevant(decisions: ScreeningDecision[], labels: ScreeningLabel[], size: number) {
  const kindOf = new Map(labels.map((label) => [label.id, label.kind]));
  const recent = decisions
    .filter((d) => d.stage === 'title' && kindOf.get(d.label_id) !== 'removed')
    .sort((a, b) => b.decided_at.localeCompare(a.decided_at) || b.id - a.id)
    .slice(0, size);
  const relevant = recent.filter((d) => ['include', 'maybe'].includes(kindOf.get(d.label_id) ?? '')).length;
  return { relevant, looked: recent.length };
}
