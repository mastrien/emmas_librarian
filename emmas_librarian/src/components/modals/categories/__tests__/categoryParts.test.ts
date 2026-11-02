import { describe, expect, it } from 'vitest';
import { categoryHasOptions, categoryTypeName, optionsSummary } from '../categoryText';
import { initialOptions } from '../CategoryEditForm';
import { splitOptions } from '../NewCategoryForm';

describe('categoryText', () => {
  it('names each kind of category, and reads an unknown kind as text', () => {
    expect(categoryTypeName('multiselect')).toBe('Múltipla Escolha');
    expect(categoryTypeName('desconhecido')).toBe('Texto');
    expect(categoryHasOptions('enum')).toBe(true);
    expect(categoryHasOptions('boolean')).toBe(false);
  });

  it('sums up the first options, with the count and an ellipsis only when some are left out', () => {
    expect(optionsSummary([])).toBe('');
    expect(optionsSummary(['Alta'])).toBe('1 opção: Alta');
    expect(optionsSummary(['A', 'B', 'C'])).toBe('3 opções: A, B, C');
    expect(optionsSummary(['A', 'B', 'C', 'D'])).toBe('4 opções: A, B, C, …');
  });
});

describe('category forms', () => {
  it('splits typed options at commas, dropping blanks', () => {
    expect(splitOptions('Qualitativa, , Quantitativa ')).toEqual(['Qualitativa', 'Quantitativa']);
  });

  it('starts an edit from the relational options with their ids, or from a legacy comma list without', () => {
    const relational = { id: 1, project_id: 1, name: 'A', type: 'enum', parsedOptions: [{ id: 4, name: 'Alta' }] };
    const legacy = { id: 2, project_id: 1, name: 'B', type: 'enum', options: 'Coorte, , Outro' };

    expect(initialOptions(relational)).toEqual([{ id: 4, name: 'Alta' }]);
    expect(initialOptions(legacy)).toEqual([{ name: 'Coorte' }, { name: 'Outro' }]);
  });
});
