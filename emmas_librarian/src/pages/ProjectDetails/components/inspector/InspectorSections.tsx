import React from 'react';
import type { Article, SearchHistoryItem } from '../../../../types';
import { splitSemicolonList } from '../../../../components/modals/articleDetails/articleDetailsFormat';

/**
 * Which search or import brought the article, as one muted line with a link to it; a manual entry says so
 * (board 153 has no section for it, so it stays small, under the abstract).
 *
 * @example <InspectorOrigin searchId={article.search_id} history={history} onShowHistory={openHistory} />
 */
export const InspectorOrigin: React.FC<{
  searchId?: number;
  history: SearchHistoryItem[];
  onShowHistory: () => void;
}> = ({ searchId, history, onShowHistory }) => {
  if (!searchId) return <p className="inspector-muted">Cadastro manual</p>;
  const search = history.find((h) => h.id === searchId);
  const kind = search?.unified_query.startsWith('Importação') ? 'Importação' : 'Busca';
  return (
    <p className="inspector-muted">
      Veio da{' '}
      <button type="button" className="inspector-link" onClick={onShowHistory}>
        {kind} #{searchId}
      </button>
    </p>
  );
};

const Chips: React.FC<{ label: string; items: string[] }> = ({ label, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="inspector-section">
      <span className="inspector-label">{label}</span>
      <div className="inspector-chips">
        {items.map((item) => (
          <span key={item} className="inspector-chip">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * The reading part of the panel (board 153): the abstract in the reading face, then the keywords as chips and, when
 * there are any, the affiliations and the cited references, all in the panel's own type scale.
 *
 * @example <InspectorText article={article} />
 */
export const InspectorText: React.FC<{ article: Article }> = ({ article }) => (
  <>
    <div className="inspector-section">
      <span className="inspector-label">Resumo</span>
      <p className="inspector-abstract">{article.abstract || 'Nenhum resumo disponível para este artigo.'}</p>
    </div>
    <Chips label="Palavras-chave do autor" items={splitSemicolonList(article.author_keywords)} />
    <Chips label="Palavras-chave indexadas" items={splitSemicolonList(article.index_keywords)} />
    {article.affiliations && (
      <div className="inspector-section">
        <span className="inspector-label">Afiliações</span>
        <p className="inspector-muted">{article.affiliations}</p>
      </div>
    )}
    {article.references_list && (
      <div className="inspector-section">
        <span className="inspector-label">Referências citadas</span>
        <ol className="inspector-references">
          {article.references_list.split(';').map((ref, index) => (
            <li key={index}>{ref.trim()}</li>
          ))}
        </ol>
      </div>
    )}
  </>
);
