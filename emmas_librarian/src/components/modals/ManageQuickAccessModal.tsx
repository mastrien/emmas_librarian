import React, { useState, useEffect, useMemo } from 'react';
import { failureNotice } from '../common/dialogs/failureNotice';
import { Plus } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import { ProjectDocument } from '../../types';

import { inGroupOrder, reorderedInGroups } from './quickAccess/groupDocuments';
import { useDocumentDrag } from './quickAccess/useDocumentDrag';
import { useQuickAccessForm } from './quickAccess/useQuickAccessForm';
import { QuickAccessDocumentList } from './quickAccess/QuickAccessDocumentList';
import { QuickAccessForm } from './quickAccess/QuickAccessForm';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useDialogs } from '../common/dialogs/DialogProvider';
import './modalForms.css';
import './quickAccess/quickAccess.css';

interface ManageQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  documents: ProjectDocument[];
  onDocumentsChanged: () => void;
}

type QuickAccessView = 'list' | 'form';

const distinctCategories = (documents: ProjectDocument[]) =>
  Array.from(new Set(documents.map((d) => d.category?.trim()).filter((c): c is string => Boolean(c))));

const titleOf = (view: QuickAccessView, editing: boolean, groupFirst: boolean): string => {
  if (view === 'list') return 'Acesso rápido';
  if (editing) return 'Editar item';
  return groupFirst ? 'Novo grupo' : 'Novo link ou arquivo';
};

/**
 * A project's quick access links and PDFs by group (board 178): drag to reorder, rename a group, and a second view to
 * add or edit one.
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
  const [view, setView] = useState<QuickAccessView>('list');
  const [groupFirst, setGroupFirst] = useState(false);
  const form = useQuickAccessForm({
    projectId,
    onSaved: () => {
      onDocumentsChanged();
      setView('list');
    },
  });
  const categories = useMemo(() => distinctCategories(documents), [documents]);
  const ordered = useMemo(() => inGroupOrder(localDocs), [localDocs]);

  const move = async (sourceIndex: number, dropIndex: number | null) => {
    const updated = reorderedInGroups(ordered, sourceIndex, dropIndex);
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
    if (!isOpen) return;
    form.reset();
    setView('list');
  }, [isOpen]);

  if (!isOpen) return null;

  const openForm = (newGroup: boolean) => {
    form.reset();
    setGroupFirst(newGroup);
    setView('form');
  };

  const edit = (doc: ProjectDocument) => {
    form.startEditing(doc);
    setGroupFirst(false);
    setView('form');
  };

  const backToList = () => {
    form.reset();
    setView('list');
  };

  const remove = async (id: number) => {
    const message = 'Tem certeza que deseja remover este documento de acesso rápido?';
    if (!(await confirm({ title: 'Remover documento', message, confirmLabel: 'Remover', danger: true }))) return;
    try {
      await projectService.deleteProjectDocument(id);
      onDocumentsChanged();
    } catch (err: unknown) {
      await inform(failureNotice('Não conseguimos remover o documento', 'O documento continua no acesso rápido.', err));
    }
  };

  // A group is only the category its documents share, so renaming it renames the category on each of them.
  const renameGroup = async (from: string, to: string) => {
    const members = documents.filter((d) => d.category?.trim() === from);
    try {
      for (const doc of members) {
        await projectService.updateProjectDocument(doc.id, doc.title, doc.url || null, doc.local_file_path || null, to);
      }
      onDocumentsChanged();
    } catch (err: unknown) {
      await inform(failureNotice('Não conseguimos renomear o grupo', 'O grupo manteve o nome.', err));
    }
  };

  const title = titleOf(view, form.editingId !== null, groupFirst);
  return (
    <Modal label="Gerenciar Acesso Rápido" title={title} onClose={onClose} width={420}>
      {view === 'form' ? (
        <QuickAccessForm
          draft={form.draft}
          isEditing={form.editingId !== null}
          submitting={form.submitting}
          categories={categories}
          groupFirst={groupFirst}
          onChange={form.update}
          onSelectFile={form.selectFile}
          onCancelEdit={backToList}
          onSubmit={form.submit}
        />
      ) : (
        <div className="modal-form">
          <QuickAccessDocumentList
            documents={ordered}
            editingId={form.editingId}
            drag={drag}
            onEdit={edit}
            onDelete={remove}
            onRenameGroup={renameGroup}
          />
          <div className="quick-access-add">
            <Button size="sm" onClick={() => openForm(false)}>
              <Plus size={14} aria-hidden="true" /> Link ou arquivo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => openForm(true)}>
              Novo grupo
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
