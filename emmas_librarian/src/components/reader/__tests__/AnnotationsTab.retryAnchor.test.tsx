import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnnotationsTab } from '../AnnotationsTab';
import { unanchoredNoteMarkdown } from '../../../utils/unanchoredNote';
import type { Annotation } from '../../../types';

const personalNote: Annotation = { id: 1, article_id: 4, content_markdown: 'Minha nota', created_at: '' };
const aiNote: Annotation = {
  id: 2,
  article_id: 4,
  content_markdown: unanchoredNoteMarkdown('Pergunta: Q', 'precipitation forecasts'),
  created_at: '',
};

function renderTab(onRetryAnchor = vi.fn()) {
  render(
    <AnnotationsTab
      highlights={[]}
      standaloneAnnotations={[personalNote, aiNote]}
      newAnnotationText=""
      setNewAnnotationText={vi.fn()}
      editingId={null}
      setEditingId={vi.fn()}
      editContent=""
      setEditContent={vi.fn()}
      onCreateStandaloneAnnotation={vi.fn()}
      onDeleteHighlight={vi.fn()}
      onDeleteStandaloneAnnotation={vi.fn()}
      onEditHighlightAnnotation={vi.fn()}
      onEditStandaloneAnnotation={vi.fn()}
      onRetryAnchor={onRetryAnchor}
      onSaveEdit={vi.fn()}
      onHighlightClick={vi.fn()}
    />,
  );
  return onRetryAnchor;
}

describe('AnnotationsTab, AI notes that did not anchor', () => {
  it('offers "Tentar ancorar de novo" only on those notes, never on the person’s own', () => {
    renderTab();

    expect(screen.getAllByRole('button', { name: 'Tentar ancorar de novo' })).toHaveLength(1);
  });

  it('hands the note to the reader when clicked', () => {
    const onRetryAnchor = renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar ancorar de novo' }));

    expect(onRetryAnchor).toHaveBeenCalledWith(aiNote);
  });
});
