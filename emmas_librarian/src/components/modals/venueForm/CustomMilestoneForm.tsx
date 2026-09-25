import React, { useState } from 'react';
import type { MilestoneFieldType } from '../../../types';

interface CustomMilestoneFormProps {
  /** Receives the trimmed, non-empty label. */
  onConfirm: (label: string, type: MilestoneFieldType) => void;
  onMissingLabel: () => void;
  onCancel: () => void;
}

const panelStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '0.75rem',
  marginBottom: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  cursor: 'pointer',
};

/**
 * Inline form (instead of prompt(), which Electron does not support) to name a new deadline and pick its type.
 *
 * Usage:
 *   {adding && <CustomMilestoneForm onConfirm={add} onMissingLabel={showError} onCancel={() => setAdding(false)} />}
 */
export const CustomMilestoneForm: React.FC<CustomMilestoneFormProps> = ({ onConfirm, onMissingLabel, onCancel }) => {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<MilestoneFieldType>('single');

  const confirm = () => {
    if (!label.trim()) return onMissingLabel();
    onConfirm(label.trim(), type);
  };

  return (
    <div style={panelStyle}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-heading)' }}>
        Novo Campo Personalizado
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Avaliação de Pares / Câmera Ready"
          style={{
            padding: '0.4rem',
            fontSize: '0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            color: 'var(--text-main)',
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <label style={radioLabelStyle}>
            <input type="radio" name="fieldType" checked={type === 'single'} onChange={() => setType('single')} />
            Pontual
          </label>
          <label style={radioLabelStyle}>
            <input type="radio" name="fieldType" checked={type === 'range'} onChange={() => setType('range')} />
            Intervalo
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirm}
          className="btn-primary"
          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
        >
          Confirmar Campo
        </button>
      </div>
    </div>
  );
};
