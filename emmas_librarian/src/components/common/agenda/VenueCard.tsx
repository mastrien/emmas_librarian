import React from 'react';
import { Edit2, ExternalLink, Trash2 } from 'lucide-react';
import type { MilestoneStatus, ScientificMilestone, ScientificVenue } from '../../../types';
import { CATEGORY_LABELS } from './agendaQueries';
import { formatMilestoneDate, milestoneSituation, situationText } from './deadlineDates';
import { venueColorVars } from './venueColors';

type ToggleStatus = (milestoneId: number, status: MilestoneStatus) => void;

/** An overdue deadline shows "venceu há N d" in place of its date; any other shows its date. */
const MilestoneWhen: React.FC<{ milestone: ScientificMilestone; today: Date }> = ({ milestone, today }) => {
  const situation = milestoneSituation(milestone, today);
  if (situation.kind === 'overdue') return <span className="agenda-badge is-bad">{situationText(situation)}</span>;
  return <span className="agenda-date">{formatMilestoneDate(milestone)}</span>;
};

const CardMilestone: React.FC<{ milestone: ScientificMilestone; today: Date; onToggle: ToggleStatus }> = (props) => {
  const { milestone: m, today, onToggle } = props;
  const isDone = m.status === 'completed';
  return (
    <div className="venue-milestone">
      <label className="agenda-check">
        <input type="checkbox" checked={isDone} onChange={() => m.id && onToggle(m.id, m.status)} />
        <span className={isDone ? 'venue-milestone-label is-done' : 'venue-milestone-label'}>{m.label}</span>
      </label>
      <MilestoneWhen milestone={m} today={today} />
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
        <ExternalLink size={14} />
      </a>
    )}
    <button type="button" className="agenda-icon-button" onClick={props.onEdit} title="Editar Evento">
      <Edit2 size={14} />
    </button>
    <button type="button" className="agenda-icon-button" onClick={props.onDelete} title="Excluir Evento">
      <Trash2 size={14} />
    </button>
  </div>
);

/**
 * One event or journal of the panel beside the month (board 172): its category and actions, "SIGLA · Título" and its
 * deadlines, each with a checkbox and either its date or "venceu há N d".
 *
 * @example <VenueCard venue={v} today={new Date()} onEdit={() => edit(v)} onDelete={() => remove(v.id)} onToggle={toggle} />
 */
export const VenueCard: React.FC<{
  venue: ScientificVenue;
  today: Date;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: ToggleStatus;
}> = ({ venue, today, onEdit, onDelete, onToggle }) => (
  <div className="venue-card" style={venueColorVars(venue)}>
    <div className="venue-card-head">
      <span className="venue-category">
        <span className="venue-dot" />
        {CATEGORY_LABELS[venue.category]}
      </span>
      <CardActions venue={venue} onEdit={onEdit} onDelete={onDelete} />
    </div>
    <h3 className="venue-card-title">{venue.acronym ? `${venue.acronym} · ${venue.title}` : venue.title}</h3>
    <div className="venue-milestones">
      {(venue.milestones || []).map((m) => (
        <CardMilestone key={m.id || m.label} milestone={m} today={today} onToggle={onToggle} />
      ))}
    </div>
  </div>
);
