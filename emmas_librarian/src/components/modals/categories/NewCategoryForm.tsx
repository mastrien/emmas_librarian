import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { categoryHasOptions } from './categoryText';
import { CategoryTypePicker } from './CategoryTypePicker';

interface NewCategoryFormProps {
  adding: boolean;
  /** Creates the category and answers whether it worked; the form clears only then, so a failure keeps the text. */
  onCreate: (name: string, type: string, optionNames: string[]) => Promise<boolean>;
}

/**
 * Splits the comma-typed options of a new list category, dropping blanks.
 *
 * @example splitOptions('Qualitativa, , Quantitativa ') // ['Qualitativa', 'Quantitativa']
 */
export function splitOptions(typed: string): string[] {
  return typed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The "Nova categoria" section of the categories modal: name, type, and the options of a list type.
 *
 * @example <NewCategoryForm adding={false} onCreate={async (name, type, options) => create(name, type, options)} />
 */
export const NewCategoryForm: React.FC<NewCategoryFormProps> = ({ adding, onCreate }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await onCreate(name.trim(), type, categoryHasOptions(type) ? splitOptions(options) : []);
    if (!created) return;
    setName('');
    setOptions('');
    setType('text');
  };
  return (
    <form
      onSubmit={submit}
      aria-label="Nova categoria"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '2rem' }}
    >
      <h3 className="categories-section-title">Nova categoria</h3>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="input-field"
          placeholder="Nome (ex: Metodologia)"
          aria-label="Nome da nova categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ flex: 1, minWidth: 0 }}
        />
        <CategoryTypePicker value={type} label="Tipo da nova categoria" onChange={setType} />
        <button
          type="submit"
          className="btn-primary"
          disabled={adding || !name.trim()}
          style={{ padding: '0.5rem 0.9rem' }}
        >
          {adding ? <Loader2 size={20} className="spin" /> : <Plus size={20} />} Criar
        </button>
      </div>
      {categoryHasOptions(type) && (
        <input
          type="text"
          className="input-field"
          placeholder="Opções separadas por vírgula (ex: Qualitativa, Quantitativa)"
          aria-label="Opções da nova categoria"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          required
          style={{ width: '100%' }}
        />
      )}
    </form>
  );
};
