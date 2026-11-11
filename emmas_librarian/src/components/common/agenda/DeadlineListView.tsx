import React, { useState } from 'react';
import type { MilestoneStatus, ScientificVenue } from '../../../types';
import { AgendaFilters } from './AgendaFilters';
import { DeadlineTable } from './DeadlineTable';
import { StaleCallout } from './StaleCallout';
import { isStale } from './deadlineDates';
import { filterVenues, milestonesByDate, statusCounts, type CategoryFilter, type StatusFilter } from './agendaQueries';

/**
 * The deadline list of the agenda (board 173): the filters, the table grouped by month and, under it, the notice about
 * deadlines overdue for long (which the switch can hide from the table, but not from the notice).
 *
 * @example <DeadlineListView venues={venues} query={q} onQueryChange={setQ} today={new Date()} onToggle={toggle} />
 */
export const DeadlineListView: React.FC<{
  venues: ScientificVenue[];
  query: string;
  onQueryChange: (query: string) => void;
  today: Date;
  onToggle: (milestoneId: number, status: MilestoneStatus) => void;
}> = ({ venues, query, onQueryChange, today, onToggle }) => {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [showStale, setShowStale] = useState(true);
  const listed = milestonesByDate(filterVenues(venues, category, query), 'all');
  const stale = listed.filter((item) => isStale(item.milestone, today));
  const rows = listed
    .filter((item) => status === 'all' || item.milestone.status === status)
    .filter((item) => showStale || !isStale(item.milestone, today));
  const markStaleDone = () => stale.forEach(({ milestone: m }) => m.id && onToggle(m.id, m.status));
  return (
    <div className="agenda-list">
      <AgendaFilters
        query={query}
        onQueryChange={onQueryChange}
        category={category}
        onCategoryChange={setCategory}
        status={status}
        onStatusChange={setStatus}
        counts={statusCounts(listed)}
        showStale={showStale}
        onShowStaleChange={setShowStale}
      />
      <DeadlineTable items={rows} today={today} onToggle={onToggle} />
      <StaleCallout count={stale.length} onMarkDone={markStaleDone} />
    </div>
  );
};
