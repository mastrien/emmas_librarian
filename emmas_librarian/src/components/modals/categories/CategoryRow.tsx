import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ProjectCategory } from '../../../types';
import { categoryOptionNames } from '../../../utils/categoryTemplates';
import { categoryTypeName, optionsSummary } from './categoryText';
import { CategoriesNotice } from './CategoriesNotice';

interface CategoryRowProps {
  category: ProjectCategory;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

/**
 * One category in the modal: its name, its type as a chip with the first options, a pencil to edit (it was the
 * tag icon of the title) and a bin that asks inside the row before deleting.
 *
 * @example <CategoryRow category={category} onEdit={() => setEditing(category.id)} onDelete={() => remove(category.id)} />
 */
export const CategoryRow: React.FC<CategoryRowProps> = ({ category, onEdit, onDelete }) => {
  const [asking, setAsking] = useState(false);
  if (asking) {
    const text = `Excluir "${category.name}"? Ela sai de todos os artigos deste projeto.`;
    const notice = { text, tone: 'ask' as const, confirmLabel: 'Excluir' };
    return <CategoriesNotice notice={notice} onDismiss={() => setAsking(false)} onConfirm={() => void onDelete()} />;
  }
  return (
    <div className="categories-row">
      <div style={{ minWidth: 0 }}>
        <div className="categories-row-name">{category.name}</div>
        <div className="categories-row-meta">
          <span className="categories-type-chip">{categoryTypeName(category.type)}</span>
          {optionsSummary(categoryOptionNames(category))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', flex: 'none' }}>
        <button
          type="button"
          className="categories-icon-button"
          onClick={onEdit}
          title="Editar categoria"
          aria-label={`Editar ${category.name}`}
        >
          <Pencil size={18} />
        </button>
        <button
          type="button"
          className="categories-icon-button categories-icon-button--danger"
          onClick={() => setAsking(true)}
          title="Excluir categoria"
          aria-label={`Excluir ${category.name}`}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
