import { useCallback, useRef, useState } from 'react';
import type { OpenAccessOutcome } from '../../../types';
import { describeError } from '../../../utils/describeError';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { OpenAccessRowState, ReportEntry } from '../components/articles/openAccessText';

export interface OpenAccessBatchReport {
  entries: ReportEntry[];
  /** How many articles were selected; fewer entries means the batch was cancelled. */
  total: number;
}

type FetchPdf = (articleId: number) => Promise<OpenAccessOutcome>;

// A rejected call (IPC error) becomes a failed outcome, so one article never stops the others.
const outcomeOf = (fetchPdf: FetchPdf, articleId: number): Promise<OpenAccessOutcome> =>
  fetchPdf(articleId).catch((err: unknown) => ({ status: 'failed', error: describeError(err) }));

/**
 * Looks for open access PDFs, one article or a selection at a time (one download after another), keeping
 * each row's state, the batch progress and the final report. The article list reloads once, after the
 * downloads, so rows do not jump while the user reads the table.
 *
 * Usage:
 *   const openAccess = useOpenAccessPdfs(data.reload);
 *   openAccess.runBatch(selectedArticles);
 */
export function useOpenAccessPdfs(reload: () => Promise<void>) {
  const projectService = useProjectService();
  const fetchPdf = useCallback<FetchPdf>((id) => projectService.fetchOpenAccessPdf(id), [projectService]);
  const [rows, setRows] = useState<Record<number, OpenAccessRowState>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<OpenAccessBatchReport | null>(null);
  const cancelled = useRef(false);
  const setRow = (articleId: number, state: OpenAccessRowState) => setRows((prev) => ({ ...prev, [articleId]: state }));

  const fetchOne = useCallback(
    async (articleId: number) => {
      setRow(articleId, { status: 'running' });
      const outcome = await outcomeOf(fetchPdf, articleId);
      setRow(articleId, outcome);
      if (outcome.status === 'downloaded') await reload();
    },
    [fetchPdf, reload],
  );

  const runBatch = useCallback(
    async (articles: { id: number; title: string }[]) => {
      cancelled.current = false;
      setProgress({ done: 0, total: articles.length });
      const entries: ReportEntry[] = [];
      for (const article of articles) {
        if (cancelled.current) break;
        const outcome = await outcomeOf(fetchPdf, article.id);
        setRow(article.id, outcome);
        entries.push({ articleId: article.id, title: article.title, outcome });
        setProgress({ done: entries.length, total: articles.length });
      }
      setProgress(null);
      setReport({ entries, total: articles.length });
      if (entries.some((e) => e.outcome.status === 'downloaded')) await reload();
    },
    [fetchPdf, reload],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  return { rows, progress, report, fetchOne, runBatch, cancel, closeReport: () => setReport(null) };
}

export type OpenAccessPdfs = ReturnType<typeof useOpenAccessPdfs>;
