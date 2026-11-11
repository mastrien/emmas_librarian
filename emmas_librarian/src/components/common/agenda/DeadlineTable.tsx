import React from 'react';
import type { MilestoneStatus } from '../../../types';
import { CATEGORY_LABELS, groupByMonth, type MilestoneWithVenue } from './agendaQueries';
import { formatMilestoneDate, milestoneSituation, situationText } from './deadlineDates';
import { venueColorVars } from './venueColors';

type Toggle = (milestoneId: number, status: MilestoneStatus) => void;

const DeadlineRow: React.FC<{ item: MilestoneWithVenue; today: Date; onToggle: Toggle }> = (props) => {
  const { milestone: m, venue: v } = props.item;
  const situation = milestoneSituation(m, props.today);
  return (
    <tr className={situation.kind === 'done' ? 'is-done' : undefined}>
      <td>
        <input
          type="checkbox"
          aria-label={`Marcar "${m.label}" como feito`}
          checked={situation.kind === 'done'}
          onChange={() => m.id && props.onToggle(m.id, m.status)}
        />
      </td>
      <td className="deadline-name">{m.label}</td>
      <td>
        <span className="deadline-venue" style={venueColorVars(v)}>
          <span className="venue-dot" />
          <span className="deadline-venue__text" title={v.title}>
            {v.acronym ? `${v.acronym} · ${v.title}` : v.title}
          </span>
        </span>
      </td>
      <td className="deadline-muted">{CATEGORY_LABELS[v.category]}</td>
      <td className="deadline-right">{formatMilestoneDate(m)}</td>
      <td className="deadline-right">
        <span className={situation.kind === 'overdue' ? 'agenda-badge is-bad' : 'agenda-badge'}>
          {situationText(situation)}
        </span>
      </td>
    </tr>
  );
};

/**
 * Every deadline in a table grouped by month (board 173): a checkbox, the deadline, its event with colour dot, the type,
 * the date and the situation ("venceu há 213 d").
 *
 * @example <DeadlineTable items={milestonesByDate(venues, 'pending')} today={new Date()} onToggle={toggle} />
 */
export const DeadlineTable: React.FC<{ items: MilestoneWithVenue[]; today: Date; onToggle: Toggle }> = (props) => {
  if (props.items.length === 0) return <div className="agenda-empty">Nenhum prazo cadastrado.</div>;
  return (
    <table className="table deadline-table">
      <colgroup>
        <col style={{ width: 36 }} />
        <col />
        <col style={{ width: 300 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 150 }} />
        <col style={{ width: 140 }} />
      </colgroup>
      <thead>
        <tr>
          <th aria-label="Feito" />
          <th>Prazo</th>
          <th>Evento ou revista</th>
          <th>Tipo</th>
          <th className="deadline-right">Data</th>
          <th className="deadline-right">Situação</th>
        </tr>
      </thead>
      {groupByMonth(props.items).map((group) => (
        <tbody key={group.label}>
          <tr className="deadline-group">
            <th colSpan={6} scope="colgroup">
              {group.label}
            </th>
          </tr>
          {group.items.map((item) => (
            <DeadlineRow
              key={item.milestone.id || `${item.venue.id}-${item.milestone.label}`}
              item={item}
              today={props.today}
              onToggle={props.onToggle}
            />
          ))}
        </tbody>
      ))}
    </table>
  );
};
