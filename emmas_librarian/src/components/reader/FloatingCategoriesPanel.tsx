import React from 'react';
import { Tags, X as XIcon } from 'lucide-react';
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

export const FloatingCategoriesPanel: React.FC<FloatingCategoriesPanelProps> = ({
  articleId,
  isCategoriesOpen,
  setIsCategoriesOpen,
  projectCategories,
  articleCategories,
  onCategorySaved,
}) => {
  return (
    <div style={{ position: 'fixed', bottom: '2rem', left: '2rem', zIndex: 100 }}>
      {isCategoriesOpen && (
        <div
          className="card fade-in"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '1rem',
            width: '300px',
            background: 'var(--bg-main)',
            padding: '1rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)' }}>Categorias</h3>
            <button
              onClick={() => setIsCategoriesOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <XIcon size={16} />
            </button>
          </div>
          {projectCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
              Nenhuma categoria cadastrada.
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto' }}
            >
              {projectCategories.map((cat) => {
                const articleCat = articleCategories.find((ac: ArticleCategory) => ac.category_id === cat.id);
                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                      {cat.name}
                    </label>
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
        </div>
      )}
      <button
        onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
        className="btn-primary"
        style={{
          borderRadius: '2rem',
          padding: '0.8rem 1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          background: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
        title="Categorias do Artigo"
      >
        <Tags size={20} />
        Categorizar
      </button>
    </div>
  );
};
