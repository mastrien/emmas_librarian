import React from 'react';
import { Trash2, Clock } from 'lucide-react';
import type { ScientificMilestone } from '../../../types';

interface MilestoneEditorProps {
  milestone: ScientificMilestone;
  onChange: (changes: Partial<ScientificMilestone>) => void;
  onRemove: () => void;
}

const cardStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelInputStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.85rem',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px dashed var(--border-color)',
  color: 'var(--text-heading)',
  padding: '0.1rem 0.2rem',
  width: '65%',
};

const typeBadgeStyle = (isRange: boolean): React.CSSProperties => ({
  fontSize: '0.7rem',
  padding: '0.15rem 0.4rem',
  borderRadius: '4px',
  backgroundColor: isRange ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
  color: isRange ? '#8b5cf6' : '#3b82f6',
  fontWeight: 600,
});

const smallInputStyle: React.CSSProperties = {
  padding: '0.3rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-surface)',
  color: 'var(--text-main)',
  fontSize: '0.8rem',
};

/**
 * One editable deadline: its label, and either a date range or a single date with an optional time.
 *
 * Usage:
 *   <MilestoneEditor milestone={m} onChange={(changes) => update(i, changes)} onRemove={() => remove(i)} />
 */
export const MilestoneEditor: React.FC<MilestoneEditorProps> = ({ milestone, onChange, onRemove }) => {
  const isRange = milestone.field_type === 'range';
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <input
          type="text"
          value={milestone.label}
          onChange={(e) => onChange({ label: e.target.value })}
          style={labelInputStyle}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={typeBadgeStyle(isRange)}>{isRange ? 'Intervalo' : 'Pontual'}</span>
          <button
            type="button"
            onClick={onRemove}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            title="Remover campo"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {isRange ? (
          <RangeDates milestone={milestone} onChange={onChange} />
        ) : (
          <SingleDate milestone={milestone} onChange={onChange} />
        )}
      </div>
    </div>
  );
};

type DatesProps = Omit<MilestoneEditorProps, 'onRemove'>;

const DateInput: React.FC<{ caption: string; value: string; onChange: (value: string) => void }> = ({
  caption,
  value,
  onChange,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{caption}</span>
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={smallInputStyle} />
  </div>
);

const RangeDates: React.FC<DatesProps> = ({ milestone, onChange }) => (
  <>
    <DateInput caption="De:" value={milestone.target_date} onChange={(target_date) => onChange({ target_date })} />
    <DateInput caption="Até:" value={milestone.end_date || ''} onChange={(end_date) => onChange({ end_date })} />
  </>
);

const SingleDate: React.FC<DatesProps> = ({ milestone, onChange }) => (
  <>
    <DateInput caption="Data:" value={milestone.target_date} onChange={(target_date) => onChange({ target_date })} />
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.75rem',
        cursor: 'pointer',
        marginLeft: '0.5rem',
      }}
    >
      <input type="checkbox" checked={milestone.has_time} onChange={(e) => onChange({ has_time: e.target.checked })} />
      <Clock size={13} /> Incluir horário
    </label>
    {milestone.has_time && (
      <input
        type="time"
        value={milestone.target_time || ''}
        onChange={(e) => onChange({ target_time: e.target.value })}
        style={smallInputStyle}
      />
    )}
  </>
);
