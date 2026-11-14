import React from 'react';
import { Tag } from 'lucide-react';
import { Modal } from '../common/Modal';
import { CategoryCell } from '../common/CategoryCell';

import { ProjectCategory, ArticleCategory } from '../../types';

interface FloatingCategoriesPanelProps {
  articleId: number;
  isCategoriesOpen: boolean;
  setIsCategoriesOpen: (open: boolean) => void;
  projectCategories: ProjectCategory[];
  articleCategories: ArticleCategory[];
  onCategorySaved?: () => void;
}

/**
 * The article's categories in the reader, in the app's own window (a hand-made floating card before: validation,
 * step 28). Each project category has its value editor; closes with the X or Esc.
 *
 * @example <FloatingCategoriesPanel articleId={4} isCategoriesOpen setIsCategoriesOpen={set} projectCategories={cats} articleCategories={mine} />
 */
export const FloatingCategoriesPanel: React.FC<FloatingCategoriesPanelProps> = ({
  articleId,
  isCategoriesOpen,
  setIsCategoriesOpen,
  projectCategories,
  articleCategories,
  onCategorySaved,
}) => {
  if (!isCategoriesOpen) return null;
  return (
    <Modal
      label="Categorias"
      title="Categorias"
      description="Os valores deste artigo em cada categoria do projeto."
      icon={<Tag size={18} aria-hidden="true" />}
      width={420}
      onClose={() => setIsCategoriesOpen(false)}
    >
      {projectCategories.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Nenhuma categoria cadastrada.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {projectCategories.map((cat) => {
            const articleCat = articleCategories.find((ac: ArticleCategory) => ac.category_id === cat.id);
            return (
              <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>{cat.name}</span>
                <CategoryCell
                  articleId={articleId}
                  category={cat}
                  initialValue={articleCat?.value || ''}
                  onCategorySaved={onCategorySaved}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
