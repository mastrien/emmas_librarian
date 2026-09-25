import React, { useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import type { ProjectDocument } from '../../../types';
import { describeError } from '../../../utils/describeError';

export interface QuickAccessDraft {
  title: string;
  url: string;
  filePath?: string;
  category: string;
}

const EMPTY_DRAFT: QuickAccessDraft = { title: '', url: '', filePath: undefined, category: '' };

const draftFromDocument = (doc: ProjectDocument): QuickAccessDraft => ({
  title: doc.title,
  url: doc.url || '',
  filePath: doc.local_file_path || undefined,
  category: doc.category || '',
});

// A document is either a link or an attached PDF, never both.
const validationError = (draft: QuickAccessDraft): string | null => {
  if (!draft.title.trim()) return 'O título é obrigatório.';
  if (draft.url.trim() && draft.filePath) return 'Por favor, escolha apenas um: Link (URL) ou Arquivo PDF.';
  return null;
};

// IPC serialization drops trailing undefined args; use null to preserve arg positions
const documentArgs = (draft: QuickAccessDraft) =>
  [draft.title.trim(), draft.url.trim() || null, draft.filePath || null, draft.category.trim() || null] as const;

interface QuickAccessFormOptions {
  projectId: number;
  onSaved: () => void;
}

/**
 * Add/edit form state for a quick access document, including PDF selection and saving.
 *
 * Usage:
 *   const form = useQuickAccessForm({ projectId, onSaved: reload });
 *   <form onSubmit={form.submit}>...</form>
 */
export function useQuickAccessForm({ projectId, onSaved }: QuickAccessFormOptions) {
  const projectService = useProjectService();
  const [draft, setDraft] = useState<QuickAccessDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setSubmitting(false);
  };

  const startEditing = (doc: ProjectDocument) => {
    setEditingId(doc.id);
    setDraft(draftFromDocument(doc));
  };

  const update = (changes: Partial<QuickAccessDraft>) => setDraft((prev) => ({ ...prev, ...changes }));

  const selectFile = async () => {
    try {
      const selected = await projectService.openPdfDialog();
      if (selected) update({ filePath: selected });
    } catch {
      alert('Erro ao selecionar o arquivo PDF');
    }
  };

  const persist = () =>
    editingId !== null
      ? projectService.updateProjectDocument(editingId, ...documentArgs(draft))
      : projectService.createProjectDocument(projectId, ...documentArgs(draft));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validationError(draft);
    if (error) return alert(error);
    setSubmitting(true);
    try {
      await persist();
      reset();
      onSaved();
    } catch (err: unknown) {
      alert(`Erro ao salvar documento: ${describeError(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return { draft, editingId, submitting, update, reset, startEditing, selectFile, submit };
}
