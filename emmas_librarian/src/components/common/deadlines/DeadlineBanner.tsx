import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight, ExternalLink } from 'lucide-react';
import { ScientificVenue, MilestoneStatus } from '../../../types';
import { localIsoDate } from '../../../utils/localDate';
import { venueColorVars } from '../agenda/venueColors';
import { withMilestoneStatus } from '../agenda/agendaQueries';
import { deadlineBadge, upcomingDeadlines, type DeadlineItem } from './deadlineQueries';
import './deadlineBanner.css';

interface DeadlineBannerProps {
  venues: ScientificVenue[];
  onToggleMilestoneStatus: (milestoneId: number, status: MilestoneStatus) => void;
  onOpenAgenda: () => void;
}

const SHOWN_DEADLINES = 4;

// The call link lives on the event; showing it next to each deadline saves a trip to the Agenda.
const VenueTag: React.FC<{ venue: ScientificVenue }> = ({ venue }) => (
  <span className="deadline-venue">
    <span className="deadline-venue-chip" style={venueColorVars(venue)}>
      {venue.acronym || venue.title}
    </span>
    {venue.url && (
      <a
        href={venue.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir URL do Evento"
        aria-label="Abrir URL do Evento"
      >
        <ExternalLink size={13} />
      </a>
    )}
  </span>
);

const NoDeadlines: React.FC<{ onOpenAgenda: () => void }> = ({ onOpenAgenda }) => (
  <div className="deadline-none">
    <div className="deadline-none-text">
      <Calendar size={16} />
      <span>Nenhum prazo pendente para os próximos dias.</span>
    </div>
    <button type="button" className="deadline-link" onClick={onOpenAgenda}>
      Ver Agenda <ChevronRight size={16} />
    </button>
  </div>
);

const DeadlineCard: React.FC<{ item: DeadlineItem; onToggle: () => void }> = ({ item, onToggle }) => {
  const { venue, milestone, daysDiff } = item;
  const badge = deadlineBadge(daysDiff);
  return (
    <div className="deadline-card">
      <div className="deadline-card-top">
        <VenueTag venue={venue} />
        <span data-testid="deadline-badge" className={`deadline-badge deadline-badge--${badge.tone}`}>
          {badge.text}
        </span>
      </div>
      <div className="deadline-card-label">
        <input type="checkbox" checked={milestone.status === 'completed'} onChange={onToggle} />
        <span>{milestone.label}</span>
      </div>
      <div className="deadline-card-date">
        <Calendar size={13} />
        <span>
          {milestone.target_date}
          {milestone.end_date ? ` a ${milestone.end_date}` : ''}
        </span>
      </div>
    </div>
  );
};

/**
 * The dashboard's next deadlines (overdue ones first), each with a checkbox to mark it done, or a line saying there
 * is none.
 *
 * @example <DeadlineBanner venues={venues} onToggleMilestoneStatus={toggle} onOpenAgenda={() => navigate('/agenda')} />
 */
export const DeadlineBanner: React.FC<DeadlineBannerProps> = ({ venues, onToggleMilestoneStatus, onOpenAgenda }) => {
  const [localVenues, setLocalVenues] = useState<ScientificVenue[]>(venues);
  useEffect(() => {
    setLocalVenues(venues);
  }, [venues]);
  // Optimistic: the checkbox changes at once, the save follows.
  const toggle = (milestoneId: number, current: MilestoneStatus) => {
    const next: MilestoneStatus = current === 'completed' ? 'pending' : 'completed';
    setLocalVenues((prev) => withMilestoneStatus(prev, milestoneId, next));
    onToggleMilestoneStatus(milestoneId, next);
  };
  const items = upcomingDeadlines(localVenues, localIsoDate(), SHOWN_DEADLINES);
  if (items.length === 0) return <NoDeadlines onOpenAgenda={onOpenAgenda} />;
  return (
    <div className="deadlines">
      <div className="deadlines-head">
        <span className="deadlines-title">Próximos Prazos</span>
        <button type="button" className="deadline-link deadline-link--small" onClick={onOpenAgenda}>
          Ver Todos <ChevronRight size={14} />
        </button>
      </div>
      <div className="deadlines-grid">
        {items.map((item) => (
          <DeadlineCard
            key={item.milestone.id || `${item.venue.id}-${item.milestone.label}`}
            item={item}
            onToggle={() => item.milestone.id && toggle(item.milestone.id, item.milestone.status)}
          />
        ))}
      </div>
    </div>
  );
};
