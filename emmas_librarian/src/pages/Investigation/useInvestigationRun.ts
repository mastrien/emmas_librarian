import { useRef, useState } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import type { IProjectService, ExtractionAnswer } from '../../services/ProjectServiceInterface';
import type { Article } from '../../types';
import { investigationStatus } from '../../utils/investigationStatus';
import { providerDisplayName } from '../../utils/providerNames';

export interface ArticleExtraction {
  article: Article;
  result?: ExtractionAnswer[];
  error?: string;
  quotaExceeded?: boolean;
}

/** What is being run: it outlives the investigation page, so leaving for a PDF does not lose the screen's progress. */
export interface InvestigationRunState {
  projectId: number;
  questions: string[];
  targets: Article[];
  results: ArticleExtraction[];
  /** The article in progress, counted from 1. */
  current: number;
  isRunning: boolean;
  quotaHit: boolean;
  /** The stored investigation, once the run finished and was saved. */
  savedId: number | null;
}

export interface InvestigationRunRequest {
  projectId: number;
  articles: Article[];
  questions: string[];
  selectedIds: number[];
}

/**
 * Runs the same questions over each selected article, one at a time, then persists the run. A quota error stops
 * the run; the remaining articles are recorded as skipped. It lives above the routes (InvestigationRunContext).
 *
 * @example
 *   const investigation = useInvestigationRun(showError);
 *   await investigation.start({ projectId, articles, questions, selectedIds });
 */
export function useInvestigationRun(onFatalError: (error: unknown) => void) {
  const service = useProjectService();
  const [run, setRun] = useState<InvestigationRunState | null>(null);
  const cancelRef = useRef(false);
  const patch = (change: Partial<InvestigationRunState>) => setRun((now) => (now ? { ...now, ...change } : now));

  const start = async ({ projectId, articles, questions, selectedIds }: InvestigationRunRequest) => {
    const validQuestions = questions.filter((q) => q.trim().length > 0);
    const targets = articles.filter((a) => selectedIds.includes(a.id));
    if (validQuestions.length === 0 || targets.length === 0) return;
    cancelRef.current = false;
    setRun({
      projectId,
      questions: validQuestions,
      targets,
      results: [],
      current: 0,
      isRunning: true,
      quotaHit: false,
      savedId: null,
    });
    try {
      const { collected, status } = await extractSequentially(service, targets, validQuestions, {
        cancelRef,
        onProgress: (current) => patch({ current }),
        onResults: (results) => patch({ results }),
        onQuotaExceeded: () => patch({ quotaHit: true }),
      });
      if (collected.length === 0) return;
      const saved = await persistInvestigation(
        service,
        projectId,
        validQuestions,
        selectedIds,
        targets,
        collected,
        status,
      );
      patch({ savedId: saved });
    } catch (err) {
      onFatalError(err);
    } finally {
      patch({ isRunning: false });
    }
  };

  // The running extraction polls this ref between articles and stops at the next one.
  const cancel = () => {
    cancelRef.current = true;
  };

  return { run, start, cancel, dismiss: () => setRun(null), dismissQuota: () => patch({ quotaHit: false }) };
}

interface ExtractionCallbacks {
  cancelRef: React.MutableRefObject<boolean>;
  onProgress: (current: number) => void;
  onResults: (results: ArticleExtraction[]) => void;
  onQuotaExceeded: () => void;
}

async function extractSequentially(
  service: IProjectService,
  targets: Article[],
  questions: string[],
  callbacks: ExtractionCallbacks,
) {
  const collected: ArticleExtraction[] = [];
  for (let i = 0; i < targets.length && !callbacks.cancelRef.current; i++) {
    callbacks.onProgress(i + 1);
    const outcome = await extractOne(service, targets[i], questions);
    collected.push(outcome);
    // Failures too: the "Chamadas" tab shows each error as it happens, not only when the run ends.
    callbacks.onResults([...collected]);
    if (outcome.quotaExceeded) {
      callbacks.onQuotaExceeded();
      callbacks.cancelRef.current = true;
      return { collected, status: 'Erro: Quota Excedida' };
    }
  }
  return { collected, status: investigationStatus(collected) };
}

async function extractOne(service: IProjectService, article: Article, questions: string[]): Promise<ArticleExtraction> {
  try {
    return { article, result: await service.massiveExtraction(article.id, questions) };
  } catch (err) {
    console.error(JSON.stringify({ event: 'extraction_failed', articleId: article.id, error: String(err) }));
    const message = (err as { message?: string } | null)?.message;
    return { article, error: err instanceof Error ? err.message : String(err), quotaExceeded: isQuotaMessage(message) };
  }
}

// Providers signal exhausted credits with HTTP 429 or a QUOTA_EXCEEDED code in the error message.
const isQuotaMessage = (message?: string) =>
  !!message && (message.includes('429') || message.includes('QUOTA_EXCEEDED'));

async function persistInvestigation(
  service: IProjectService,
  projectId: number,
  questions: string[],
  selectedIds: number[],
  targets: Article[],
  collected: ArticleExtraction[],
  status: string,
): Promise<number> {
  const modelUsed = await describeExtractionModel(service);
  const investigationId = await service.saveMassiveInvestigation(projectId, questions, selectedIds, modelUsed, status);
  for (const extraction of collected) {
    await service.saveInvestigationResults(investigationId, extraction.article.id, toResultRows(extraction, questions));
  }
  const processed = new Set(collected.map((c) => c.article.id));
  for (const skipped of targets.filter((a) => !processed.has(a.id))) {
    await service.saveInvestigationResults(investigationId, skipped.id, skippedRows(questions));
  }
  return investigationId;
}

function toResultRows(extraction: ArticleExtraction, questions: string[]) {
  if (extraction.result) {
    return extraction.result.map((r) => ({
      question: r.question,
      answer: JSON.stringify(r),
      quote: null,
      status: 'success' as const,
      error_message: null,
    }));
  }
  return questions.map((question) => ({
    question,
    answer: null,
    quote: null,
    status: 'error' as const,
    error_message: extraction.error || 'Falha desconhecida',
  }));
}

function skippedRows(questions: string[]) {
  return questions.map((question) => ({
    question,
    answer: null,
    quote: null,
    status: 'skipped' as const,
    error_message: 'Cancelado ou não executado.',
  }));
}

/**
 * The model the extraction skill is set to, as the page and the saved investigation name it.
 *
 * @example await describeExtractionModel(service) // 'Ollama (gpt-oss:120b)'
 */
export async function describeExtractionModel(service: IProjectService): Promise<string> {
  try {
    const config = (await service.getAiModelConfigs()).find((c) => c.skill === 'extraction');
    if (!config) return 'Desconhecido';
    const providerName = providerDisplayName(config.provider);
    return config.model_name ? `${providerName} (${config.model_name})` : providerName;
  } catch {
    return 'Desconhecido';
  }
}
