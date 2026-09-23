import React from 'react';
import type { Article } from '../../../types';
import { parseJsonList } from '../../../utils/parseJsonList';
import type { InvestigationHistoryRecord } from '../AIExtractionModal';

interface InvestigationHistoryListProps {
  history: InvestigationHistoryRecord[];
  articles: Article[];
  onOpen: (record: InvestigationHistoryRecord) => void;
}

const chipStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  background: 'var(--bg-main)',
  padding: '0.2rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
};

const statusStyle = (status: string): React.CSSProperties => ({
  fontSize: '0.75rem',
  padding: '0.15rem 0.4rem',
  borderRadius: '4px',
  background: status === 'Sucesso' ? 'var(--color-success)' : 'var(--color-danger)',
  color: 'white',
  fontWeight: 600,
});

// Articles may have been deleted since the run; they are then shown by id.
const articleTitles = (ids: number[], articles: Article[]) =>
  ids.map((id) => articles.find((a) => a.id === id)?.title ?? `Artigo #${id}`).join(' • ');

/**
 * Past investigations with their date, status, model, articles and questions.
 *
 * Usage:
 *   <InvestigationHistoryList history={history} articles={articles} onOpen={setSelected} />
 */
export const InvestigationHistoryList: React.FC<InvestigationHistoryListProps> = ({ history, articles, onOpen }) => {
  if (history.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
        Nenhum histórico encontrado.
      </div>
    );
  }
  return (
    <>
      {history.map((record, idx) => (
        <InvestigationHistoryCard key={record.id || idx} record={record} articles={articles} onOpen={onOpen} />
      ))}
    </>
  );
};

interface InvestigationHistoryCardProps {
  record: InvestigationHistoryRecord;
  articles: Article[];
  onOpen: (record: InvestigationHistoryRecord) => void;
}

const InvestigationHistoryCard: React.FC<InvestigationHistoryCardProps> = ({ record, articles, onOpen }) => {
  const questions = parseJsonList<string>(record.questions);
  const articleIds = parseJsonList<number>(record.articles_ids);
  return (
    <div
      className="card"
      style={{ padding: '1rem', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
          {new Date(record.created_at).toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {record.status && <span style={statusStyle(record.status)}>{record.status}</span>}
          {record.model_used && <span style={{ ...chipStyle, fontSize: '0.75rem' }}>{record.model_used}</span>}
          <span style={{ ...chipStyle, fontSize: '0.85rem' }}>{articleIds.length} Artigos</span>
        </div>
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Artigos Incluídos:</strong>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          {articleTitles(articleIds, articles)}
        </div>
      </div>
      <strong style={{ fontSize: '0.85rem', color: 'var(--text-heading)' }}>Perguntas:</strong>
      <ul
        style={{
          margin: 0,
          paddingLeft: '1.2rem',
          color: 'var(--text-main)',
          fontSize: '0.85rem',
          marginTop: '0.2rem',
        }}
      >
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onOpen(record)}
          className="btn-primary"
          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
        >
          Ver Detalhes
        </button>
      </div>
    </div>
  );
};
