import React, { useState, useEffect } from 'react';
import { Trash2, Copy, Edit2, Check, X } from 'lucide-react';
import { projectService } from '../../services/api';
import type { QuestionSet } from '../../types';

interface QuestionSetCatalogProps {
  projectId: number | null;
  currentQuestions?: string[];
  onSelectSet: (questions: string[]) => void;
  isCreatingExternal?: boolean;
  onCancelCreateExternal?: () => void;
}

export default function QuestionSetCatalog({
  projectId,
  currentQuestions = [],
  onSelectSet,
  isCreatingExternal,
  onCancelCreateExternal,
}: QuestionSetCatalogProps) {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [isCreatingInternal, setIsCreatingInternal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const isCreating = isCreatingExternal !== undefined ? isCreatingExternal : isCreatingInternal;
  const setIsCreating = (val: boolean) => {
    setIsCreatingInternal(val);
    if (!val && onCancelCreateExternal) onCancelCreateExternal();
  };

  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formScope, setFormScope] = useState<'project' | 'global'>('project');

  useEffect(() => {
    loadSets();
  }, [projectId]);

  useEffect(() => {
    if (isCreating) {
      setFormName('');
      setFormDesc('');
      setFormScope('project');
    }
  }, [isCreating]);

  async function loadSets() {
    try {
      setLoading(true);
      const safeProjectId = projectId === undefined ? null : projectId;
      const data = await projectService.getQuestionSets(safeProjectId);
      setSets(data || []);
    } catch (err) {
      console.error('Failed to load question sets:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleUse(set: QuestionSet) {
    try {
      const parsed = JSON.parse(set.questions);
      if (Array.isArray(parsed)) {
        onSelectSet(parsed);
      }
    } catch (err) {
      console.error('Failed to parse question set questions:', err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      const validQs = currentQuestions.filter((q) => q.trim().length > 0);
      const payload = {
        project_id: formScope === 'global' ? null : projectId === undefined ? null : projectId,
        name: formName.trim(),
        description: formDesc.trim() || null,
        questions: JSON.stringify(validQs),
      };

      await projectService.createQuestionSet(payload);
      setIsCreating(false);
      setFormName('');
      setFormDesc('');
      await loadSets();
    } catch (err) {
      console.error('Error creating set:', err);
      alert('Erro ao criar conjunto de perguntas.');
    }
  }

  async function handleUpdate(set: QuestionSet) {
    if (!formName.trim()) return;
    try {
      await projectService.updateQuestionSet(set.id, {
        name: formName.trim(),
        description: formDesc.trim() || null,
      });
      setEditingId(null);
      await loadSets();
    } catch (err) {
      console.error('Error updating set:', err);
      alert('Erro ao atualizar conjunto.');
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Tem certeza que deseja excluir este conjunto?')) return;
    try {
      await projectService.deleteQuestionSet(id);
      await loadSets();
    } catch (err) {
      console.error('Error deleting set:', err);
      alert('Erro ao excluir conjunto.');
    }
  }

  async function handleDuplicate(id: number) {
    try {
      await projectService.duplicateQuestionSet(id, projectId);
      await loadSets();
    } catch (err) {
      console.error('Error duplicating set:', err);
      alert('Erro ao duplicar conjunto.');
    }
  }

  function startEdit(set: QuestionSet) {
    setEditingId(set.id);
    setFormName(set.name);
    setFormDesc(set.description || '');
  }

  if (loading) {
    return <div style={{ fontSize: '0.9em', color: '#666' }}>Carregando conjuntos...</div>;
  }

  return (
    <div className="question-set-catalog">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1em' }}>Conjuntos Salvos</h3>
        {isCreatingExternal === undefined && !isCreating && (
          <button
            className="btn-secondary"
            onClick={() => {
              setIsCreating(true);
              setFormName('');
              setFormDesc('');
              setFormScope('project');
            }}
            disabled={currentQuestions.filter((q) => q.trim().length > 0).length === 0}
            title={
              currentQuestions.filter((q) => q.trim().length > 0).length === 0
                ? 'Adicione perguntas acima para salvar'
                : 'Salvar perguntas atuais como novo conjunto'
            }
            style={{ fontSize: '0.85em', padding: '0.4rem 0.8rem' }}
          >
            + Salvar Atual
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreate}
          style={{
            background: 'var(--bg-surface)',
            padding: '1rem',
            borderRadius: '4px',
            border: '1px solid var(--color-primary)',
            marginBottom: '1rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.95em' }}>Salvar Perguntas Atuais</h4>
          <input
            autoFocus
            type="text"
            placeholder="Nome do conjunto"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="input-field"
            style={{ width: '100%', marginBottom: '0.5rem' }}
            required
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            className="input-field"
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <div style={{ marginBottom: '0.8rem', fontSize: '0.85em', display: 'flex', gap: '1rem' }}>
            <label>
              <input type="radio" checked={formScope === 'project'} onChange={() => setFormScope('project')} /> Neste
              Projeto
            </label>
            <label>
              <input type="radio" checked={formScope === 'global'} onChange={() => setFormScope('global')} /> Global
              (Todos os Projetos)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.85em' }}>
              Salvar
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsCreating(false)}
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.85em' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {sets.length === 0 && !isCreating ? (
        <div
          style={{
            fontSize: '0.9em',
            color: '#666',
            padding: '1rem',
            border: '1px dashed #ccc',
            textAlign: 'center',
            borderRadius: '4px',
          }}
        >
          Nenhum conjunto de perguntas encontrado.
          <br />
          Crie perguntas acima e clique em "+ Salvar Atual" para guardá-las.
        </div>
      ) : (
        <div
          className="catalog-list"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}
        >
          {sets.map((set) => {
            const isEditingThis = editingId === set.id;
            let qCount = 0;
            try {
              const parsed = JSON.parse(set.questions);
              if (Array.isArray(parsed)) qCount = parsed.length;
            } catch {}

            if (isEditingThis) {
              return (
                <div
                  key={set.id}
                  style={{
                    border: '1px solid var(--color-primary)',
                    padding: '0.8rem',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                  }}
                >
                  <input
                    autoFocus
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleUpdate(set)}
                      className="btn-primary"
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-secondary"
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={set.id}
                className="catalog-item"
                style={{
                  border: '1px solid var(--border-color)',
                  padding: '0.8rem',
                  borderRadius: '4px',
                  background: 'var(--bg-main)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.2rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {set.name}
                      <span
                        style={{
                          fontSize: '0.7em',
                          padding: '0.1rem 0.3rem',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '3px',
                        }}
                      >
                        {set.project_id === null ? 'Global' : 'Projeto'}
                      </span>
                    </h4>
                    {set.description && (
                      <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.85em', color: 'var(--text-muted)' }}>
                        {set.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
                      {qCount} {qCount === 1 ? 'pergunta' : 'perguntas'} &middot;{' '}
                      {new Date(set.updated_at || Date.now()).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleUse(set)}
                      className="btn-primary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.85em', marginRight: '0.5rem' }}
                    >
                      Usar
                    </button>
                    <button
                      onClick={() => startEdit(set)}
                      title="Editar"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDuplicate(set.id)}
                      title="Duplicar"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(set.id)}
                      title="Excluir"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
