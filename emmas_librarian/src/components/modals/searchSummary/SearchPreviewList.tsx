import React from 'react';
import { LayoutList } from 'lucide-react';
import type { SearchPreviewItem } from '../../../types';
import './searchSummary.css';

type OpenDetails = (item: SearchPreviewItem) => void;

const PreviewRow: React.FC<{ item: SearchPreviewItem; onOpenDetails: OpenDetails }> = ({ item, onOpenDetails }) => (
  <li className="search-preview-row">
    <div className="search-preview-line">
      <button
        type="button"
        onClick={() => onOpenDetails(item)}
        className="search-preview-title"
        title="Ver os metadados"
      >
        {item.title}
      </button>
      {item.alreadyInProject && <span className="search-preview-known">Já no projeto</span>}
    </div>
    <div className="search-preview-meta">
      {[item.authors, item.year, item.sourceDatabases.join(', ')].filter(Boolean).join(' · ')}
    </div>
  </li>
);

/**
 * The deduplicated results of a search that is not saved yet, so the user can judge the query;
 * each title opens that result's metadata.
 *
 * @example <SearchPreviewList results={preview.results} onOpenDetails={setSelected} />
 */
export const SearchPreviewList: React.FC<{ results: SearchPreviewItem[]; onOpenDetails: OpenDetails }> = ({
  results,
  onOpenDetails,
}) => (
  <div>
    <h3 className="search-summary-section-title">
      <LayoutList size={18} /> Artigos Encontrados
    </h3>
    {results.length === 0 ? (
      <p className="search-preview-empty">Nenhum artigo encontrado com essa busca.</p>
    ) : (
      <ul aria-label="Artigos encontrados" className="search-preview-list">
        {results.map((item, index) => (
          <PreviewRow key={`${item.doi ?? item.title}-${index}`} item={item} onOpenDetails={onOpenDetails} />
        ))}
      </ul>
    )}
  </div>
);
