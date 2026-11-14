import React from 'react';
import { Clock, X } from 'lucide-react';
import type { ScientificMilestone } from '../../../types';
import './venueForm.css';

interface MilestoneEditorProps {
  milestone: ScientificMilestone;
  onChange: (changes: Partial<ScientificMilestone>) => void;
  onRemove: () => void;
}

const DateInput: React.FC<{ caption: string; value: string; onChange: (value: string) => void }> = ({
  caption,
  value,
  onChange,
}) => (
  <input
    type="date"
    aria-label={caption}
    title={caption}
    className="input-field venue-milestone__date"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
);

const RangeDates: React.FC<Omit<MilestoneEditorProps, 'onRemove'>> = ({ milestone, onChange }) => (
  <>
    <DateInput caption="De" value={milestone.target_date} onChange={(target_date) => onChange({ target_date })} />
    <span className="venue-milestone__to">a</span>
    <DateInput caption="Até" value={milestone.end_date || ''} onChange={(end_date) => onChange({ end_date })} />
  </>
);

// The clock is a switch (a checkbox behind it, so a screen reader and the keyboard get a checkbox).
const SingleDate: React.FC<Omit<MilestoneEditorProps, 'onRemove'>> = ({ milestone, onChange }) => (
  <>
    <DateInput caption="Data" value={milestone.target_date} onChange={(target_date) => onChange({ target_date })} />
    {milestone.has_time && (
      <input
        type="time"
        aria-label="Horário"
        className="input-field venue-milestone__time"
        value={milestone.target_time || ''}
        onChange={(e) => onChange({ target_time: e.target.value })}
      />
    )}
    <label className={`venue-milestone__clock${milestone.has_time ? ' is-on' : ''}`} title="Incluir horário">
      <input
        type="checkbox"
        className="visually-hidden"
        aria-label="Incluir horário"
        checked={milestone.has_time}
        onChange={(e) => onChange({ has_time: e.target.checked })}
      />
      <Clock size={14} aria-hidden="true" />
    </label>
  </>
);

/**
 * One deadline on its line (board 180): its name, its date (a range or one day with an optional time) and the way to
 * remove it.
 *
 * Usage:
 *   <MilestoneEditor milestone={m} onChange={(changes) => update(i, changes)} onRemove={() => remove(i)} />
 */
export const MilestoneEditor: React.FC<MilestoneEditorProps> = ({ milestone, onChange, onRemove }) => (
  <div className="venue-milestone">
    <input
      type="text"
      aria-label="Nome do prazo"
      className="input-field"
      value={milestone.label}
      onChange={(e) => onChange({ label: e.target.value })}
    />
    <div className="venue-when">
      {milestone.field_type === 'range' ? (
        <RangeDates milestone={milestone} onChange={onChange} />
      ) : (
        <SingleDate milestone={milestone} onChange={onChange} />
      )}
    </div>
    <button
      type="button"
      className="venue-milestone__remove"
      onClick={onRemove}
      aria-label="Remover prazo"
      title="Remover prazo"
    >
      <X size={14} aria-hidden="true" />
    </button>
  </div>
);
