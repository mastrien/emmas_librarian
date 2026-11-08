import React from 'react';
import { Edit2, ExternalLink, Trash2 } from 'lucide-react';
import type { MilestoneStatus, ScientificMilestone, ScientificVenue } from '../../../types';
import { CATEGORY_LABELS, milestoneDateText } from './agendaQueries';
import { venueColorVars } from './venueColors';

type ToggleStatus = (milestoneId: number, status: MilestoneStatus) => void;

const CardMilestone: React.FC<{ milestone: ScientificMilestone; onToggle: ToggleStatus }> = ({
  milestone: m,
  onToggle,
}) => {
  const isDone = m.status === 'completed';
  return (
    <div className="venue-milestone">
      <label className="agenda-check">
        <input type="checkbox" checked={isDone} onChange={() => m.id && onToggle(m.id, m.status)} />
        <span className={isDone ? 'venue-milestone-label is-done' : 'venue-milestone-label'}>{m.label}</span>
      </label>
      <span className="agenda-date">{milestoneDateText(m, ' ')}</span>
    </div>
  );
};

const CardActions: React.FC<{ venue: ScientificVenue; onEdit: () => void; onDelete: () => void }> = (props) => (
  <div className="venue-card-actions">
    {props.venue.url && (
      <a
        href={props.venue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="agenda-icon-button"
        title="Abrir URL do Evento"
      >
        <ExternalLink size={16} />
      </a>
    )}
    <button type="button" className="agenda-icon-button" onClick={props.onEdit} title="Editar Evento">
      <Edit2 size={16} />
    </button>
    <button type="button" className="agenda-icon-button" onClick={props.onDelete} title="Excluir Evento">
      <Trash2 size={16} />
    </button>
  </div>
);

/**
 * One event or journal with its deadlines, each with a checkbox to mark it done.
 *
 * @example <VenueCard venue={v} onEdit={() => edit(v)} onDelete={() => remove(v.id)} onToggle={toggle} />
 */
export const VenueCard: React.FC<{
  venue: ScientificVenue;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: ToggleStatus;
}> = ({ venue, onEdit, onDelete, onToggle }) => (
  <div className="glass-panel venue-card" style={venueColorVars(venue)}>
    <div className="venue-card-head">
      <div className="venue-card-names">
        <div className="venue-category">
          <span className="venue-dot" />
          {CATEGORY_LABELS[venue.category]}
        </div>
        <h3>{venue.acronym ? `${venue.acronym} — ${venue.title}` : venue.title}</h3>
      </div>
      <CardActions venue={venue} onEdit={onEdit} onDelete={onDelete} />
    </div>
    <div className="venue-milestones">
      {(venue.milestones || []).map((m) => (
        <CardMilestone key={m.id || m.label} milestone={m} onToggle={onToggle} />
      ))}
    </div>
  </div>
);
