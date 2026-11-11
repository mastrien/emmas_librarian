import React, { useEffect, useState } from 'react';
import { usePageCommands } from './shell/palette/PageCommandsContext';
import type { MilestoneStatus, ScientificVenue } from '../../types';
import { AgendaHeader, type AgendaView } from './agenda/AgendaHeader';
import { DeadlineListView } from './agenda/DeadlineListView';
import { MonthGrid } from './agenda/MonthGrid';
import { MonthNav } from './agenda/MonthNav';
import { VenuePanel } from './agenda/VenuePanel';
import { isoDay } from './calendar/calendarDays';
import { filterVenues, withMilestoneStatus } from './agenda/agendaQueries';
import './agenda/agenda.css';

interface ScientificAgendaViewProps {
  venues: ScientificVenue[];
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

/** The month shown by the calendar, starting on the current one; "Hoje" returns to it. */
function useShownMonth(today: Date) {
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const move = (delta: number) => {
    const next = new Date(shown.year, shown.month + delta, 1);
    setShown({ year: next.getFullYear(), month: next.getMonth() });
  };
  const reset = () => setShown({ year: today.getFullYear(), month: today.getMonth() });
  return { shown, move, reset };
}

const CalendarView: React.FC<{
  props: ScientificAgendaViewProps;
  venues: ScientificVenue[];
  query: string;
  onQueryChange: (query: string) => void;
  today: Date;
  month: { year: number; month: number };
  onToggle: (milestoneId: number, status: MilestoneStatus) => void;
}> = ({ props, venues, query, onQueryChange, today, month, onToggle }) => (
  <div className="agenda-layout">
    <MonthGrid
      year={month.year}
      month={month.month}
      venues={venues}
      todayIso={isoDay(today.getFullYear(), today.getMonth(), today.getDate())}
      onSelectDay={props.onAddVenue}
    />
    <VenuePanel
      venues={venues}
      query={query}
      onQueryChange={onQueryChange}
      today={today}
      onEdit={props.onEditVenue}
      onDelete={props.onDeleteVenue}
      onToggle={onToggle}
    />
  </div>
);

/**
 * The agenda page's content (boards 172 and 173): the month with a chip per deadline and the panel of events beside
 * it, or the list of deadlines grouped by month with its filters.
 *
 * @example <ScientificAgendaView venues={venues} onAddVenue={add} onEditVenue={edit} onDeleteVenue={remove} … />
 */
export const ScientificAgendaView: React.FC<ScientificAgendaViewProps> = (props) => {
  const [today] = useState(() => new Date());
  const [view, setView] = useState<AgendaView>('calendar');
  const [query, setQuery] = useState('');
  const { localVenues, toggle } = useOptimisticVenues(props.venues, props.onToggleMilestoneStatus);
  const { shown, move, reset } = useShownMonth(today);
  usePageCommands('agenda', [
    { id: 'agenda:new', label: 'Novo evento', run: () => props.onAddVenue() },
    { id: 'agenda:today', label: 'Agenda: ir para hoje', run: reset },
    { id: 'agenda:prev', label: 'Agenda: mês anterior', run: () => move(-1) },
    { id: 'agenda:next', label: 'Agenda: mês seguinte', run: () => move(1) },
    {
      id: 'agenda:toggle-view',
      label: view === 'calendar' ? 'Agenda: ver a lista de prazos' : 'Agenda: ver o calendário',
      run: () => setView(view === 'calendar' ? 'deadlines' : 'calendar'),
    },
  ]);
  const nav = <MonthNav year={shown.year} month={shown.month} onMove={move} onToday={reset} />;
  return (
    <div className="agenda">
      <AgendaHeader view={view} onViewChange={setView} onAddVenue={() => props.onAddVenue()} monthNav={nav} />
      {view === 'calendar' ? (
        <CalendarView
          props={props}
          venues={filterVenues(localVenues, 'all', query)}
          query={query}
          onQueryChange={setQuery}
          today={today}
          month={shown}
          onToggle={toggle}
        />
      ) : (
        <DeadlineListView venues={localVenues} query={query} onQueryChange={setQuery} today={today} onToggle={toggle} />
      )}
    </div>
  );
};
