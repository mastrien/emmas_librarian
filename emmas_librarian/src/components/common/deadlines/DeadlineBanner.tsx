import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { ScientificVenue, MilestoneStatus } from '../../../types';
import { localIsoDate } from '../../../utils/localDate';
import { withMilestoneStatus } from '../agenda/agendaQueries';
import { formatMilestoneDate } from '../agenda/deadlineDates';
import { deadlineBadge, upcomingDeadlines, type DeadlineItem } from './deadlineQueries';
import './deadlineBanner.css';

interface DeadlineBannerProps {
  venues: ScientificVenue[];
  onToggleMilestoneStatus: (milestoneId: number, status: MilestoneStatus) => void;
  onOpenAgenda: () => void;
}

const SHOWN_DEADLINES = 4;

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

/** The line under a deadline's name: the event (its acronym, else its title) and, for a range, the dates. */
export function deadlineSubline(item: DeadlineItem): string {
  const venue = item.venue.acronym || item.venue.title;
  const { milestone } = item;
  return milestone.end_date ? `${venue} · ${formatMilestoneDate(milestone)}` : venue;
}

const DeadlineRow: React.FC<{ item: DeadlineItem; onToggle: () => void }> = ({ item, onToggle }) => {
  const { milestone, daysDiff } = item;
  const badge = deadlineBadge(daysDiff);
  return (
    <div className="deadline-row">
      <input
        type="checkbox"
        checked={milestone.status === 'completed'}
        onChange={onToggle}
        aria-label={`Marcar "${milestone.label}" como feito`}
      />
      <div className="deadline-row__text">
        <span className="deadline-row__label">{milestone.label}</span>
        <span className="deadline-row__venue">{deadlineSubline(item)}</span>
      </div>
      <span data-testid="deadline-badge" className={`deadline-badge deadline-badge--${badge.tone}`}>
        {badge.text}
      </span>
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
        <h2 className="deadlines-title">Próximos prazos</h2>
        <button type="button" className="deadline-link deadline-link--small" onClick={onOpenAgenda}>
          Agenda
        </button>
      </div>
      <div className="deadlines-list">
        {items.map((item) => (
          <DeadlineRow
            key={item.milestone.id || `${item.venue.id}-${item.milestone.label}`}
            item={item}
            onToggle={() => item.milestone.id && toggle(item.milestone.id, item.milestone.status)}
          />
        ))}
      </div>
    </div>
  );
};
