import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { ProjectFiltering } from '../../hooks/useProjectFiltering';

const SORT_OPTIONS = [
  ['year-desc', 'Mais Recentes (Ano)'],
  ['year-asc', 'Mais Antigos (Ano)'],
  ['title-asc', 'Título (A-Z)'],
  ['title-desc', 'Título (Z-A)'],
  ['added-desc', 'Últimos Adicionados'],
  ['added-asc', 'Primeiros Adicionados'],
  ['citations-desc', 'Mais Citados (Citações)'],
  ['citations-asc', 'Menos Citados (Citações)'],
] as const;

interface ArticlesFilterBarProps {
  filtering: ProjectFiltering;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/**
 * Search box, quick filters, sidebar toggle and sort order above the article list.
 * Every change returns to the first page so the user never lands on an empty page.
 *
 * Usage:
 *   <ArticlesFilterBar filtering={filtering} isSidebarOpen={open} onToggleSidebar={toggle} />
 */
export const ArticlesFilterBar: React.FC<ArticlesFilterBarProps> = ({ filtering, isSidebarOpen, onToggleSidebar }) => {
  const resetPageAfter = <T,>(apply: (value: T) => void) => (value: T) => {
    apply(value);
    filtering.setCurrentPage(1);
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      <SearchBox value={filtering.searchTerm} onChange={resetPageAfter(filtering.setSearchTerm)} />
      <FilterToggle label="Apenas com PDF vinculado" checked={filtering.onlyWithPdf} onChange={resetPageAfter(filtering.setOnlyWithPdf)} />
      <FilterToggle label="Apenas Acesso Aberto" checked={filtering.onlyOpenAccess} onChange={resetPageAfter(filtering.setOnlyOpenAccess)} />
      <SidebarToggle isOpen={isSidebarOpen} onToggle={onToggleSidebar} />
      <SortSelect value={filtering.sortOrder} onChange={resetPageAfter(filtering.setSortOrder)} />
    </div>
  );
};

const SearchBox: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div style={{ flex: 1, position: 'relative' }}>
    <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
      <Search size={18} />
    </div>
    <input
      type="text"
      placeholder="Filtrar por título ou autor..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '0.8rem 1rem 0.8rem 2.8rem',
        fontSize: '1rem',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        outline: 'none',
        background: 'var(--bg-surface)',
        color: 'var(--text-main)',
        transition: 'border-color var(--transition-fast)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
    />
  </div>
);

const FilterToggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: 500,
      color: 'var(--text-main)',
      userSelect: 'none',
      padding: '0.5rem 1rem',
      background: checked ? 'var(--bg-surface)' : 'transparent',
      border: '1px solid ' + (checked ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-lg)',
      transition: 'all var(--transition-fast)',
      boxShadow: checked ? 'var(--shadow-sm)' : 'none',
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
    />
    <span>{label}</span>
  </label>
);

const SidebarToggle: React.FC<{ isOpen: boolean; onToggle: () => void }> = ({ isOpen, onToggle }) => (
  <button
    onClick={onToggle}
    className="btn-secondary"
    style={{
      padding: '0.5rem 1rem',
      fontSize: '0.95rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: isOpen ? 'var(--bg-surface)' : 'transparent',
      border: '1px solid ' + (isOpen ? 'var(--color-primary)' : 'var(--border-color)'),
      borderRadius: 'var(--radius-lg)',
      color: isOpen ? 'var(--color-primary)' : 'var(--text-main)',
      boxShadow: isOpen ? 'var(--shadow-sm)' : 'none',
      cursor: 'pointer',
      transition: 'all var(--transition-fast)',
    }}
  >
    <SlidersHorizontal size={18} /> Filtros
  </button>
);

const SortSelect: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div style={{ position: 'relative' }}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '0.8rem 1rem',
        fontSize: '0.95rem',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        outline: 'none',
        background: 'var(--bg-surface)',
        color: 'var(--text-main)',
        cursor: 'pointer',
      }}
    >
      {SORT_OPTIONS.map(([option, label]) => (
        <option key={option} value={option}>
          {label}
        </option>
      ))}
    </select>
  </div>
);
