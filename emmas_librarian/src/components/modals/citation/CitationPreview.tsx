import React from 'react';
import './citation.css';

interface CitationPreviewProps {
  text: string;
  /** "html" is shown as rich text, in the reading typeface; "bibtex" is code. */
  format: 'html' | 'text' | 'bibtex';
}

/**
 * The box with the generated citation (board 177): sunken, in the reading typeface, or in code for BibTeX.
 *
 * @example <CitationPreview text={citationHtml} format="html" />
 */
export const CitationPreview: React.FC<CitationPreviewProps> = ({ text, format }) => (
  <div data-testid="citation-preview" className={`citation-box${format === 'html' ? '' : ' is-code'}`}>
    {format === 'html' ? <div dangerouslySetInnerHTML={{ __html: text }} /> : text}
  </div>
);
