import React, { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import type { CategoryOption, ProjectCategory } from '../../../types';
import { categoryHasOptions } from './categoryText';
import { CategoryTypePicker } from './CategoryTypePicker';

/** What the edit form saves: the name and type, and the options with the ids of those that already existed. */
export interface CategoryEdit {
  name: string;
  type: string;
  options: CategoryOption[];
}

interface CategoryEditFormProps {
  category: ProjectCategory;
  saving: boolean;
  onSave: (edit: CategoryEdit) => void;
  onCancel: () => void;
}

/**
 * The options a category starts its edit with: the relational ones keep their ids, legacy comma lists get none.
 *
 * @example initialOptions({ id: 1, project_id: 1, name: 'Desenho', type: 'enum', options: 'Coorte, Outro' })
 *   // [{ name: 'Coorte' }, { name: 'Outro' }]
 */
export function initialOptions(category: ProjectCategory): CategoryOption[] {
  if (category.parsedOptions) return category.parsedOptions.map((o) => ({ ...o }));
  return (category.options ?? '')
    .split(',')
    .map((s) => ({ name: s.trim() }))
    .filter((o) => o.name);
}

// Wide enough to read the option while it is edited; long names no longer shrink to a sliver.
const chipWidth = (name: string) => `${Math.max(90, Math.round(name.length * 8.2) + 8)}px`;

const OptionChip: React.FC<{
  option: CategoryOption;
  index: number;
  onRename: (name: string) => void;
  onRemove: () => void;
}> = ({ option, index, onRename, onRemove }) => (
  <div className="categories-option-chip">
    <input
      aria-label={`Opção ${index + 1}`}
      value={option.name}
      onChange={(e) => onRename(e.target.value)}
      style={{ width: chipWidth(option.name) }}
    />
    <button
      type="button"
      className="categories-icon-button categories-icon-button--danger"
      style={{ padding: '2px' }}
      aria-label={`Remover opção ${option.name}`}
      onClick={onRemove}
    >
      <X size={14} />
    </button>
  </div>
);

const OptionChips: React.FC<{ options: CategoryOption[]; onChange: (next: CategoryOption[]) => void }> = ({
  options,
  onChange,
}) => (
  <div className="categories-options-box">
    <span className="categories-row-meta">Opções (edite, remova ou adicione):</span>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map((opt, i) => (
        <OptionChip
          key={i}
          option={opt}
          index={i}
          onRename={(name) => onChange(options.map((o, idx) => (idx === i ? { ...o, name } : o)))}
          onRemove={() => onChange(options.filter((_, idx) => idx !== i))}
        />
      ))}
      <button
        type="button"
        className="categories-add-option"
        onClick={() => onChange([...options, { name: 'Nova opção' }])}
      >
        <Plus size={14} /> Adicionar
      </button>
    </div>
  </div>
);

/**
 * A category edited in place of its row: name, type and, for list types, its options as editable chips.
 *
 * @example <CategoryEditForm category={category} saving={false} onSave={save} onCancel={() => setEditing(null)} />
 */
export const CategoryEditForm: React.FC<CategoryEditFormProps> = ({ category, saving, onSave, onCancel }) => {
  const [name, setName] = useState(category.name);
  const [type, setType] = useState(category.type);
  const [options, setOptions] = useState(() => initialOptions(category));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave({ name: name.trim(), type, options });
  };
  return (
    <form onSubmit={submit} aria-label={`Editar ${category.name}`} className="categories-edit">
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="input-field"
          aria-label="Nome da categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ flex: 1, minWidth: 0 }}
        />
        <CategoryTypePicker value={type} label="Tipo da categoria" onChange={setType} />
      </div>
      {categoryHasOptions(type) && <OptionChips options={options} onChange={setOptions} />}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button type="button" onClick={onCancel} className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || !name.trim()}
          style={{ padding: '0.4rem 1rem' }}
        >
          {saving ? <Loader2 size={16} className="spin" /> : 'Salvar'}
        </button>
      </div>
    </form>
  );
};
