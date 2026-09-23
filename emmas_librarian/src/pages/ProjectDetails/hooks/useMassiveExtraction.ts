import { useRef, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { IProjectService, ExtractionAnswer } from '../../../services/ProjectServiceInterface';
import type { Article, MassiveInvestigation } from '../../../types';

export interface ArticleExtraction {
  article: Article;
  result?: ExtractionAnswer[];
  error?: string;
  quotaExceeded?: boolean;
}

interface MassiveExtractionOptions {
  projectId: number | null;
  articles: Article[];
  onQuotaExceeded: () => void;
  onHistoryChanged: (history: MassiveInvestigation[]) => void;
  onFatalError: (error: unknown) => void;
}

const PROVIDER_NAMES: Record<string, string> = { openai: 'OpenAI', gemini: 'Gemini', anthropic: 'Anthropic', ollama: 'Ollama' };

/**
 * Runs the same questions over each selected article, one at a time, then persists the run.
 * A quota error stops the run; the remaining articles are recorded as skipped.
 *
 * Usage:
 *   const extraction = useMassiveExtraction({ projectId, articles, onQuotaExceeded, onHistoryChanged, onFatalError });
 *   await extraction.run(selectedIds);
 */
export function useMassiveExtraction(options: MassiveExtractionOptions) {
  const projectService = useProjectService();
  const [questions, setQuestions] = useState<string[]>(['']);
  const [results, setResults] = useState<ArticleExtraction[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const cancelRef = useRef(false);

  const reset = () => {
    setQuestions(['']);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setIsExtracting(false);
  };

  const run = async (selectedIds: number[]) => {
    const validQuestions = questions.filter((q) => q.trim().length > 0);
    const targets = options.articles.filter((a) => selectedIds.includes(a.id));
    if (validQuestions.length === 0 || targets.length === 0) return;
    setIsExtracting(true);
    cancelRef.current = false;
    setProgress({ current: 0, total: targets.length });
    setResults([]);
    try {
      const { collected, status } = await extractSequentially(projectService, targets, validQuestions, {
        cancelRef,
        onProgress: (current) => setProgress({ current, total: targets.length }),
        onResults: setResults,
        onQuotaExceeded: options.onQuotaExceeded,
      });
      if (options.projectId !== null && collected.length > 0) {
        await persistInvestigation(projectService, options.projectId, validQuestions, selectedIds, targets, collected, status);
        options.onHistoryChanged(await projectService.getMassiveInvestigations(options.projectId));
      }
    } catch (err) {
      options.onFatalError(err);
    } finally {
      setIsExtracting(false);
    }
  };

  return { questions, setQuestions, results, isExtracting, progress, cancelRef, run, reset };
}

interface ExtractionCallbacks {
  cancelRef: React.MutableRefObject<boolean>;
  onProgress: (current: number) => void;
  onResults: (results: ArticleExtraction[]) => void;
  onQuotaExceeded: () => void;
}

async function extractSequentially(service: IProjectService, targets: Article[], questions: string[], callbacks: ExtractionCallbacks) {
  const collected: ArticleExtraction[] = [];
  for (let i = 0; i < targets.length && !callbacks.cancelRef.current; i++) {
    callbacks.onProgress(i + 1);
    const outcome = await extractOne(service, targets[i], questions);
    collected.push(outcome);
    if (outcome.result) callbacks.onResults([...collected]);
    if (outcome.quotaExceeded) {
      callbacks.onQuotaExceeded();
      callbacks.cancelRef.current = true;
      return { collected, status: 'Erro: Quota Excedida' };
    }
  }
  return { collected, status: 'Sucesso' };
}

async function extractOne(service: IProjectService, article: Article, questions: string[]): Promise<ArticleExtraction> {
  try {
    return { article, result: await service.massiveExtraction(article.id, questions) };
  } catch (err) {
    console.error(`Erro ao extrair de ${article.title}:`, err);
    const message = (err as { message?: string } | null)?.message;
    return { article, error: err instanceof Error ? err.message : String(err), quotaExceeded: isQuotaMessage(message) };
  }
}

// Providers signal exhausted credits with HTTP 429 or a QUOTA_EXCEEDED code in the error message.
const isQuotaMessage = (message?: string) => !!message && (message.includes('429') || message.includes('QUOTA_EXCEEDED'));

async function persistInvestigation(
  service: IProjectService,
  projectId: number,
  questions: string[],
  selectedIds: number[],
  targets: Article[],
  collected: ArticleExtraction[],
  status: string,
): Promise<void> {
  const modelUsed = await describeExtractionModel(service);
  const investigationId = await service.saveMassiveInvestigation(projectId, questions, selectedIds, modelUsed, status);
  for (const extraction of collected) {
    await service.saveInvestigationResults(investigationId, extraction.article.id, toResultRows(extraction, questions));
  }
  const processed = new Set(collected.map((c) => c.article.id));
  for (const skipped of targets.filter((a) => !processed.has(a.id))) {
    await service.saveInvestigationResults(investigationId, skipped.id, skippedRows(questions));
  }
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

async function describeExtractionModel(service: IProjectService): Promise<string> {
  try {
    const config = (await service.getAiModelConfigs()).find((c) => c.skill === 'extraction');
    if (!config) return 'Desconhecido';
    const providerName = PROVIDER_NAMES[config.provider] || config.provider;
    return config.model_name ? `${providerName} (${config.model_name})` : providerName;
  } catch {
    return 'Desconhecido';
  }
}
