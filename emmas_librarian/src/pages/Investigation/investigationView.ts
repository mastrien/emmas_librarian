import type { Article, InvestigationHistoryRecord, InvestigationResult } from '../../types';
import { parseJsonList } from '../../utils/parseJsonList';
import { aiAnswerText, parseRagAnswer } from '../../utils/investigationAnswers';
import type { InvestigationRunState } from './useInvestigationRun';

export type CallStatus = 'success' | 'error' | 'skipped' | 'running' | 'queued';

/** One article × question of an investigation, stored or still running. */
export interface CallCell {
  articleId: number;
  articleTitle: string;
  question: string;
  status: CallStatus;
  error: string | null;
  /** What the model answered, as text; null while running or when it failed. */
  answer: string | null;
  /** The passages it cited, with their page when known. */
  evidences: CallEvidence[];
}

/** A passage a call cited. */
export interface CallEvidence {
  page: number | null;
  text: string;
}

/**
 * The passages of a stored answer: the RAG evidences, or the single quote of an older answer.
 *
 * @example evidencesOf(result) // [{ page: 26, text: 'approach. Combined with…' }]
 */
export function evidencesOf(result: Pick<InvestigationResult, 'answer' | 'quote'>): CallEvidence[] {
  const rag = parseRagAnswer(result.answer);
  if (rag?.evidences.length) return rag.evidences.map((e) => ({ page: e.page ?? null, text: e.text }));
  return result.quote ? [{ page: null, text: result.quote }] : [];
}

export type AnswerFilter = 'pending' | 'reviewed' | 'errors' | 'all';

/** Calls that failed with the same message, and the articles to run again. */
export interface CallErrorGroup {
  message: string;
  status: 'error' | 'skipped';
  count: number;
  articleIds: number[];
}

const titleOf = (id: number, articles: Article[]) => articles.find((a) => a.id === id)?.title ?? `Artigo #${id}`;

/** Answers that came back and nobody reviewed yet (#47); errors and skipped answers have nothing to review. */
export const isPendingReview = (result: InvestigationResult): boolean =>
  result.status === 'success' && result.review_status === 'pending';

/**
 * The questions of an investigation in their order. Answers of a question the stored list misses (older rows)
 * still get a column, so no answer disappears from the grid.
 *
 * @example questionsOf(investigation, results) // ['Qual o desenho?', 'Qual a amostra?']
 */
export function questionsOf(investigation: InvestigationHistoryRecord, results: InvestigationResult[]): string[] {
  const stored = parseJsonList<string>(investigation.questions);
  return [...new Set([...stored, ...results.map((r) => r.question)])];
}

/**
 * The calls of a stored investigation, for the "Chamadas" tab.
 *
 * @example savedCalls(results, articles)[0].status // 'success'
 */
export function savedCalls(results: InvestigationResult[], articles: Article[]): CallCell[] {
  return results.map((r) => ({
    articleId: r.article_id,
    articleTitle: titleOf(r.article_id, articles),
    question: r.question,
    status: r.status,
    error: r.error_message,
    answer: r.status === 'success' ? aiAnswerText(r) : null,
    evidences: evidencesOf(r),
  }));
}

function liveStatus(run: InvestigationRunState, index: number): { status: CallStatus; error: string | null } {
  const finished = run.results[index];
  if (finished?.error !== undefined) return { status: 'error', error: finished.error };
  if (finished) return { status: 'success', error: null };
  if (!run.isRunning) return { status: 'skipped', error: 'Cancelado ou não executado.' };
  return { status: index === run.current - 1 ? 'running' : 'queued', error: null };
}

/**
 * The calls of the run in progress. The extraction asks one article at a time, so all the questions of an article
 * change together.
 *
 * @example liveCalls(run).filter((c) => c.status === 'running').length // the questions of the current article
 */
export function liveCalls(run: InvestigationRunState): CallCell[] {
  return run.targets.flatMap((article, index) =>
    run.questions.map((question) => ({
      articleId: article.id,
      articleTitle: article.title,
      question,
      answer: null,
      evidences: [],
      ...liveStatus(run, index),
    })),
  );
}

/**
 * The failed calls grouped by message: a wrong provider gives one line, not one per answer (validation of #44).
 *
 * @example callErrorGroups(cells)[0] // { message: '401 …', status: 'error', count: 6, articleIds: [8] }
 */
export function callErrorGroups(cells: CallCell[]): CallErrorGroup[] {
  const groups = new Map<string, CallErrorGroup>();
  for (const cell of cells) {
    if (cell.status !== 'error' && cell.status !== 'skipped') continue;
    const message = cell.error || 'Falha ao extrair resposta.';
    const key = `${cell.status}:${message}`;
    const group = groups.get(key) ?? { message, status: cell.status, count: 0, articleIds: [] };
    group.count += 1;
    if (!group.articleIds.includes(cell.articleId)) group.articleIds.push(cell.articleId);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Whether an answer shows under a filter.
 *
 * @example matchesFilter(result, 'errors') // true for a failed or skipped call
 */
export function matchesFilter(result: InvestigationResult, filter: AnswerFilter): boolean {
  if (filter === 'pending') return isPendingReview(result);
  if (filter === 'errors') return result.status !== 'success';
  if (filter === 'reviewed') return result.status === 'success' && result.review_status !== 'pending';
  return true;
}

/**
 * The next answer waiting for review after this one, in the order of the grid; null when none is left.
 *
 * @example nextPending(results, 42)?.id // 43
 */
export function nextPending(results: InvestigationResult[], currentId: number | null): InvestigationResult | null {
  const from = results.findIndex((r) => r.id === currentId);
  return results.slice(from + 1).find(isPendingReview) ?? null;
}

/**
 * The results in the order of the grid: articles as they first appear, questions as the investigation lists them.
 *
 * @example gridOrder(results, ['Q1', 'Q2']).map((r) => r.question) // ['Q1', 'Q2', 'Q1', 'Q2']
 */
export function gridOrder(results: InvestigationResult[], questions: string[]): InvestigationResult[] {
  const articleIds = [...new Set(results.map((r) => r.article_id))];
  return articleIds.flatMap((id) =>
    questions.flatMap((q) => results.filter((r) => r.article_id === id && r.question === q)),
  );
}

/**
 * The address of a view of the page.
 *
 * @example investigationPath(3, 14) // '/projects/3/investigation/14'
 */
export const investigationPath = (projectId: number, view?: number | 'new' | 'running'): string =>
  view === undefined ? `/projects/${projectId}/investigation` : `/projects/${projectId}/investigation/${view}`;

/** One row of the call matrix: an article and its calls in the order of the questions. */
export interface CallMatrixRow {
  articleId: number;
  articleTitle: string;
  calls: (CallCell | undefined)[];
}

/**
 * The calls as articles × questions, for the matrix of the run (board 160): articles as they first appear.
 *
 * @example callMatrix(cells, ['Q1', 'Q2'])[0].calls.map((c) => c?.status) // ['success', 'running']
 */
export function callMatrix(cells: CallCell[], questions: string[]): CallMatrixRow[] {
  const articleIds = [...new Set(cells.map((c) => c.articleId))];
  return articleIds.map((articleId) => {
    const own = cells.filter((c) => c.articleId === articleId);
    return {
      articleId,
      articleTitle: own[0].articleTitle,
      calls: questions.map((q) => own.find((c) => c.question === q)),
    };
  });
}
