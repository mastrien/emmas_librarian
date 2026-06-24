// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Tag, Loader2 } from 'lucide-react';
import { useProjectService } from '../../contexts/ServicesContext';
import { ProjectCategory } from '../../types';

interface ProjectCategoriesModalProps {
  isOpen: boolean;
  projectId: number;
  onClose: () => void;
}

export const ProjectCategoriesModal: React.FC<ProjectCategoriesModalProps> = ({ isOpen, projectId, onClose }) => {
  const projectService = useProjectService();
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('text');
  const [newCatOptions, setNewCatOptions] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatType, setEditCatType] = useState('text');
  const [editCatOptions, setEditCatOptions] = useState<{ id?: number; name: string }[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await projectService.getProjectCategories(projectId);
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAdding(true);
    try {
      const parsedOpts = newCatOptions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      await projectService.createProjectCategory(projectId, newCatName.trim(), newCatType, parsedOpts);
      setNewCatName('');
      setNewCatOptions('');
      setNewCatType('text');
      await loadCategories();
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza? Isso removerá a categoria de todos os artigos deste projeto.')) return;
    try {
      await projectService.deleteProjectCategory(id);
      await loadCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = (cat: ProjectCategory) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatType(cat.type);

    if (cat.parsedOptions) {
      setEditCatOptions(cat.parsedOptions);
    } else if (cat.options) {
      setEditCatOptions(
        cat.options
          .split(',')
          .map((s) => ({ name: s.trim() }))
          .filter((o) => o.name),
      );
    } else {
      setEditCatOptions([]);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCatId === null || !editCatName.trim()) return;

    setSavingEdit(true);
    try {
      const cleanOpts = editCatOptions.map((o) => ({ ...o, name: o.name.trim() })).filter((o) => o.name);
      await projectService.updateProjectCategory(editingCatId, editCatName.trim(), editCatType, cleanOpts);
      setEditingCatId(null);
      await loadCategories();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
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
      }}
    >
      <div
        className="card fade-in"
        style={{
          padding: '2rem',
          width: '500px',
          maxWidth: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-main)',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}
        >
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag className="text-primary" size={24} />
              Categorias do Projeto
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Crie campos personalizados para classificar os artigos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={handleAdd}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Nome (ex: Metodologia)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <select
              className="input-field"
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="text">Texto</option>
              <option value="boolean">Sim/Não</option>
              <option value="enum">Lista de Opções</option>
              <option value="multiselect">Múltipla Escolha</option>
            </select>
            <button
              type="submit"
              className="btn-primary"
              disabled={adding || !newCatName.trim()}
              style={{ padding: '0.5rem' }}
            >
              {adding ? <Loader2 size={20} className="spin" /> : <Plus size={20} />}
            </button>
          </div>
          {(newCatType === 'enum' || newCatType === 'multiselect') && (
            <input
              type="text"
              className="input-field"
              placeholder="Opções separadas por vírgula (ex: Qualitativa, Quantitativa)"
              value={newCatOptions}
              onChange={(e) => setNewCatOptions(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          )}
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="spin" size={24} style={{ margin: '0 auto' }} />
            </div>
          ) : categories.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              Nenhuma categoria criada.
            </div>
          ) : (
            categories.map((cat) =>
              editingCatId === cat.id ? (
                <form
                  key={cat.id}
                  onSubmit={handleSaveEdit}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    padding: '1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-primary)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      required
                      style={{ flex: 1 }}
                    />
                    <select
                      className="input-field"
                      value={editCatType}
                      onChange={(e) => setEditCatType(e.target.value)}
                      style={{ width: '150px' }}
                    >
                      <option value="text">Texto</option>
                      <option value="boolean">Sim/Não</option>
                      <option value="enum">Lista de Opções</option>
                      <option value="multiselect">Múltipla Escolha</option>
                    </select>
                  </div>
                  {(editCatType === 'enum' || editCatType === 'multiselect') && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        background: 'var(--bg-main)',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Opções (edite, remova ou adicione):
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {editCatOptions.map((opt, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              background: 'var(--bg-surface)',
                              padding: '0.25rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) => {
                                const newOpts = [...editCatOptions];
                                newOpts[i].name = e.target.value;
                                setEditCatOptions(newOpts);
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                fontSize: '0.85rem',
                                outline: 'none',
                                width: Math.max(50, opt.name.length * 8) + 'px',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setEditCatOptions(editCatOptions.filter((_, idx) => idx !== i))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-danger)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditCatOptions([...editCatOptions, { name: 'Nova opção' }])}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-main)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.25rem 0.5rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          <Plus size={14} /> Adicionar
                        </button>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setEditingCatId(null)}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 1rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={savingEdit || !editCatName.trim()}
                      style={{ padding: '0.4rem 1rem' }}
                    >
                      {savingEdit ? <Loader2 size={16} className="spin" /> : 'Salvar'}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-heading)' }}>{cat.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Tipo:{' '}
                      {cat.type === 'boolean'
                        ? 'Sim/Não'
                        : cat.type === 'enum'
                          ? 'Lista de Opções'
                          : cat.type === 'multiselect'
                            ? 'Múltipla Escolha'
                            : 'Texto'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => startEditing(cat)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                      }}
                      title="Editar categoria"
                    >
                      <Tag size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        padding: '0.5rem',
                      }}
                      title="Excluir categoria"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
