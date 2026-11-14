import React, { useState, useEffect } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';
import { useProjectService } from '../../contexts/ServicesContext';
import type { ProjectCategory } from '../../types';
import { describeError } from '../../utils/describeError';
import { CategoryTemplatesPanel } from './categories/CategoryTemplatesPanel';
import { NewCategoryForm } from './categories/NewCategoryForm';
import { CategoryRow } from './categories/CategoryRow';
import { CategoryEditForm, type CategoryEdit } from './categories/CategoryEditForm';
import { CategoriesNotice, type CategoriesNoticeContent } from './categories/CategoriesNotice';
import './categories/categories.css';

interface ProjectCategoriesModalProps {
  isOpen: boolean;
  projectId: number;
  onClose: () => void;
}

// Board 178: a narrow window of lines. The ready-made sets and the JSON, which the board does not show, open below.
export const CATEGORIES_MODAL_WIDTH = 470;

// The project's categories and the calls that change them; a failure is said in the modal, not in the console only.
function useProjectCategories(projectId: number, isOpen: boolean) {
  const service = useProjectService();
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<CategoriesNoticeContent | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      setCategories(await service.getProjectCategories(projectId));
    } catch (err) {
      setFailure({ text: `Não foi possível carregar as categorias: ${describeError(err)}`, tone: 'failed' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (isOpen) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the modal opens or the project changes
  }, [isOpen, projectId]);
  // Runs a change, reloads the list, and answers whether it worked.
  const change = async (work: () => Promise<unknown>, what: string): Promise<boolean> => {
    try {
      await work();
      await load();
      return true;
    } catch (err) {
      setFailure({ text: `Não foi possível ${what}: ${describeError(err)}`, tone: 'failed' });
      return false;
    }
  };
  return { service, categories, loading, failure, clearFailure: () => setFailure(null), load, change };
}

const EmptyList: React.FC<{ loading: boolean }> = ({ loading }) => (
  <div className="categories-empty">
    {loading ? <Loader2 className="spin" size={24} /> : 'Nenhuma categoria criada.'}
  </div>
);

type CategoriesPanel = 'new' | 'sets' | null;

/**
 * The project categories window (board 178): the categories as lines with a "⋯", each edited in place and deleted
 * after a question inside its line; "Nova categoria" and the ready-made sets and JSON (#46) open below the list.
 *
 * @example <ProjectCategoriesModal isOpen projectId={3} onClose={() => setOpen(false)} />
 */
export const ProjectCategoriesModal: React.FC<ProjectCategoriesModalProps> = ({ isOpen, projectId, onClose }) => {
  const project = useProjectCategories(projectId, isOpen);
  const { service, categories, loading, failure, change } = project;
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<CategoriesPanel>(null);
  const togglePanel = (which: Exclude<CategoriesPanel, null>) => setPanel((open) => (open === which ? null : which));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const create = async (name: string, type: string, optionNames: string[]) => {
    setAdding(true);
    const options = optionNames.map((n) => ({ name: n }));
    const created = await change(
      () => service.createProjectCategory(projectId, name, type, options),
      'criar a categoria',
    );
    setAdding(false);
    return created;
  };

  const saveEdit = async (id: number, edit: CategoryEdit) => {
    setSavingEdit(true);
    const options = edit.options.map((o) => ({ ...o, name: o.name.trim() })).filter((o) => o.name);
    const saved = await change(
      () => service.updateProjectCategory(id, edit.name, edit.type, options),
      'salvar a categoria',
    );
    setSavingEdit(false);
    if (saved) setEditingId(null);
  };

  const remove = async (id: number) => {
    await change(() => service.deleteProjectCategory(id), 'excluir a categoria');
  };

  if (!isOpen) return null;

  const rows = categories.map((cat) =>
    editingId === cat.id ? (
      <CategoryEditForm
        key={cat.id}
        category={cat}
        saving={savingEdit}
        onSave={(edit) => void saveEdit(cat.id, edit)}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <CategoryRow key={cat.id} category={cat} onEdit={() => setEditingId(cat.id)} onDelete={() => remove(cat.id)} />
    ),
  );

  return (
    <Modal
      label="Categorias do Projeto"
      title="Categorias"
      description="Viram colunas na aba Categorias e perguntas na investigação"
      onClose={onClose}
      width={CATEGORIES_MODAL_WIDTH}
    >
      <section aria-label="Categorias do projeto" className="categories-list">
        {failure && <CategoriesNotice notice={failure} onDismiss={project.clearFailure} />}
        {/* The spinner only stands for an empty list: a reload after a change keeps the rows on screen. */}
        {categories.length === 0 ? <EmptyList loading={loading} /> : rows}
      </section>
      <div className="categories-actions">
        <Button size="sm" variant="ghost" aria-expanded={panel === 'new'} onClick={() => togglePanel('new')}>
          <Plus size={14} aria-hidden="true" /> Nova categoria
        </Button>
        <Button size="sm" variant="ghost" aria-expanded={panel === 'sets'} onClick={() => togglePanel('sets')}>
          Conjuntos e JSON
        </Button>
      </div>
      {panel === 'new' && <NewCategoryForm adding={adding} onCreate={create} />}
      {panel === 'sets' && (
        <CategoryTemplatesPanel
          categories={categories}
          applySet={(entries) => service.applyCategorySet(projectId, entries)}
          readSetFile={service.readCategorySetFile}
          saveFile={service.saveExportedFile}
          onApplied={project.load}
        />
      )}
      <ModalFooter hint="Cada categoria é editada na própria linha">
        <Button onClick={onClose}>Concluir</Button>
      </ModalFooter>
    </Modal>
  );
};
