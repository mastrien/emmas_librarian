import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type Article, type InvestigationResult } from '../../types';
import { type InvestigationHistoryRecord } from '../modals/AIExtractionModal';
import { projectService } from '../../services/api';
import { formatResultsAsCsv, formatResultsAsJson } from '../../utils/investigationExporter';
import { RAGResultCard } from './RAGResultCard';

export interface InvestigationDetailViewProps {
  investigation: InvestigationHistoryRecord;
  articles: Article[];
  getInvestigationResults: (investigationId: number) => Promise<InvestigationResult[]>;
  onBack: () => void;
  onReExecute: (questions: string[], articleIds: number[]) => void;
}

export const InvestigationDetailView: React.FC<InvestigationDetailViewProps> = ({
  investigation,
  articles,
  getInvestigationResults,
  onBack,
  onReExecute,
}) => {
  const navigate = useNavigate();
  const [results, setResults] = useState<InvestigationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Group results by article
  const resultsByArticle = results.reduce(
    (acc, result) => {
      if (!acc[result.article_id]) {
        acc[result.article_id] = [];
      }
      acc[result.article_id].push(result);
      return acc;
    },
    {} as Record<number, InvestigationResult[]>,
  );

  const articleIds = Object.keys(resultsByArticle).map(Number);
  const qStr = investigation.questions || '[]';
  const questionsList = JSON.parse(qStr);

  const handleReExecute = () => {
    onReExecute(questionsList, articleIds);
  };

  const handleExportCsv = async () => {
    const csvContent = formatResultsAsCsv(investigation, results, articles);
    const success = await projectService.saveExportedFile(csvContent, `investigation_${investigation.id}_results.csv`);
    if (success) {
      console.log('CSV exported successfully');
    }
  };

  const handleExportJson = async () => {
    const jsonContent = formatResultsAsJson(investigation, results, articles);
    const success = await projectService.saveExportedFile(
      jsonContent,
      `investigation_${investigation.id}_results.json`,
    );
    if (success) {
      console.log('JSON exported successfully');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          &larr; Voltar ao Histórico
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-secondary" onClick={handleExportCsv} disabled={results.length === 0}>
            Exportar CSV
          </button>
          <button className="btn-secondary" onClick={handleExportJson} disabled={results.length === 0}>
            Exportar JSON
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
        ) : articleIds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Nenhum resultado encontrado para esta investigação.
          </div>
        ) : (
          articleIds.map((articleId) => (
            <ArticleResultAccordion
              key={articleId}
              articleId={articleId}
              article={articles.find((a) => a.id === articleId)}
              articleResults={resultsByArticle[articleId]}
              defaultExpanded={articleIds.length === 1}
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

// Sub-component for accordion functionality
const ArticleResultAccordion: React.FC<{
  articleId: number;
  article?: Article;
  articleResults: InvestigationResult[];
  defaultExpanded: boolean;
  onViewDocument: (ev: any) => void;
}> = ({ articleId, article, articleResults, defaultExpanded, onViewDocument }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className="card"
      style={{
        padding: '0',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '1rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isExpanded ? 'var(--bg-main)' : 'var(--bg-surface)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          transition: 'background 0.2s',
        }}
      >
        <h5 style={{ margin: '0', color: 'var(--color-primary)' }}>
          📄 Artigo: {article ? article.title : `Desconhecido (ID: ${articleId})`}
        </h5>
        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
          {articleResults.map((res) => {
            let ragResult = null;
            try {
              if (res.answer) {
                const parsed = JSON.parse(res.answer);
                if (parsed && typeof parsed.synthesizedAnswer === 'string') {
                  ragResult = parsed;
                }
              }
            } catch (e) {}

            return (
              <div
                key={res.id}
                style={{
                  background: 'var(--bg-main)',
                  padding: ragResult ? '0' : '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft:
                    res.status === 'success'
                      ? '3px solid var(--color-success)'
                      : res.status === 'error'
                        ? '3px solid var(--color-danger)'
                        : '3px solid var(--color-warning)',
                }}
              >
                {res.status === 'error' || res.status === 'skipped' ? (
                  <div style={{ padding: '0.75rem' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        color: 'var(--text-heading)',
                      }}
                    >
                      Q: {res.question}
                    </div>
                    <div
                      style={{
                        color: res.status === 'error' ? 'var(--color-danger)' : 'var(--color-warning)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      {res.status === 'error' ? 'Erro: ' : 'Pulado: '}
                      {res.error_message || 'Falha ao extrair resposta.'}
                    </div>
                  </div>
                ) : ragResult ? (
                  <RAGResultCard result={ragResult} onViewDocument={onViewDocument} />
                ) : (
                  <div style={{ padding: '0.75rem' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                        color: 'var(--text-heading)',
                      }}
                    >
                      Q: {res.question}
                    </div>
                    <div
                      className="markdown-body"
                      style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {res.answer || '*Nenhuma resposta gerada*'}
                      </ReactMarkdown>
                    </div>
                    {res.quote && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontStyle: 'italic',
                          color: 'var(--text-muted)',
                          borderLeft: '3px solid var(--color-primary)',
                          paddingLeft: '0.5rem',
                        }}
                      >
                        "{res.quote}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
