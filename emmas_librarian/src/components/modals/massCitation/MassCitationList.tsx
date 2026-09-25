import React from 'react';
import { Edit3 } from 'lucide-react';
import type { CitationOutputFormat } from '../../../services/citationService';

export interface RenderedCitation {
  articleId: number;
  text: string;
}

interface MassCitationListProps {
  citations: RenderedCitation[];
  format: CitationOutputFormat;
  onEdit: (articleId: number) => void;
}

const listStyle: React.CSSProperties = {
  padding: '1.5rem',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  minHeight: '200px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '0.75rem',
};

const textStyle = (isHtml: boolean): React.CSSProperties => ({
  flex: 1,
  whiteSpace: isHtml ? 'normal' : 'pre-wrap',
  fontFamily: isHtml ? 'inherit' : 'monospace',
  fontSize: isHtml ? '0.95rem' : '0.85rem',
  lineHeight: '1.5',
});

const editButtonStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
};

/**
 * Numbered reference list, one row per citation with an edit button.
 *
 * Usage:
 *   <MassCitationList citations={[{ articleId: 1, text: '<i>Title</i>' }]} format="html" onEdit={startEdit} />
 */
export const MassCitationList: React.FC<MassCitationListProps> = ({ citations, format, onEdit }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div style={listStyle}>
      {citations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Nenhum artigo marcado como lido neste projeto.
        </div>
      ) : (
        citations.map((citation, index) => (
          <CitationRow
            key={citation.articleId}
            citation={citation}
            number={index + 1}
            isHtml={format === 'html'}
            onEdit={onEdit}
          />
        ))
      )}
    </div>
  </div>
);

interface CitationRowProps {
  citation: RenderedCitation;
  number: number;
  isHtml: boolean;
  onEdit: (articleId: number) => void;
}

const CitationRow: React.FC<CitationRowProps> = ({ citation, number, isHtml, onEdit }) => (
  <div style={rowStyle}>
    <div style={textStyle(isHtml)}>
      <span style={{ fontWeight: 600, marginRight: '0.5rem', color: 'var(--color-primary)' }}>[{number}]</span>
      {isHtml ? <span dangerouslySetInnerHTML={{ __html: citation.text }} /> : citation.text}
    </div>
    <button
      onClick={() => onEdit(citation.articleId)}
      className="btn-secondary"
      style={editButtonStyle}
      title="Editar metadados para esta referência"
    >
      <Edit3 size={12} /> Editar
    </button>
  </div>
);
