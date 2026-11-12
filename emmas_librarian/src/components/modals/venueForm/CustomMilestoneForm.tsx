import React, { useState } from 'react';
import type { MilestoneFieldType } from '../../../types';
import { SegmentedControl } from '../../common/SegmentedControl';
import './venueForm.css';

interface CustomMilestoneFormProps {
  /** Receives the trimmed, non-empty label. */
  onConfirm: (label: string, type: MilestoneFieldType) => void;
  onMissingLabel: () => void;
  onCancel: () => void;
}

/**
 * Inline form (instead of prompt(), which Electron does not support) to name a new deadline and pick its type: one
 * day, or a range.
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
    <div className="venue-custom">
      <div className="venue-custom__line">
        <input
          type="text"
          aria-label="Nome do novo prazo"
          className="input-field"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Avaliação de Pares / Câmera Ready"
          autoFocus
        />
        <SegmentedControl<MilestoneFieldType>
          label="Tipo do prazo"
          value={type}
          onChange={setType}
          options={[
            { value: 'single', label: 'Pontual' },
            { value: 'range', label: 'Intervalo' },
          ]}
        />
      </div>
      <div className="venue-custom__actions">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancelar
        </button>
        <button type="button" onClick={confirm} className="btn-secondary">
          Confirmar Campo
        </button>
      </div>
    </div>
  );
};
