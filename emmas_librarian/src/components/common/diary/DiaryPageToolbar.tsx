import React from 'react';
import { Trash2, Save, Eye, Edit2, History } from 'lucide-react';
import { formatDiaryDate } from './diaryDates';

interface DiaryPageToolbarProps {
  date: string;
  isEditMode: boolean;
  saving: boolean;
  hasChanges: boolean;
  hasContent: boolean;
  onSave: () => void;
  onOpenHistory: () => void;
  onToggleEditMode: () => void;
  onDelete: () => void;
}

const actionButton: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
};

/**
 * Title of the open diary page with its save status, history, view-mode and delete actions.
 *
 * Usage:
 *   <DiaryPageToolbar date={date} isEditMode={edit} saving={saving} hasChanges={dirty} hasContent={!!content} ... />
 */
export const DiaryPageToolbar: React.FC<DiaryPageToolbarProps> = (props) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
    <h3 style={{ margin: 0, fontSize: '1.25rem', textTransform: 'capitalize' }}>{formatDiaryDate(props.date)}</h3>
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {props.isEditMode && (
        <>
          <SaveStatus saving={props.saving} hasChanges={props.hasChanges} hasContent={props.hasContent} />
          <button
            onClick={props.onSave}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            disabled={!props.hasChanges}
          >
            <Save size={14} /> Salvar
          </button>
        </>
      )}
      <button onClick={props.onOpenHistory} className="btn-secondary" style={actionButton} title="Histórico de Versões">
        <History size={14} /> Histórico
      </button>
      <button onClick={props.onToggleEditMode} className="btn-secondary" style={actionButton}>
        {props.isEditMode ? (
          <>
            <Eye size={14} /> Visualizar
          </>
        ) : (
          <>
            <Edit2 size={14} /> Editar
          </>
        )}
      </button>
      <button
        onClick={props.onDelete}
        className="btn-secondary"
        title="Excluir página"
        aria-label="Excluir página"
        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--color-danger)' }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

const SaveStatus: React.FC<{ saving: boolean; hasChanges: boolean; hasContent: boolean }> = ({
  saving,
  hasChanges,
  hasContent,
}) => {
  if (saving) return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Salvando...</span>;
  if (hasChanges) return <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Não salvo</span>;
  if (hasContent) return <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>✓ Salvo</span>;
  return null;
};
