import React, { useState, useEffect, useMemo } from 'react';
import { useProjectService } from '../../contexts/ServicesContext';
import { ProjectDocument } from '../../types';
import { describeError } from '../../utils/describeError';
import { reorderedItems } from './quickAccess/documentReorder';
import { useDocumentDrag } from './quickAccess/useDocumentDrag';
import { useQuickAccessForm } from './quickAccess/useQuickAccessForm';
import { QuickAccessDocumentList } from './quickAccess/QuickAccessDocumentList';
import { QuickAccessForm } from './quickAccess/QuickAccessForm';
import { Modal } from '../common/Modal';
import { useDialogs } from '../common/dialogs/DialogProvider';

interface ManageQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  documents: ProjectDocument[];
  onDocumentsChanged: () => void;
}

const distinctCategories = (documents: ProjectDocument[]) =>
  Array.from(new Set(documents.map((d) => d.category?.trim()).filter((c): c is string => Boolean(c))));

/**
 * Add, edit, delete and drag-reorder a project's quick access links and PDFs.
 *
 * Usage:
 *   <ManageQuickAccessModal isOpen={open} onClose={close} projectId={id} documents={docs} onDocumentsChanged={reload} />
 */
export const ManageQuickAccessModal: React.FC<ManageQuickAccessModalProps> = ({
  isOpen,
  onClose,
  projectId,
  documents,
  onDocumentsChanged,
}) => {
  const projectService = useProjectService();
  const { confirm, inform } = useDialogs();
  // Local copy so a drag shows the new order before the database confirms it.
  const [localDocs, setLocalDocs] = useState<ProjectDocument[]>([]);
  const form = useQuickAccessForm({ projectId, onSaved: onDocumentsChanged });
  const categories = useMemo(() => distinctCategories(documents), [documents]);

  const move = async (sourceIndex: number, dropIndex: number | null) => {
    const updated = reorderedItems(localDocs, sourceIndex, dropIndex);
    if (!updated) return;
    setLocalDocs(updated);
    try {
      await projectService.reorderProjectDocuments(
        projectId,
        updated.map((d) => d.id),
      );
      onDocumentsChanged();
    } catch (err) {
      console.error('Erro ao reordenar documentos:', err);
      setLocalDocs(documents);
    }
  };
  const drag = useDocumentDrag(move);

  useEffect(() => {
    if (isOpen) setLocalDocs(documents);
  }, [isOpen, documents]);

  useEffect(() => {
    if (isOpen) form.reset();
  }, [isOpen]);

  if (!isOpen) return null;

  const remove = async (id: number) => {
    const message = 'Tem certeza que deseja remover este documento de acesso rápido?';
    if (!(await confirm({ title: 'Remover documento', message, confirmLabel: 'Remover', danger: true }))) return;
    try {
      await projectService.deleteProjectDocument(id);
      if (form.editingId === id) form.reset();
      onDocumentsChanged();
    } catch (err: unknown) {
      await inform({ title: 'Erro ao remover', message: `Erro ao remover documento: ${describeError(err)}` });
    }
  };

  return (
    <Modal label="Gerenciar Acesso Rápido" title="Acesso rápido" onClose={onClose} width={640}>
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
        <QuickAccessDocumentList
          documents={localDocs}
          editingId={form.editingId}
          drag={drag}
          onEdit={form.startEditing}
          onDelete={remove}
        />
      </div>
      <QuickAccessForm
        draft={form.draft}
        isEditing={form.editingId !== null}
        submitting={form.submitting}
        categories={categories}
        onChange={form.update}
        onSelectFile={form.selectFile}
        onCancelEdit={form.reset}
        onSubmit={form.submit}
      />
    </Modal>
  );
};
