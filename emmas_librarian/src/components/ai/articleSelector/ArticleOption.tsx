import React from 'react';
import { FileText } from 'lucide-react';
import type { Article, SearchHistoryItem } from '../../../types';
import { searchBadgeLabel } from './articleSelectorQueries';
import './articleSelector.css';

interface ArticleOptionProps {
  article: Article;
  selected: boolean;
  disabled: boolean;
  searchHistory: SearchHistoryItem[];
  onToggle: () => void;
}

/**
 * One article to tick in the selector: title (two lines at most), authors, year, journal, where it came from and
 * whether it has a PDF.
 *
 * @example <ArticleOption article={a} selected={false} disabled={false} searchHistory={h} onToggle={toggle} />
 */
export const ArticleOption: React.FC<ArticleOptionProps> = ({
  article,
  selected,
  disabled,
  searchHistory,
  onToggle,
}) => {
  const classes = ['article-option', selected && 'is-selected', disabled && 'is-disabled'].filter(Boolean).join(' ');
  const journal = article.journal || article.publisher;
  return (
    <label className={classes}>
      <input type="checkbox" checked={selected} onChange={() => !disabled && onToggle()} disabled={disabled} />
      <div className="article-option-body">
        <div className="article-option-title">{article.title}</div>
        <div className="article-option-meta">
          {article.authors && <span className="article-option-authors">{article.authors}</span>}
          {article.year && <span>• {article.year}</span>}
          {journal && <span className="article-option-journal">• {journal}</span>}
        </div>
        <div className="article-option-badges">
          <span className="article-option-badge article-option-badge--origin">
            🔍 {searchBadgeLabel(article.search_id, searchHistory)}
          </span>
          {article.local_file_path && (
            <span className="article-option-badge article-option-badge--pdf">
              <FileText size={10} /> PDF Anexado
            </span>
          )}
        </div>
      </div>
    </label>
  );
};
