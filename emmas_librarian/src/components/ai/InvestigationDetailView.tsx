import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Article, type InvestigationResult, type ResultReview } from '../../types';
import { type InvestigationHistoryRecord } from '../modals/AIExtractionModal';
import { useProjectService } from '../../contexts/ServicesContext';
import { formatResultsAsCsv, formatResultsAsJson } from '../../utils/investigationExporter';
import { parseJsonList } from '../../utils/parseJsonList';
import { ArticleResultAccordion } from './investigation/ArticleResultAccordion';
import { AuditView } from './audit/AuditView';
import { auditForExport } from '../../utils/auditExport';

export interface InvestigationDetailViewProps {
  investigation: InvestigationHistoryRecord;
  articles: Article[];
  getInvestigationResults: (investigationId: number) => Promise<InvestigationResult[]>;
  onBack: () => void;
  onReExecute: (questions: string[], articleIds: number[]) => void;
  /** For the audit (#48): the project, its investigations (to compare models) and the item to reopen. */
  projectId?: number;
  history?: InvestigationHistoryRecord[];
  initialAuditResultId?: number;
}

export const InvestigationDetailView: React.FC<InvestigationDetailViewProps> = ({
  investigation,
  articles,
  getInvestigationResults,
  onBack,
  onReExecute,
  projectId,
  history = [],
  initialAuditResultId,
}) => {
  const projectService = useProjectService();
  const navigate = useNavigate();
  const [results, setResults] = useState<InvestigationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlyPending, setOnlyPending] = useState(false);
  const [auditing, setAuditing] = useState(initialAuditResultId !== undefined);

  // #47: the saved row comes back from the database, so the screen shows exactly what was stored.
  const reviewResult = async (resultId: number, review: ResultReview) => {
    try {
      const saved = await projectService.reviewInvestigationResult(resultId, review);
      setResults((current) => current.map((r) => (r.id === resultId ? saved : r)));
    } catch (err) {
      alert(`Não foi possível salvar a revisão: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getInvestigationResults(investigation.id)
      .then((data) => {
        if (mounted) {
          setResults(data || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load investigation results:', err);
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [investigation.id, getInvestigationResults]);

  const pendingCount = results.filter(isPendingReview).length;
  const visibleResults = onlyPending ? results.filter(isPendingReview) : results;
  const visibleByArticle = groupByArticle(visibleResults);
  const visibleArticleIds = Object.keys(visibleByArticle).map(Number);

  // Re-running covers every article of the investigation, whatever the filter shows.
  const articleIds = Object.keys(groupByArticle(results)).map(Number);
  const questionsList = parseJsonList<string>(investigation.questions);

  const handleReExecute = () => {
    onReExecute(questionsList, articleIds);
  };

  // The audit (#48) goes into the export when there is one: its draw, rates and which answers were drawn.
  const auditOfExport = async () =>
    auditForExport(questionsList, results, await projectService.getInvestigationAudit(investigation.id));

  const handleExportCsv = async () => {
    const csvContent = formatResultsAsCsv(investigation, results, articles, await auditOfExport());
    const success = await projectService.saveExportedFile(csvContent, `investigation_${investigation.id}_results.csv`);
    if (success) {
      console.log('CSV exported successfully');
    }
  };

  const handleExportJson = async () => {
    const jsonContent = formatResultsAsJson(investigation, results, articles, await auditOfExport());
    const success = await projectService.saveExportedFile(
      jsonContent,
      `investigation_${investigation.id}_results.json`,
    );
    if (success) {
      console.log('JSON exported successfully');
    }
  };

  if (auditing && !isLoading) {
    return (
      <AuditView
        investigation={investigation}
        projectId={projectId}
        articles={articles}
        results={results}
        history={history}
        getInvestigationResults={getInvestigationResults}
        onReview={reviewResult}
        onBack={() => setAuditing(false)}
        initialResultId={initialAuditResultId}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          &larr; Voltar ao Histórico
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            Só pendentes de revisão ({pendingCount})
          </label>
          <button className="btn-secondary" onClick={handleExportCsv} disabled={results.length === 0}>
            Exportar CSV
          </button>
          <button className="btn-secondary" onClick={handleExportJson} disabled={results.length === 0}>
            Exportar JSON
          </button>
          <button className="btn-secondary" onClick={() => setAuditing(true)} disabled={results.length === 0}>
            Auditar
          </button>
          <button className="btn-primary" onClick={handleReExecute}>
            Re-executar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div
          className="card"
          style={{ padding: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-heading)' }}>
            Investigação #{investigation.id} — {new Date(investigation.created_at).toLocaleString()}
          </h4>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Modelo: {investigation.model_used || 'Desconhecido'}
            </span>
            <span>·</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{articleIds.length} artigos</span>
            <span>·</span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.15rem 0.4rem',
                borderRadius: '4px',
                background: investigation.status === 'Sucesso' ? 'var(--color-success)' : 'var(--color-danger)',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {investigation.status || 'Desconhecido'}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Carregando resultados...
          </div>
        ) : visibleArticleIds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            {onlyPending
              ? 'Nenhuma resposta pendente de revisão.'
              : 'Nenhum resultado encontrado para esta investigação.'}
          </div>
        ) : (
          visibleArticleIds.map((articleId) => (
            <ArticleResultAccordion
              key={articleId}
              articleId={articleId}
              article={articles.find((a) => a.id === articleId)}
              articleResults={visibleByArticle[articleId]}
              defaultExpanded={visibleArticleIds.length === 1}
              onReview={reviewResult}
              onViewDocument={(ev) =>
                navigate(`/articles/${articleId}`, { state: { searchQuery: ev.text, page: ev.page } })
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

// Answers that came back and nobody reviewed yet (#47); errors and skipped answers have nothing to review.
function isPendingReview(result: InvestigationResult): boolean {
  return result.status === 'success' && result.review_status === 'pending';
}

function groupByArticle(results: InvestigationResult[]): Record<number, InvestigationResult[]> {
  const byArticle: Record<number, InvestigationResult[]> = {};
  for (const result of results) (byArticle[result.article_id] ??= []).push(result);
  return byArticle;
}
