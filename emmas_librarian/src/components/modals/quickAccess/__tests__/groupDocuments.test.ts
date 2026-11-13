import { describe, it, expect } from 'vitest';
import type { ProjectDocument } from '../../../../types';
import { groupDocuments, inGroupOrder, reorderedInGroups } from '../groupDocuments';

const doc = (id: number, category?: string | null): ProjectDocument =>
  ({ id, project_id: 1, title: `Doc ${id}`, position: id, created_at: '2026-01-01', category }) as ProjectDocument;

describe('groupDocuments', () => {
  it('gathers the documents of a category, in the order the groups first appear', () => {
    const groups = groupDocuments([doc(1, 'Ferramentas'), doc(2, 'Reuniões'), doc(3, 'Ferramentas')]);

    expect(groups.map((g) => g.name)).toEqual(['Ferramentas', 'Reuniões']);
    expect(groups[0].documents.map((d) => d.id)).toEqual([1, 3]);
  });

  it('puts the documents with no category first, with no name', () => {
    const groups = groupDocuments([doc(1, 'Modelos'), doc(2, null), doc(3, '  ')]);

    expect(groups[0]).toMatchObject({ name: null });
    expect(groups[0].documents.map((d) => d.id)).toEqual([2, 3]);
    expect(groups[1].name).toBe('Modelos');
  });

  it('is empty when there are no documents', () => {
    expect(groupDocuments([])).toEqual([]);
  });

  it('lists the documents in the order the groups show them', () => {
    expect(inGroupOrder([doc(1, 'X'), doc(2, 'Y'), doc(3, 'X')]).map((d) => d.id)).toEqual([1, 3, 2]);
  });
});

describe('reorderedInGroups', () => {
  const docs = [doc(1, 'A'), doc(2, 'A'), doc(3, 'B'), doc(4, 'B')];

  it('moves a document inside its own group', () => {
    expect(reorderedInGroups(docs, 0, 2)?.map((d) => d.id)).toEqual([2, 1, 3, 4]);
  });

  it('keeps a drop at the edge between two groups, where the document stays in its own', () => {
    expect(reorderedInGroups(docs, 0, 2)).not.toBeNull();
    expect(reorderedInGroups(docs, 3, 4)).toBeNull();
  });

  it('refuses a drop in the middle of another group, which the list would draw back where it was', () => {
    expect(reorderedInGroups(docs, 0, 3)).toBeNull();
    expect(reorderedInGroups(docs, 2, 1)).toBeNull();
  });

  it('is null when nothing changes or the drop is out of range', () => {
    expect(reorderedInGroups(docs, 1, 2)).toBeNull();
    expect(reorderedInGroups(docs, 0, null)).toBeNull();
  });
});
