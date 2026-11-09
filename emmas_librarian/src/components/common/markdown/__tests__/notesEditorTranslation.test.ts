import { describe, expect, it } from 'vitest';
import { notesEditorTranslation } from '../notesEditorTranslation';

describe('notesEditorTranslation', () => {
  it('translates the formatting bar', () => {
    expect(notesEditorTranslation('toolbar.bold', 'Bold')).toBe('Negrito');
    expect(notesEditorTranslation('toolbar.blockTypeSelect.placeholder', 'Block type')).toBe('Tipo de texto');
  });

  it('fills the placeholders', () => {
    expect(notesEditorTranslation('toolbar.blockTypes.heading', 'Heading {{level}}', { level: 2 })).toBe('Título 2');
  });

  it('keeps the library text for keys it does not know', () => {
    expect(notesEditorTranslation('toolbar.table', 'Insert Table')).toBe('Insert Table');
  });
});
