import React from 'react';
import { Plus } from 'lucide-react';
import type { DiaryEntry } from '../../../types';
import { diaryDayMonth, diaryPageSummary, groupDiaryPages } from './diaryPages';

interface DiaryTimelineProps {
  entries: DiaryEntry[];
  selectedDate: string | null;
  today: string;
  onToday: () => void;
  onSelect: (date: string) => void;
}

const PageItem: React.FC<{ entry: DiaryEntry; isToday: boolean; isSelected: boolean; onSelect: () => void }> = (
  props,
) => (
  <button
    type="button"
    className={`diary-page${props.isSelected ? ' is-on' : ''}`}
    aria-current={props.isSelected || undefined}
    onClick={props.onSelect}
  >
    <span className="diary-page__date">{props.isToday ? 'Hoje' : diaryDayMonth(props.entry.entry_date)}</span>
    <span className="diary-page__summary">{diaryPageSummary(props.entry.content ?? '')}</span>
  </button>
);

// Today without a page: the way to start it, in the accent (decision on the redesign canvas, board 155).
const CreateToday: React.FC<{ onToday: () => void }> = ({ onToday }) => (
  <button type="button" className="diary-page diary-page--create" onClick={onToday}>
    <span className="diary-page__date">Hoje</span>
    <span className="diary-page__summary">
      <Plus size={13} aria-hidden="true" /> Criar a página de hoje
    </span>
  </button>
);

/**
 * The diary's page list (board 155): "+" and today first, then every page under its month, named by its first line.
 *
 * Usage:
 *   <DiaryTimeline entries={entries} selectedDate={date} today={today} onToday={openToday} onSelect={open} />
 */
export const DiaryTimeline: React.FC<DiaryTimelineProps> = ({ entries, selectedDate, today, onToday, onSelect }) => {
  const hasToday = entries.some((e) => e.entry_date === today);
  return (
    <nav className="diary-pages" aria-label="Páginas do diário">
      <div className="diary-pages__head">
        <span className="diary-label">Páginas</span>
        <button
          type="button"
          className="row-icon-button"
          aria-label="Página de hoje"
          title="Página de hoje"
          onClick={onToday}
        >
          <Plus size={15} />
        </button>
      </div>
      {!hasToday && <CreateToday onToday={onToday} />}
      {groupDiaryPages(entries, today).map((month) => (
        <div key={month.label} className="diary-pages__month">
          <span className="diary-pages__month-label">{month.label}</span>
          {month.entries.map((entry) => (
            <PageItem
              key={entry.entry_date}
              entry={entry}
              isToday={entry.entry_date === today}
              isSelected={entry.entry_date === selectedDate}
              onSelect={() => onSelect(entry.entry_date)}
            />
          ))}
        </div>
      ))}
      {entries.length === 0 && <p className="diary-pages__empty">Nenhuma página ainda.</p>}
    </nav>
  );
};
