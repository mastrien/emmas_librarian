import React from 'react';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { SegmentedControl } from '../SegmentedControl';
import { Button } from '../Button';

export type AgendaView = 'venue_cards' | 'milestone_list';

const VIEWS = [
  { value: 'venue_cards' as const, label: 'Por Evento/Revista' },
  { value: 'milestone_list' as const, label: 'Lista de Prazos' },
];

/**
 * The agenda's title, the switch between cards and the deadline list, and "Novo Evento".
 *
 * @example <AgendaHeader view={view} onViewChange={setView} onAddVenue={() => onAddVenue()} />
 */
export const AgendaHeader: React.FC<{
  view: AgendaView;
  onViewChange: (view: AgendaView) => void;
  onAddVenue: () => void;
}> = ({ view, onViewChange, onAddVenue }) => (
  <div className="agenda-head">
    <div className="agenda-title">
      <CalendarIcon size={24} />
      <div>
        <h1>Agenda</h1>
        <p>Gerencie seus eventos, prazos e chamadas de periódicos.</p>
      </div>
    </div>
    <div className="agenda-actions">
      <SegmentedControl label="Visualização da agenda" options={VIEWS} value={view} onChange={onViewChange} />
      <Button variant="primary" className="agenda-add" onClick={onAddVenue}>
        <Plus size={16} /> Novo Evento
      </Button>
    </div>
  </div>
);
