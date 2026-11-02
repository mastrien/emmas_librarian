import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Loader2 } from 'lucide-react';
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

// 720px, approved in the validation of epic #44: at 500px the name field, the import/export buttons and long
// option names were cramped. The modal becomes a full page later; until then only its look changes.
export const CATEGORIES_MODAL_WIDTH = 720;

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
};

const cardStyle: React.CSSProperties = {
  padding: '2rem',
  width: `${CATEGORIES_MODAL_WIDTH}px`,
  maxWidth: '95%',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: 'var(--bg-main)',
};

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

const ModalHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
    <div>
      <h2
        id="categories-modal-title"
        style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <Tag className="text-primary" size={24} />
        Categorias do Projeto
      </h2>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>Crie campos personalizados para classificar os artigos.</p>
    </div>
    <button type="button" className="categories-icon-button" onClick={onClose} title="Fechar" aria-label="Fechar">
      <X size={24} />
    </button>
  </div>
);

const EmptyList: React.FC<{ loading: boolean }> = ({ loading }) => (
  <div className="categories-row" style={{ justifyContent: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
    {loading ? <Loader2 className="spin" size={24} /> : 'Nenhuma categoria criada.'}
  </div>
);

/**
 * The project categories modal: ready-made sets and JSON (#46), a new category, and the list, where each category
 * is edited in place and deleted after a question inside its row. 720px wide with titled sections, as approved in
 * the validation of epic #44.
 *
 * @example <ProjectCategoriesModal isOpen projectId={3} onClose={() => setOpen(false)} />
 */
export const ProjectCategoriesModal: React.FC<ProjectCategoriesModalProps> = ({ isOpen, projectId, onClose }) => {
  const project = useProjectCategories(projectId, isOpen);
  const { service, categories, loading, failure, change } = project;
  const [adding, setAdding] = useState(false);
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

  return createPortal(
    <div style={overlayStyle}>
      <div
        className="card fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="categories-modal-title"
        style={cardStyle}
      >
        <ModalHeader onClose={onClose} />
        <CategoryTemplatesPanel
          categories={categories}
          applySet={(entries) => service.applyCategorySet(projectId, entries)}
          readSetFile={service.readCategorySetFile}
          saveFile={service.saveExportedFile}
          onApplied={project.load}
        />
        <NewCategoryForm adding={adding} onCreate={create} />
        <section aria-label="Categorias do projeto" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 className="categories-section-title">Categorias do projeto ({categories.length})</h3>
          {failure && <CategoriesNotice notice={failure} onDismiss={project.clearFailure} />}
          {/* The spinner only stands for an empty list: a reload after a change keeps the rows on screen. */}
          {categories.length === 0 ? <EmptyList loading={loading} /> : rows}
        </section>
      </div>
    </div>,
    document.body,
  );
};
