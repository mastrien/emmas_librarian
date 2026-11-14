import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyPlus, Edit2, FileText, Upload, X } from 'lucide-react';
import type { Article, SearchHistoryItem } from '../../../../types';
import { parseSourceDatabases } from '../../../../utils/sourceDatabases';
import { InspectorOrigin, InspectorText } from './InspectorSections';
import { ArticleRowActions, type ArticleRowHandlers } from '../articles/ArticleRowActions';
import { accessName, authorsPreview, statusName, venueLine } from './inspectorFacts';
import './articleInspector.css';

export interface ArticleInspectorProps {
  article: Article;
  handlers: ArticleRowHandlers;
  history: SearchHistoryItem[];
  onClose: () => void;
  /** Opens the search history, where the search that brought the article is. */
  onShowHistory: () => void;
  outsideSearch?: boolean;
}

const Authors: React.FC<{ authors?: string }> = ({ authors }) => {
  const [all, setAll] = useState(false);
  const { shown, hidden } = authorsPreview(authors, all ? Number.MAX_SAFE_INTEGER : 5);
  if (shown.length === 0) return <p className="inspector-muted">Autores desconhecidos</p>;
  return (
    <p className="inspector-muted">
      {shown.join('; ')}{' '}
      {hidden > 0 && (
        <button type="button" className="inspector-link" onClick={() => setAll(true)}>
          +{hidden} {hidden === 1 ? 'autor' : 'autores'}
        </button>
      )}
    </p>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inspector-fact">
    <span className="inspector-label">{label}</span>
    <span className="inspector-fact__value">{children}</span>
  </div>
);

const Facts: React.FC<{ article: Article }> = ({ article }) => {
  const access = accessName(article);
  return (
    <div className="inspector-facts">
      <Fact label="DOI">
        {article.doi ? (
          <a className="inspector-doi" href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer">
            {article.doi}
          </a>
        ) : (
          '—'
        )}
      </Fact>
      <Fact label="Bases">{parseSourceDatabases(article.source_databases).join(' · ') || '—'}</Fact>
      <Fact label="Acesso">
        {access ? (
          <span className={`inspector-badge inspector-badge--${access === 'Aberto' ? 'ok' : 'muted'}`}>{access}</span>
        ) : (
          '—'
        )}
      </Fact>
      <Fact label="Status">
        <span className="inspector-badge inspector-badge--info">{statusName(article)}</span>
      </Fact>
      {article.citation_count != null && <Fact label="Citações">{article.citation_count}</Fact>}
    </div>
  );
};

const Actions: React.FC<{ article: Article; handlers: ArticleRowHandlers }> = ({ article, handlers }) => (
  <div className="inspector-actions">
    {article.local_file_path ? (
      <Link to={`/articles/${article.id}`} className="btn-primary inspector-actions__main">
        <FileText size={16} /> Ler PDF
      </Link>
    ) : (
      <button
        type="button"
        className="btn-primary inspector-actions__main"
        onClick={() => handlers.onUpload(article.id)}
      >
        <Upload size={16} /> Vincular PDF
      </button>
    )}
    <button type="button" className="btn-secondary" onClick={() => handlers.onCite(article)}>
      <CopyPlus size={16} /> Citar
    </button>
    <button
      type="button"
      className="btn-secondary inspector-icon-button"
      aria-label="Editar metadados"
      title="Editar metadados"
      onClick={() => handlers.onEdit(article)}
    >
      <Edit2 size={16} />
    </button>
  </div>
);

/**
 * The article details beside the table (board 153), where a window used to cover the list: title, authors, venue,
 * the main actions, the facts, where it came from, the abstract and keywords. The list stays usable next to it.
 *
 * @example <ArticleInspector article={article} handlers={rowHandlers} history={history} onClose={close} … />
 */
export const ArticleInspector: React.FC<ArticleInspectorProps> = (props) => {
  const { article } = props;
  return (
    <aside className="article-inspector" aria-label="Detalhes do artigo">
      <div className="article-inspector__head">
        <span className="inspector-label">Detalhes</span>
        <kbd title="Espaço abre e fecha os detalhes da linha atual">Espaço</kbd>
        <span className="article-inspector__tools">
          <ArticleRowActions article={article} handlers={props.handlers} outsideSearch={props.outsideSearch} />
          <button type="button" className="row-icon-button" aria-label="Fechar detalhes" onClick={props.onClose}>
            <X size={16} />
          </button>
        </span>
      </div>
      <div className="article-inspector__body">
        <div>
          <h2 className="article-inspector__title">{article.title}</h2>
          <Authors authors={article.authors} />
          {venueLine(article) && <p className="inspector-venue">{venueLine(article)}</p>}
        </div>
        <Actions article={article} handlers={props.handlers} />
        <Facts article={article} />
        <InspectorText article={article} />
        <InspectorOrigin searchId={article.search_id} history={props.history} onShowHistory={props.onShowHistory} />
      </div>
    </aside>
  );
};
