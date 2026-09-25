import React from 'react';
import { X as XIcon, Plus, Loader2, Upload, Check } from 'lucide-react';
import { fileNameFromPath } from '../../../utils/formatters';
import type { QuickAccessDraft } from './useQuickAccessForm';

interface QuickAccessFormProps {
  draft: QuickAccessDraft;
  isEditing: boolean;
  submitting: boolean;
  categories: string[];
  onChange: (changes: Partial<QuickAccessDraft>) => void;
  onSelectFile: () => void;
  onCancelEdit: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  marginBottom: '0.2rem',
  color: 'var(--text-muted)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-color)',
  outline: 'none',
  background: 'var(--bg-surface)',
  color: 'var(--text-main)',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
};

// Greyed out while the other source (URL vs PDF) is filled in.
const lockedStyle = (locked: boolean, unlockedCursor: string): React.CSSProperties => ({
  opacity: locked ? 0.6 : 1,
  cursor: locked ? 'not-allowed' : unlockedCursor,
});

/**
 * Add/edit form for a quick access link or PDF, with category suggestions.
 *
 * Usage:
 *   <QuickAccessForm draft={form.draft} isEditing={false} submitting={false} categories={[]} onChange={form.update}
 *     onSelectFile={form.selectFile} onCancelEdit={form.reset} onSubmit={form.submit} />
 */
export const QuickAccessForm: React.FC<QuickAccessFormProps> = (props) => {
  const { draft, isEditing, onCancelEdit, onSubmit } = props;
  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{isEditing ? 'Editar Acesso Rápido' : 'Adicionar Novo'}</h4>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Cancelar Edição
          </button>
        )}
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <NameAndCategoryFields {...props} />
        <SourceFields {...props} />
        {draft.filePath && <SelectedFileNotice filePath={draft.filePath} />}
        <SubmitButton {...props} />
      </form>
    </div>
  );
};

const NameAndCategoryFields: React.FC<QuickAccessFormProps> = ({ draft, categories, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.8rem' }}>
    <div>
      <label style={labelStyle}>Nome do Link/Documento *</label>
      <input
        type="text"
        required
        placeholder="Ex: Trello do Projeto, Edital CAPES"
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        style={inputStyle}
      />
    </div>
    <div>
      <label style={labelStyle}>Grupo / Categoria (Opcional)</label>
      <input
        type="text"
        list="quick-access-categories"
        placeholder="Ex: Reuniões, Modelos"
        value={draft.category}
        onChange={(e) => onChange({ category: e.target.value })}
        style={inputStyle}
      />
      <datalist id="quick-access-categories">
        {categories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </div>
  </div>
);

const SourceFields: React.FC<QuickAccessFormProps> = ({ draft, onChange, onSelectFile }) => {
  const hasFile = !!draft.filePath;
  const hasUrl = !!draft.url.trim();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', alignItems: 'end' }}>
      <div>
        <label style={labelStyle}>URL (Escolha apenas um: URL ou PDF)</label>
        <input
          type="url"
          placeholder="https://"
          value={draft.url}
          onChange={(e) => onChange({ url: e.target.value })}
          disabled={hasFile}
          style={{
            ...inputStyle,
            background: hasFile ? 'var(--bg-main)' : 'var(--bg-surface)',
            ...lockedStyle(hasFile, 'text'),
          }}
        />
      </div>
      <div>
        <label style={labelStyle}>Arquivo PDF (Escolha apenas um)</label>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={onSelectFile}
            className="btn-secondary"
            disabled={hasUrl}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.5rem',
              fontSize: '0.85rem',
              ...lockedStyle(hasUrl, 'pointer'),
            }}
          >
            <Upload size={15} /> {hasFile ? 'Trocar PDF' : 'Anexar PDF'}
          </button>
          {hasFile && (
            <button
              type="button"
              onClick={() => onChange({ filePath: undefined })}
              className="btn-secondary"
              style={{ color: 'var(--color-danger)', padding: '0.5rem' }}
              title="Remover PDF"
            >
              <XIcon size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SelectedFileNotice: React.FC<{ filePath: string }> = ({ filePath }) => (
  <div
    style={{
      fontSize: '0.75rem',
      color: 'var(--color-primary)',
      background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
      padding: '0.4rem 0.6rem',
      borderRadius: 'var(--radius-sm)',
    }}
  >
    <strong>Arquivo selecionado:</strong> {fileNameFromPath(filePath)}
  </div>
);

const SubmitButton: React.FC<QuickAccessFormProps> = ({ draft, isEditing, submitting }) => {
  const icon = submitting ? (
    <Loader2 size={15} className="animate-spin" />
  ) : isEditing ? (
    <Check size={15} />
  ) : (
    <Plus size={15} />
  );
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.3rem' }}>
      <button
        type="submit"
        disabled={submitting || (!draft.url && !draft.filePath)}
        className="btn-primary"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
      >
        {icon}
        {isEditing ? 'Salvar Alterações' : 'Adicionar'}
      </button>
    </div>
  );
};
