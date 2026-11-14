import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ProjectCategory } from '../../../types';
import { RowActionsButton } from '../../common/RowActionsButton';
import { categoryTypeName } from './categoryText';
import { CategoriesNotice } from './CategoriesNotice';

interface CategoryRowProps {
  category: ProjectCategory;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

/**
 * One category as a line of the window (board 178): its name, its type as a badge and a "⋯" with edit and delete.
 * Delete asks inside the line before it happens.
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
      <span className="categories-row-name">{category.name}</span>
      <span className="categories-type-chip">{categoryTypeName(category.type)}</span>
      <RowActionsButton
        label={`Ações de ${category.name}`}
        items={[
          { label: 'Editar', icon: <Pencil size={14} aria-hidden="true" />, onSelect: onEdit },
          {
            label: 'Excluir',
            icon: <Trash2 size={14} aria-hidden="true" />,
            onSelect: () => setAsking(true),
            danger: true,
          },
        ]}
      />
    </div>
  );
};
