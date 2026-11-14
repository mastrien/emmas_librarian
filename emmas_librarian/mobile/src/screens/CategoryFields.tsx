import React, { useState } from 'react';
import type { ArticleCategory, ProjectCategory } from '../../../src/types';

interface CategoryFieldProps {
  category: ProjectCategory;
  /** What the article has in this category, if anything. */
  current: ArticleCategory | undefined;
  /** Saves the new value; absent where the library is read-only. */
  onChange?: (value: string | null) => Promise<void>;
}

/**
 * What an article has in a category. A choice category may also carry an old free-text value from
 * before it had options: the chosen options win.
 *
 * @example valueFor(values, category)?.option_names // ['Survey']
 */
export function valueFor(values: ArticleCategory[], category: ProjectCategory): ArticleCategory | undefined {
  const mine = values.filter((value) => value.category_id === category.id);
  return mine.find((value) => value.option_ids) ?? mine[0];
}

const chosenIds = (current: ArticleCategory | undefined) => (current?.option_ids ?? []).map(String);

/**
 * The value an article has in a category, as text for a read-only screen.
 *
 * @example categoryText({ option_names: ['Survey', 'Estudo de caso'], ... }) // 'Survey, Estudo de caso'
 */
export function categoryText(current: ArticleCategory | undefined): string {
  return (current?.option_names?.join(', ') || current?.value || '').trim() || '—';
}

const TextField: React.FC<CategoryFieldProps> = ({ category, current, onChange }) => {
  const [text, setText] = useState(current?.value ?? '');
  const save = () => text !== (current?.value ?? '') && void onChange?.(text.trim() === '' ? null : text);
  return (
    <input
      className="m-input"
      aria-label={category.name}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
    />
  );
};

const ChoiceField: React.FC<CategoryFieldProps> = ({ category, current, onChange }) => (
  <select
    className="m-input"
    aria-label={category.name}
    value={chosenIds(current)[0] ?? ''}
    onChange={(e) => void onChange?.(e.target.value || null)}
  >
    <option value="">—</option>
    {(category.parsedOptions ?? []).map((option) => (
      <option key={option.id} value={String(option.id)}>
        {option.name}
      </option>
    ))}
  </select>
);

const ChoicesField: React.FC<CategoryFieldProps> = ({ category, current, onChange }) => {
  const chosen = chosenIds(current);
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((each) => each !== id) : [...chosen, id];
    void onChange?.(next.length > 0 ? next.join(',') : null);
  };
  return (
    <fieldset className="m-choices" aria-label={category.name}>
      {(category.parsedOptions ?? []).map((option) => (
        <label key={option.id}>
          <input
            type="checkbox"
            checked={chosen.includes(String(option.id))}
            onChange={() => toggle(String(option.id))}
          />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
};

const FIELDS: Record<string, React.FC<CategoryFieldProps>> = { enum: ChoiceField, multiselect: ChoicesField };

/**
 * One category of an article: its value as text, or a field to change it where writing is possible
 * (a text box, one choice, or several, by the category's type).
 *
 * @example <CategoryField category={category} current={value} onChange={(v) => writer.setArticleCategory(id, category.id, v)} />
 */
export const CategoryField: React.FC<CategoryFieldProps> = (props) => {
  const Field = FIELDS[props.category.type] ?? TextField;
  return (
    <div className="m-field">
      <span className="m-field__label">{props.category.name}</span>
      {props.onChange ? <Field {...props} /> : <span className="m-field__value">{categoryText(props.current)}</span>}
    </div>
  );
};
