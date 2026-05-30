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

  if (category.type === 'enum') {
    const initialOptions = category.options ? category.options.split(',').map(o => o.trim()) : [];
    const [localOptions, setLocalOptions] = useState(initialOptions);

    const handleChange = async (val: string) => {
      if (val === '__ADD_NEW__') {
        const newOpt = window.prompt('Digite a nova opção para esta categoria:');
        if (newOpt && newOpt.trim()) {
          const trimmed = newOpt.trim();
          if (!localOptions.includes(trimmed)) {
            const updatedOptions = [...localOptions, trimmed].join(', ');
            try {
              await projectService.updateProjectCategory(category.id, category.name, category.type, updatedOptions);
              setLocalOptions([...localOptions, trimmed]);
              handleSave(trimmed);
            } catch (err) {
              console.error(err);
              alert('Erro ao adicionar opção.');
            }
          } else {
            handleSave(trimmed);
          }
        }
      } else {
        handleSave(val);
      }
    };

    // Make sure the selected value is in localOptions, just in case
    const optionsToRender = [...localOptions];
    if (value && !optionsToRender.includes(value)) {
      optionsToRender.push(value);
    }

    return (
      <select 
        value={value} 
        onChange={(e) => handleChange(e.target.value)}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem',
          maxWidth: '120px'
        }}
      >
        <option value="">-</option>
        {optionsToRender.map((opt, idx) => (
          <option key={idx} value={opt}>{opt}</option>
        ))}
        <option value="__ADD_NEW__">+ Adicionar nova opção...</option>
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
