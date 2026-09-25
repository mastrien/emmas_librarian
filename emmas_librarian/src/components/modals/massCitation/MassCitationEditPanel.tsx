import React from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { CitationMetadataFields } from '../../common/citation/CitationMetadataFields';
import type { CitationFields } from '../../../utils/cslMetadata';

interface MassCitationEditPanelProps {
  fields: CitationFields;
  saving: boolean;
  onFieldChange: (field: keyof CitationFields, value: string) => void;
  onCancel: () => void;
  onReset: () => void;
  onSave: () => void;
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '1.5rem',
  background: 'var(--bg-surface)',
  marginBottom: '1.5rem',
};

const iconButtonStyle = (padding: string): React.CSSProperties => ({
  padding,
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
});

/**
 * Metadata form for the one reference being edited, shown in place of the list.
 *
 * Usage:
 *   <MassCitationEditPanel fields={fields} saving={false} onFieldChange={set} onCancel={close} onReset={reset} onSave={save} />
 */
export const MassCitationEditPanel: React.FC<MassCitationEditPanelProps> = ({
  fields,
  saving,
  onFieldChange,
  onCancel,
  onReset,
  onSave,
}) => (
  <div style={panelStyle}>
    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-heading)' }}>Editar Metadados da Citação</h3>
    <CitationMetadataFields fields={fields} onChange={onFieldChange} />
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
      <button type="button" onClick={onCancel} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
        Cancelar
      </button>
      <button type="button" onClick={onReset} className="btn-secondary" style={iconButtonStyle('0.5rem 1rem')}>
        <RotateCcw size={14} /> Resetar
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="btn-primary"
        style={iconButtonStyle('0.5rem 1.25rem')}
      >
        <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
      </button>
    </div>
  </div>
);
