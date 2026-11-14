import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
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
import { Modal } from '../common/Modal';
import { ModalFooter } from '../common/ModalFooter';
import { Button } from '../common/Button';

interface VenueFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (venueData: VenuePayload) => void;
  initialData?: ScientificVenue | null;
  initialDate?: string | null;
}

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

  // The accessible name keeps the old wording; the title on screen is the board's (180).
  const name = initialData ? 'Editar Evento / Periódico' : 'Novo Evento / Periódico';
  return (
    <Modal label={name} title={initialData ? 'Editar evento' : 'Novo evento'} onClose={onClose} width={620}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && <VenueFormError message={errorMsg} />}
          <span className="app-modal-group">Evento ou revista</span>
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
        <VenueFormFooter onClose={onClose} editing={Boolean(initialData)} />
      </form>
    </Modal>
  );
};

const VenueFormError: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid var(--color-danger)',
      color: 'var(--color-danger)',
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
    <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-heading)' }}>Prazos</label>
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

const VenueFormFooter: React.FC<{ onClose: () => void; editing: boolean }> = ({ onClose, editing }) => (
  <ModalFooter>
    <Button variant="ghost" onClick={onClose}>
      Cancelar
    </Button>
    <Button type="submit" variant="primary">
      {editing ? 'Salvar' : 'Criar evento'}
    </Button>
  </ModalFooter>
);
