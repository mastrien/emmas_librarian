import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Calendar, AlertCircle } from 'lucide-react';
import { ScientificVenue, ScientificMilestone, MilestoneFieldType } from '../../types';
import {
  EMPTY_VENUE_DETAILS,
  defaultMilestones,
  milestonesForEditing,
  newCustomMilestone,
  todayIso,
  toVenuePayload,
  venueDetailsOf,
  venueValidationError,
  type VenueDetails,
  type VenuePayload,
} from './venueForm/venueFormModel';
import { VenueDetailsFields } from './venueForm/VenueDetailsFields';
import { MilestoneEditor } from './venueForm/MilestoneEditor';
import { CustomMilestoneForm } from './venueForm/CustomMilestoneForm';

interface VenueFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (venueData: VenuePayload) => void;
  initialData?: ScientificVenue | null;
  initialDate?: string | null;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  backdropFilter: 'blur(4px)',
  zIndex: 99999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  overflow: 'hidden',
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '620px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--bg-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden',
};

/**
 * Create or edit a conference/journal and its deadlines for the agenda.
 *
 * Usage:
 *   <VenueFormModal isOpen={open} onClose={close} onSave={save} initialData={venue} initialDate="2026-09-15" />
 */
export const VenueFormModal: React.FC<VenueFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  initialDate,
}) => {
  const [details, setDetails] = useState<VenueDetails>(EMPTY_VENUE_DETAILS);
  const [milestones, setMilestones] = useState<ScientificMilestone[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const newMilestoneDate = () => initialDate || todayIso();

  useEffect(() => {
    setDetails(initialData ? venueDetailsOf(initialData) : EMPTY_VENUE_DETAILS);
    setMilestones(initialData ? milestonesForEditing(initialData) : defaultMilestones(newMilestoneDate()));
    setShowAddCustom(false);
    setErrorMsg(null);
  }, [initialData, initialDate, isOpen]);

  if (!isOpen) return null;

  const updateMilestone = (index: number, changes: Partial<ScientificMilestone>) =>
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, ...changes } : m)));

  const addCustomMilestone = (label: string, type: MilestoneFieldType) => {
    setMilestones((prev) => [...prev, newCustomMilestone(label, type, newMilestoneDate())]);
    setShowAddCustom(false);
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = venueValidationError(details, milestones);
    setErrorMsg(error);
    if (error) return;
    onSave(toVenuePayload(details, milestones));
    onClose();
  };

  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div className="glass-panel" style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <VenueFormHeader isEditing={!!initialData} onClose={onClose} />
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          <div
            className="modal-body"
            style={{
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              flex: 1,
            }}
          >
            {errorMsg && <VenueFormError message={errorMsg} />}
            <VenueDetailsFields details={details} onChange={(changes) => setDetails({ ...details, ...changes })} />
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />
            <div>
              <MilestonesHeader onAdd={() => setShowAddCustom(true)} />
              {showAddCustom && (
                <CustomMilestoneForm
                  onConfirm={addCustomMilestone}
                  onMissingLabel={() => setErrorMsg('Informe o nome do novo campo/prazo.')}
                  onCancel={() => setShowAddCustom(false)}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {milestones.map((m, idx) => (
                  <MilestoneEditor
                    key={idx}
                    milestone={m}
                    onChange={(changes) => updateMilestone(idx, changes)}
                    onRemove={() => setMilestones((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            </div>
          </div>
          <VenueFormFooter onClose={onClose} />
        </form>
      </div>
    </div>,
    document.body,
  );
};

const VenueFormHeader: React.FC<{ isEditing: boolean; onClose: () => void }> = ({ isEditing, onClose }) => (
  <div
    style={{
      padding: '1.25rem 1.5rem',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <Calendar size={20} color="var(--color-primary)" />
      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-heading)' }}>
        {isEditing ? 'Editar Evento / Periódico' : 'Novo Evento / Periódico'}
      </h3>
    </div>
    <button
      type="button"
      onClick={onClose}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.25rem',
      }}
      title="Fechar"
    >
      <X size={20} />
    </button>
  </div>
);

const VenueFormError: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid var(--color-error)',
      color: 'var(--color-error)',
      padding: '0.75rem 1rem',
      borderRadius: 'var(--radius-md)',
      fontSize: '0.85rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}
  >
    <AlertCircle size={16} />
    <span>{message}</span>
  </div>
);

const MilestonesHeader: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>
      Prazos e Datas Associadas
    </label>
    <button
      type="button"
      onClick={onAdd}
      className="btn-secondary"
      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
    >
      <Plus size={14} /> Criar Novo Campo
    </button>
  </div>
);

const VenueFormFooter: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    style={{
      padding: '1rem 1.5rem',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '0.75rem',
      backgroundColor: 'var(--bg-surface)',
    }}
  >
    <button type="button" onClick={onClose} className="btn-secondary">
      Cancelar
    </button>
    <button type="submit" className="btn-primary">
      Salvar Evento
    </button>
  </div>
);
