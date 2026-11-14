import React from 'react';
import { Pencil } from 'lucide-react';
import type { CitationOutputFormat } from '../../../services/citationService';
import { Button } from '../../common/Button';
import '../citation/citation.css';

export interface RenderedCitation {
  articleId: number;
  text: string;
}

interface MassCitationListProps {
  citations: RenderedCitation[];
  format: CitationOutputFormat;
  onEdit: (articleId: number) => void;
}

/**
 * Numbered reference list in the citation box (board 177), one row per citation with an edit button.
 *
 * Usage:
 *   <MassCitationList citations={[{ articleId: 1, text: '<i>Title</i>' }]} format="html" onEdit={startEdit} />
 */
export const MassCitationList: React.FC<MassCitationListProps> = ({ citations, format, onEdit }) => (
  <div className={`citation-box citation-mass-list${format === 'html' ? '' : ' is-code'}`}>
    {citations.length === 0 ? (
      <div className="citation-mass-empty">Nenhum artigo marcado como lido neste projeto.</div>
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
);

interface CitationRowProps {
  citation: RenderedCitation;
  number: number;
  isHtml: boolean;
  onEdit: (articleId: number) => void;
}

const CitationRow: React.FC<CitationRowProps> = ({ citation, number, isHtml, onEdit }) => (
  <div className="citation-mass-row">
    <div className="citation-mass-text">
      <span className="citation-mass-number">[{number}]</span>
      {isHtml ? <span dangerouslySetInnerHTML={{ __html: citation.text }} /> : citation.text}
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onEdit(citation.articleId)}
      title="Editar metadados para esta referência"
    >
      <Pencil size={12} aria-hidden="true" /> Editar
    </Button>
  </div>
);
