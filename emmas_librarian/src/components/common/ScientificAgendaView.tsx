import React, { useEffect, useState } from 'react';
import type { MilestoneStatus, ScientificVenue } from '../../types';
import { DashboardCalendar } from './DashboardCalendar';
import { AgendaHeader, type AgendaView } from './agenda/AgendaHeader';
import { AgendaFilters } from './agenda/AgendaFilters';
import { VenueCard } from './agenda/VenueCard';
import { MilestoneList } from './agenda/MilestoneList';
import {
  filterVenues,
  milestonesByDate,
  withMilestoneStatus,
  type CategoryFilter,
  type StatusFilter,
} from './agenda/agendaQueries';
import './agenda/agenda.css';

interface ScientificAgendaViewProps {
  venues: ScientificVenue[];
  diarySet: Set<string>;
  onAddVenue: (dateStr?: string) => void;
  onEditVenue: (venue: ScientificVenue) => void;
  onDeleteVenue: (id: number) => void;
  onToggleMilestoneStatus: (milestoneId: number, status: MilestoneStatus) => Promise<boolean>;
}

type ToggleStatus = ScientificAgendaViewProps['onToggleMilestoneStatus'];

// A local copy of the venues, so marking a deadline done updates at once instead of redrawing the whole page; the
// copy goes back to the saved venues if the save fails.
function useOptimisticVenues(venues: ScientificVenue[], save: ToggleStatus) {
  const [localVenues, setLocalVenues] = useState<ScientificVenue[]>(venues);
  useEffect(() => {
    setLocalVenues(venues);
  }, [venues]);
  const toggle = async (milestoneId: number, current: MilestoneStatus) => {
    const next: MilestoneStatus = current === 'completed' ? 'pending' : 'completed';
    setLocalVenues((prev) => withMilestoneStatus(prev, milestoneId, next));
    try {
      await save(milestoneId, next);
    } catch {
      setLocalVenues(venues);
    }
  };
  return { localVenues, toggle };
}

const VenueCards: React.FC<{
  venues: ScientificVenue[];
  props: ScientificAgendaViewProps;
  onToggle: (milestoneId: number, status: MilestoneStatus) => void;
}> = ({ venues, props, onToggle }) => {
  if (venues.length === 0) return <div className="agenda-empty">Nenhum evento ou periódico encontrado.</div>;
  return (
    <div className="agenda-cards">
      {venues.map((v) => (
        <VenueCard
          key={v.id}
          venue={v}
          onEdit={() => props.onEditVenue(v)}
          onDelete={() => props.onDeleteVenue(v.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

/**
 * The agenda page's content: events and journals as cards or as one deadline list, filters, and the month calendar.
 *
 * @example <ScientificAgendaView venues={venues} diarySet={diary} onAddVenue={add} onEditVenue={edit} … />
 */
export const ScientificAgendaView: React.FC<ScientificAgendaViewProps> = (props) => {
  const [view, setView] = useState<AgendaView>('venue_cards');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const { localVenues, toggle } = useOptimisticVenues(props.venues, props.onToggleMilestoneStatus);
  const shown = filterVenues(localVenues, category, query);
  const listView = view === 'milestone_list';
  return (
    <div className="agenda">
      <AgendaHeader view={view} onViewChange={setView} onAddVenue={() => props.onAddVenue()} />
      <div className="agenda-layout">
        <div className="agenda-main">
          <AgendaFilters
            query={query}
            onQueryChange={setQuery}
            category={category}
            onCategoryChange={setCategory}
            status={listView ? status : undefined}
            onStatusChange={setStatus}
          />
          {listView ? (
            <MilestoneList items={milestonesByDate(shown, status)} onToggle={toggle} />
          ) : (
            <VenueCards venues={shown} props={props} onToggle={toggle} />
          )}
        </div>
        <div className="agenda-calendar">
          <DashboardCalendar
            diarySet={props.diarySet}
            venues={localVenues}
            onAddVenue={props.onAddVenue}
            onOpenAgenda={() => {}}
            onSelectDate={(dStr) => props.onAddVenue(dStr)}
          />
        </div>
      </div>
    </div>
  );
};
