import React, { type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { SegmentedControl } from '../SegmentedControl';
import { PageHeader } from '../PageHeader';

export type AgendaView = 'calendar' | 'deadlines';

const VIEWS = [
  { value: 'calendar' as const, label: 'Calendário' },
  { value: 'deadlines' as const, label: 'Lista de prazos' },
];

/**
 * The agenda's title (board 172/173): with the month navigation beside it on the calendar, with a line of context on the
 * deadline list; the switch between the two and "Novo evento" on the right.
 *
 * @example <AgendaHeader view={view} onViewChange={setView} onAddVenue={() => add()} monthNav={<MonthNav … />} />
 */
export const AgendaHeader: React.FC<{
  view: AgendaView;
  onViewChange: (view: AgendaView) => void;
  onAddVenue: () => void;
  /** Shown beside the title on the calendar view. */
  monthNav: ReactNode;
}> = ({ view, onViewChange, onAddVenue, monthNav }) => (
  <PageHeader
    title="Agenda"
    titleExtra={view === 'calendar' ? monthNav : undefined}
    subtitle={view === 'deadlines' ? 'Eventos, prazos e chamadas de periódicos' : undefined}
    actions={
      <>
        <SegmentedControl label="Visualização da agenda" options={VIEWS} value={view} onChange={onViewChange} />
        <button type="button" className="btn-primary agenda-add" onClick={onAddVenue}>
          <Plus size={16} aria-hidden="true" /> Novo evento
        </button>
      </>
    }
  />
);
