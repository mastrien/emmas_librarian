import React from 'react';
import { Search } from 'lucide-react';
import type { MilestoneStatus, ScientificVenue } from '../../../types';
import { VenueCard } from './VenueCard';

interface VenuePanelProps {
  venues: ScientificVenue[];
  query: string;
  onQueryChange: (query: string) => void;
  today: Date;
  onEdit: (venue: ScientificVenue) => void;
  onDelete: (id: number) => void;
  onToggle: (milestoneId: number, status: MilestoneStatus) => void;
}

/**
 * "Eventos e revistas" beside the month (board 172): how many there are, a search by event or acronym and one card per
 * event with its deadlines.
 *
 * @example <VenuePanel venues={shown} query={q} onQueryChange={setQ} today={new Date()} onEdit={…} onDelete={…} onToggle={…} />
 */
export const VenuePanel: React.FC<VenuePanelProps> = (props) => (
  <aside className="venue-panel" aria-label="Eventos e revistas">
    <div className="venue-panel__head">
      <h2>Eventos e revistas</h2>
      <span className="venue-panel__count">{props.venues.length}</span>
    </div>
    <div className="agenda-search">
      <Search size={16} aria-hidden="true" />
      <input
        type="text"
        aria-label="Buscar na agenda"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
        placeholder="Evento ou sigla"
      />
    </div>
    {props.venues.length === 0 && <div className="agenda-empty">Nenhum evento ou periódico encontrado.</div>}
    {props.venues.map((venue) => (
      <VenueCard
        key={venue.id}
        venue={venue}
        today={props.today}
        onEdit={() => props.onEdit(venue)}
        onDelete={() => props.onDelete(venue.id)}
        onToggle={props.onToggle}
      />
    ))}
  </aside>
);
