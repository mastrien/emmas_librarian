import React from 'react';
import type { MilestoneStatus } from '../../../types';
import { milestoneDateText, type MilestoneWithVenue } from './agendaQueries';
import { venueColorVars } from './venueColors';

const MilestoneRow: React.FC<{
  item: MilestoneWithVenue;
  onToggle: (milestoneId: number, status: MilestoneStatus) => void;
}> = ({ item: { milestone: m, venue: v }, onToggle }) => {
  const isDone = m.status === 'completed';
  return (
    <div className={isDone ? 'milestone-row is-done' : 'milestone-row'}>
      <label className="agenda-check">
        <input type="checkbox" checked={isDone} onChange={() => m.id && onToggle(m.id, m.status)} />
        <div>
          <div className="milestone-row-names">
            <span className="milestone-row-label">{m.label}</span>
            <span className="venue-chip" style={venueColorVars(v)}>
              {v.acronym || v.title}
            </span>
          </div>
          <span className="milestone-row-venue">{v.title}</span>
        </div>
      </label>
      <div className="milestone-row-date">{milestoneDateText(m, ' às ')}</div>
    </div>
  );
};

/**
 * Every deadline in date order, each with its event and a checkbox to mark it done.
 *
 * @example <MilestoneList items={milestonesByDate(venues, 'pending')} onToggle={toggle} />
 */
export const MilestoneList: React.FC<{
  items: MilestoneWithVenue[];
  onToggle: (milestoneId: number, status: MilestoneStatus) => void;
}> = ({ items, onToggle }) => {
  if (items.length === 0) return <div className="agenda-empty">Nenhum prazo cadastrado.</div>;
  return (
    <div className="milestone-list">
      {items.map((item) => (
        <MilestoneRow
          key={item.milestone.id || `${item.venue.id}-${item.milestone.label}`}
          item={item}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};
