import { describe, it, expect } from 'vitest';
import { describePhoneChange } from '../phoneChangeText';
import type { PendingPhoneChange } from '../../../types/remoteAccess';

const change = (partial: Partial<PendingPhoneChange>): PendingPhoneChange => ({
  opId: 'o',
  entity: 'projects',
  kind: 'update',
  fields: null,
  current: null,
  changedAt: 't',
  ...partial,
});

describe('describePhoneChange', () => {
  it('names an addition by its entity and what it says', () => {
    expect(
      describePhoneChange(
        change({
          kind: 'insert',
          entity: 'project_diary',
          fields: { entry_date: '2026-11-21', content: 'Li dois artigos' },
        }),
      ),
    ).toMatchObject({
      kind: 'Adicionar',
      entity: 'Página do diário',
      detail: 'Li dois artigos',
      before: null,
      destructive: false,
    });
  });

  it('shows what an alteration says now on this computer, when it differs', () => {
    expect(
      describePhoneChange(change({ fields: { name: 'Novo nome' }, current: { name: 'Nome antigo' } })),
    ).toMatchObject({
      kind: 'Alterar',
      detail: 'Novo nome',
      before: 'Nome antigo',
    });
  });

  it('does not repeat what is already the same', () => {
    expect(describePhoneChange(change({ fields: { name: 'Igual' }, current: { name: 'Igual' } })).before).toBeNull();
  });

  it('marks a deletion as destructive and shows what would be removed', () => {
    expect(
      describePhoneChange(
        change({ kind: 'delete', entity: 'annotations', current: { content_markdown: 'Escala diferente' } }),
      ),
    ).toMatchObject({
      kind: 'Excluir',
      entity: 'Anotação',
      detail: 'Escala diferente',
      destructive: true,
    });
  });

  it('cuts a long text, and keeps an unknown entity name as it came', () => {
    const text = describePhoneChange(
      change({ entity: 'mystery', kind: 'insert', fields: { content: 'x'.repeat(300) } }),
    );
    expect(text.entity).toBe('mystery');
    expect(text.detail).toHaveLength(141);
    expect(text.detail.endsWith('…')).toBe(true);
  });

  it('says there is no text when the row has none', () => {
    expect(describePhoneChange(change({ kind: 'insert', fields: { created_at: 'x' } })).detail).toBe('sem texto');
  });
});
