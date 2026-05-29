import React, { useState } from 'react';
import { ProjectCategory } from '../types';
import { projectService } from '../services/api';

interface CategoryCellProps {
  articleId: number;
  category: ProjectCategory;
  initialValue: string;
}

export const CategoryCell: React.FC<CategoryCellProps> = ({ articleId, category, initialValue }) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async (newValue: string) => {
    setValue(newValue);
    setIsEditing(false);
    try {
      await projectService.setArticleCategory(articleId, category.id, newValue);
    } catch (err) {
      console.error(err);
    }
  };

  if (category.type === 'boolean') {
    return (
      <select 
        value={value} 
        onChange={(e) => handleSave(e.target.value)}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem'
        }}
      >
        <option value="">-</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => handleSave(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave(value);
          if (e.key === 'Escape') {
            setValue(initialValue);
            setIsEditing(false);
          }
        }}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-main)',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem',
          width: '100px'
        }}
      />
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      style={{
        cursor: 'pointer',
        minHeight: '20px',
        minWidth: '60px',
        display: 'inline-block',
        fontSize: '0.85rem',
        padding: '0.2rem 0.5rem',
        borderRadius: 'var(--radius-sm)',
        background: value ? 'var(--bg-surface)' : 'transparent',
        border: value ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
        color: value ? 'var(--text-main)' : 'var(--text-muted)'
      }}
    >
      {value || 'Adicionar'}
    </div>
  );
};
