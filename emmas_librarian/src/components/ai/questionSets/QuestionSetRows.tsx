import React, { useState } from 'react';
import { Trash2, Copy, Edit2, Check, X } from 'lucide-react';
import type { QuestionSet } from '../../../types';
import { questionCountText, updatedOnText } from './questionSetQueries';
import './questionSets.css';

export type SetScope = 'project' | 'global';

interface SaveSetFormProps {
  onSave: (name: string, description: string, scope: SetScope) => void;
  onCancel: () => void;
}

/**
 * "Salvar Perguntas Atuais": the name, an optional description and whether the set belongs to this project or to all.
 *
 * @example <SaveSetForm onSave={(name, desc, scope) => create(...)} onCancel={close} />
 */
export const SaveSetForm: React.FC<SaveSetFormProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<SetScope>('project');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim(), description.trim(), scope);
  };
  return (
    <form onSubmit={submit} className="qs-form">
      <h4>Salvar Perguntas Atuais</h4>
      <input
        autoFocus
        type="text"
        placeholder="Nome do conjunto"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input-field qs-input"
        required
      />
      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="input-field qs-input"
      />
      <div className="qs-scope">
        <label>
          <input type="radio" checked={scope === 'project'} onChange={() => setScope('project')} /> Neste Projeto
        </label>
        <label>
          <input type="radio" checked={scope === 'global'} onChange={() => setScope('global')} /> Global (Todos os
          Projetos)
        </label>
      </div>
      <div className="qs-buttons">
        <button type="submit" className="btn-primary qs-form-button">
          Salvar
        </button>
        <button type="button" className="btn-secondary qs-form-button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

interface EditSetRowProps {
  set: QuestionSet;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
}

/**
 * A set being renamed in place: name and description, ✓ to save, ✗ to leave it as it was.
 *
 * @example <EditSetRow set={set} onSave={(name, desc) => update(set.id, name, desc)} onCancel={stopEditing} />
 */
export const EditSetRow: React.FC<EditSetRowProps> = ({ set, onSave, onCancel }) => {
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description || '');
  return (
    <div className="qs-edit">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input-field qs-input"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="input-field qs-input"
      />
      <div className="qs-buttons">
        <button
          onClick={() => name.trim() && onSave(name.trim(), description.trim())}
          className="btn-primary qs-icon-button"
          aria-label="Salvar alterações"
        >
          <Check size={14} />
        </button>
        <button onClick={onCancel} className="btn-secondary qs-icon-button" aria-label="Cancelar edição">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

interface SetItemProps {
  set: QuestionSet;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * One saved set: name, scope, description, how many questions and when it changed, with Usar, edit, duplicate and
 * delete.
 *
 * @example <SetItem set={set} onUse={use} onEdit={edit} onDuplicate={dup} onDelete={del} />
 */
export const SetItem: React.FC<SetItemProps> = ({ set, onUse, onEdit, onDuplicate, onDelete }) => (
  <div className="catalog-item qs-item">
    <div className="qs-item-row">
      <div className="qs-item-text">
        <h4>
          {set.name}
          <span className="qs-scope-badge">{set.project_id === null ? 'Global' : 'Projeto'}</span>
        </h4>
        {set.description && <p>{set.description}</p>}
        <div className="qs-item-meta">
          {questionCountText(set)} &middot; {updatedOnText(set.updated_at)}
        </div>
      </div>
      <div className="qs-item-actions">
        <button onClick={onUse} className="btn-primary qs-use">
          Usar
        </button>
        <button onClick={onEdit} title="Editar" className="qs-item-tool">
          <Edit2 size={15} />
        </button>
        <button onClick={onDuplicate} title="Duplicar" className="qs-item-tool">
          <Copy size={15} />
        </button>
        <button onClick={onDelete} title="Excluir" className="qs-item-tool qs-item-tool--danger">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  </div>
);
