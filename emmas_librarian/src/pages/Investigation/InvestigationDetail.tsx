import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuditView } from '../../components/ai/audit/AuditView';
import { useProjectService } from '../../contexts/ServicesContext';
import { useGlobalError } from '../../contexts/GlobalErrorContext';
import { useSessionState } from '../../hooks/useSessionState';
import type { Article, InvestigationHistoryRecord, InvestigationResult, ResultReview } from '../../types';
import { auditToReopen } from '../../utils/auditReturn';
import { auditForExport } from '../../utils/auditExport';
import { formatResultsAsCsv, formatResultsAsJson } from '../../utils/investigationExporter';
import { statusTone } from '../../utils/investigationStatus';
import { parseJsonList } from '../../utils/parseJsonList';
import { AnswersTab } from './AnswersTab';
import { CallsTab } from './CallsTab';
import { isPendingReview, questionsOf, savedCalls } from './investigationView';

type DetailTab = 'calls' | 'answers' | 'audit';

interface InvestigationDetailProps {
  projectId: number;
  investigation: InvestigationHistoryRecord;
  articles: Article[];
  history: InvestigationHistoryRecord[];
  /** Opens a new investigation with these questions and articles. */
  onReExecute: (questions: string[], articleIds: number[]) => void;
  /** Tells the page how many answers still wait for review, for the list of investigations. */
  onPendingChanged: (investigationId: number, pending: number) => void;
}

function useInvestigationResults(
  investigationId: number,
  onPendingChanged: InvestigationDetailProps['onPendingChanged'],
) {
  const service = useProjectService();
  const { showError } = useGlobalError();
  const [results, setResults] = useState<InvestigationResult[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    service
      .getInvestigationResults(investigationId)
      .then((rows) => alive && setResults(rows ?? []))
      .catch(showError)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- this component is keyed by the investigation
  }, [investigationId]);
  useEffect(() => {
    if (!loading) onPendingChanged(investigationId, results.filter(isPendingReview).length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reports only when the answers change
  }, [results, loading]);
  // #47: the saved row comes back from the database, so the screen shows exactly what was stored.
  const review = async (resultId: number, decision: ResultReview) => {
    try {
      const saved = await service.reviewInvestigationResult(resultId, decision);
      setResults((now) => now.map((r) => (r.id === resultId ? saved : r)));
    } catch (err) {
      showError(err);
    }
  };
  return { results, loading, review };
}

function useResultsExport(
  investigation: InvestigationHistoryRecord,
  results: InvestigationResult[],
  articles: Article[],
) {
  const service = useProjectService();
  const { showError } = useGlobalError();
  // The audit (#48) goes into the export when there is one: its draw, rates and which answers were drawn.
  const run = async (format: 'csv' | 'json') => {
    try {
      const stored = await service.getInvestigationAudit(investigation.id);
      const audit = auditForExport(parseJsonList<string>(investigation.questions), results, stored);
      const write = format === 'csv' ? formatResultsAsCsv : formatResultsAsJson;
      await service.saveExportedFile(
        write(investigation, results, articles, audit),
        `investigation_${investigation.id}_results.${format}`,
      );
    } catch (err) {
      showError(err);
    }
  };
  return run;
}

const STATUS_CHIP = { success: 'inv-chip--ok', warning: 'inv-chip--warn', danger: 'inv-chip--bad' };

/**
 * One stored investigation on its page (#73): what it ran, and the tabs "Chamadas", "Respostas" and "Auditoria".
 * Keyed by the investigation, so opening another one starts clean. The tab survives a trip to the PDF reader.
 *
 * @example <InvestigationDetail key={inv.id} projectId={3} investigation={inv} articles={as} history={h} onReExecute={r} onPendingChanged={p} />
 */
export const InvestigationDetail: React.FC<InvestigationDetailProps> = (props) => {
  const { projectId, investigation, articles, history, onReExecute, onPendingChanged } = props;
  const location = useLocation();
  const reopen = auditToReopen(location.state);
  const auditItem = reopen?.investigationId === investigation.id ? reopen.resultId : undefined;
  const service = useProjectService();
  const { results, loading, review } = useInvestigationResults(investigation.id, onPendingChanged);
  const exportAs = useResultsExport(investigation, results, articles);
  const [storedTab, setTab] = useSessionState<DetailTab | null>(`investigation.${investigation.id}.tab`, null);
  const failedAll = !loading && results.length > 0 && results.every((r) => r.status !== 'success');
  const tab: DetailTab = storedTab ?? (auditItem ? 'audit' : failedAll ? 'calls' : 'answers');
  const questions = questionsOf(investigation, results);
  const articleIds = [...new Set(results.map((r) => r.article_id))];
  const errors = results.filter((r) => r.status !== 'success').length;
  const pending = results.filter(isPendingReview).length;
  const tabs: { id: DetailTab; label: string; count?: string }[] = [
    { id: 'calls', label: 'Chamadas', count: errors ? `${errors} com erro` : undefined },
    { id: 'answers', label: 'Respostas', count: pending ? `${pending} pendentes` : undefined },
    { id: 'audit', label: 'Auditoria' },
  ];
  return (
    <>
      <div className="inv-detail-head">
        <div className="inv-shrink">
          <h2>
            Investigação #{investigation.id}{' '}
            <span className={`inv-chip ${STATUS_CHIP[statusTone(investigation.status)]}`}>
              {investigation.status || 'Desconhecido'}
            </span>
          </h2>
          <div className="inv-muted">
            {new Date(investigation.created_at).toLocaleString()} · {investigation.model_used || 'Modelo desconhecido'}{' '}
            · {articleIds.length} artigos · {questions.length} perguntas
          </div>
        </div>
        <div className="inv-actions">
          <button
            type="button"
            className="btn-secondary inv-small"
            disabled={results.length === 0}
            onClick={() => void exportAs('csv')}
          >
            Exportar CSV
          </button>
          <button
            type="button"
            className="btn-secondary inv-small"
            disabled={results.length === 0}
            onClick={() => void exportAs('json')}
          >
            Exportar JSON
          </button>
          <button type="button" className="btn-secondary inv-small" onClick={() => onReExecute(questions, articleIds)}>
            Executar de novo
          </button>
        </div>
      </div>
      <div className="inv-tabs" role="tablist" aria-label="Partes da investigação">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="inv-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count && <span className="inv-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {loading && <div className="inv-empty">Carregando resultados…</div>}
      {!loading && tab === 'calls' && (
        <CallsTab
          cells={savedCalls(results, articles)}
          questions={questions}
          onRedo={(ids) => onReExecute(questions, ids)}
        />
      )}
      {!loading && tab === 'answers' && (
        <AnswersTab
          projectId={projectId}
          investigationId={investigation.id}
          results={results}
          questions={questions}
          articles={articles}
          onReview={review}
        />
      )}
      {!loading && tab === 'audit' && (
        <div className="inv-scroll">
          <AuditView
            investigation={investigation}
            projectId={projectId}
            articles={articles}
            results={results}
            history={history}
            getInvestigationResults={service.getInvestigationResults}
            onReview={review}
            initialResultId={auditItem}
          />
        </div>
      )}
    </>
  );
};
