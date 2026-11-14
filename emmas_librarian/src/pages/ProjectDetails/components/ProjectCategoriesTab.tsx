import React, { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Article, ProjectCategory } from '../../../types';
import { CategoryCell } from '../../../components/common/CategoryCell';
import { SegmentedControl } from '../../../components/common/SegmentedControl';
import type { ProjectArticleCategory } from './categoriesTab/categoryCells';
import {
  categoryTypeLabel,
  filledCategories,
  filledCount,
  matrixCell,
  matrixRows,
  type MatrixCell,
  type MatrixOrder,
} from './categoriesTab/categoryMatrix';
import './categoriesTab/categoriesTab.css';

interface ProjectCategoriesTabProps {
  projectCategories: ProjectCategory[];
  articleCategories: ProjectArticleCategory[];
  nonArchivedArticles: Article[];
  onCategorySaved?: () => void;
  onManageCategories: () => void;
}

const LIST_CHIPS_SHOWN = 3;

const CellView: React.FC<{ cell: MatrixCell }> = ({ cell }) => {
  if (cell.kind === 'empty') return <span className="matrix-empty">—</span>;
  if (cell.kind === 'text') return <span className="matrix-text">{cell.text}</span>;
  if (cell.kind === 'yesno') {
    return (
      <span className={`matrix-badge matrix-badge--${cell.yes ? 'yes' : 'no'}`}>
        {cell.yes ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
        {cell.yes ? 'Sim' : 'Não'}
      </span>
    );
  }
  const hidden = cell.items.length - LIST_CHIPS_SHOWN;
  return (
    <span className="matrix-chips" title={cell.items.join(', ')}>
      {cell.items.slice(0, LIST_CHIPS_SHOWN).map((item) => (
        <span key={item} className="matrix-chip">
          {item}
        </span>
      ))}
      {hidden > 0 && <span className="matrix-chip matrix-chip--more">+{hidden}</span>}
    </span>
  );
};

interface CellProps {
  article: Article;
  category: ProjectCategory;
  values: ProjectArticleCategory[];
  editing: boolean;
  onEdit: () => void;
  onSaved: () => void;
}

// A click on the cell swaps its value for the category's own editor; saving puts the value back.
const MatrixCellButton: React.FC<CellProps> = ({ article, category, values, editing, onEdit, onSaved }) => {
  const raw = values.find((v) => Number(v.article_id) === article.id && Number(v.category_id) === category.id)?.value;
  if (editing) {
    return (
      <td className="matrix-cell matrix-cell--editing">
        <CategoryCell
          articleId={article.id}
          category={category}
          initialValue={raw ?? ''}
          onCategorySaved={onSaved}
          startEditing
        />
      </td>
    );
  }
  return (
    <td className="matrix-cell">
      <button
        type="button"
        className="matrix-cell__button"
        aria-label={`${category.name} de "${article.title}": editar`}
        onClick={onEdit}
      >
        <CellView cell={matrixCell(values, article.id, category)} />
      </button>
    </td>
  );
};

const MatrixHead: React.FC<{ categories: ProjectCategory[]; values: ProjectArticleCategory[]; articles: Article[] }> = (
  props,
) => (
  <thead>
    <tr>
      <th className="matrix-th-article">
        <span className="matrix-th__kind">Artigo</span>
      </th>
      {props.categories.map((cat) => (
        <th key={cat.id}>
          <span className="matrix-th__kind">
            {categoryTypeLabel(cat.type)} · {filledCount(props.values, props.articles, cat)}/{props.articles.length}
          </span>
          {cat.name}
        </th>
      ))}
    </tr>
  </thead>
);

const ORDER_OPTIONS = [
  { value: 'filled-first' as const, label: 'Preenchidos primeiro' },
  { value: 'project' as const, label: 'Ordem do projeto' },
];

const MatrixBar: React.FC<{
  query: string;
  onQuery: (q: string) => void;
  order: MatrixOrder;
  onOrder: (o: MatrixOrder) => void;
  summary: string;
}> = (props) => (
  <div className="matrix-bar">
    <label className="matrix-search">
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        placeholder="Filtrar artigos"
        aria-label="Filtrar artigos"
        value={props.query}
        onChange={(e) => props.onQuery(e.target.value)}
      />
    </label>
    <SegmentedControl label="Ordem das linhas" options={ORDER_OPTIONS} value={props.order} onChange={props.onOrder} />
    <span className="matrix-summary">{props.summary}</span>
  </div>
);

const NoCategories: React.FC<{ onManage: () => void }> = ({ onManage }) => (
  <div className="matrix-empty-state">
    <p>
      Nenhuma categoria ainda. Uma categoria é uma coluna para anotar o mesmo dado em todos os artigos: a técnica usada,
      o local do estudo, se o método funcionou.
    </p>
    <button type="button" className="btn-primary" onClick={onManage}>
      Criar a primeira categoria
    </button>
  </div>
);

/**
 * Categories as a matrix (board 156): one column per category with its kind and how many articles have it, one row
 * per non-archived article; a click on a cell edits it in place. Filter by title; filled rows first or the project
 * order.
 *
 * @example <ProjectCategoriesTab projectCategories={cats} articleCategories={values} nonArchivedArticles={a} … />
 */
export const ProjectCategoriesTab: React.FC<ProjectCategoriesTabProps> = (props) => {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<MatrixOrder>('filled-first');
  const [editing, setEditing] = useState<string | null>(null);
  const { projectCategories: categories, articleCategories: values, nonArchivedArticles: articles } = props;
  if (categories.length === 0) return <NoCategories onManage={props.onManageCategories} />;
  const rows = matrixRows(articles, values, categories, { query, order });
  const withAny = articles.filter((a) => filledCategories(values, a.id, categories) > 0).length;
  const saved = () => {
    setEditing(null);
    props.onCategorySaved?.();
  };
  return (
    <div className="categories-matrix">
      <MatrixBar
        query={query}
        onQuery={setQuery}
        order={order}
        onOrder={setOrder}
        summary={`${withAny} de ${articles.length} artigos com alguma categoria`}
      />
      <div className="matrix-scroll">
        {/* Escape leaves a cell's editor without changing the value. */}
        <table className="matrix-table" onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}>
          <MatrixHead categories={categories} values={values} articles={articles} />
          <tbody>
            {rows.map((article) => (
              <tr key={article.id}>
                <td className="matrix-cell matrix-cell--article" title={article.title}>
                  {article.title}
                </td>
                {categories.map((cat) => (
                  <MatrixCellButton
                    key={cat.id}
                    article={article}
                    category={cat}
                    values={values}
                    editing={editing === `${article.id}:${cat.id}`}
                    onEdit={() => setEditing(`${article.id}:${cat.id}`)}
                    onSaved={saved}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="matrix-no-rows">Nenhum artigo encontrado.</p>}
      </div>
    </div>
  );
};
