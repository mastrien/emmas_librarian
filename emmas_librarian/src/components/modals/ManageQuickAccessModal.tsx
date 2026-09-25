import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import { ProjectDocument } from '../../types';
import { describeError } from '../../utils/describeError';
import { reorderedItems } from './quickAccess/documentReorder';
import { useDocumentDrag } from './quickAccess/useDocumentDrag';
import { useQuickAccessForm } from './quickAccess/useQuickAccessForm';
import { QuickAccessDocumentList } from './quickAccess/QuickAccessDocumentList';
import { QuickAccessForm } from './quickAccess/QuickAccessForm';

interface ManageQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  documents: ProjectDocument[];
  onDocumentsChanged: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
};

const cardStyle: React.CSSProperties = {
  padding: '2rem',
  width: '640px',
  maxWidth: '95%',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-main)',
};

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
    if (!window.confirm('Tem certeza que deseja remover este documento de acesso rápido?')) return;
    try {
      await projectService.deleteProjectDocument(id);
      if (form.editingId === id) form.reset();
      onDocumentsChanged();
    } catch (err: unknown) {
      alert(`Erro ao remover documento: ${describeError(err)}`);
    }
  };

  return createPortal(
    <div style={overlayStyle}>
      <div className="card fade-in" style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0 }}>Gerenciar Acesso Rápido</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <XIcon size={20} />
          </button>
        </div>
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
      </div>
    </div>,
    document.body,
  );
};
