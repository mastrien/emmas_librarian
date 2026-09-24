import React from 'react';
import { Plus, Calendar } from 'lucide-react';
import type { DiaryEntry } from '../../../types';
import { formatDiaryDateShort } from './diaryDates';

interface DiaryTimelineProps {
  entries: DiaryEntry[];
  selectedDate: string | null;
  today: string;
  onToday: () => void;
  onSelect: (date: string) => void;
}

/**
 * Left column of the diary: "today" shortcut and the list of existing pages.
 *
 * Usage:
 *   <DiaryTimeline entries={entries} selectedDate={date} today={today} onToday={openToday} onSelect={open} />
 */
export const DiaryTimeline: React.FC<DiaryTimelineProps> = ({ entries, selectedDate, today, onToday, onSelect }) => (
  <div style={{ width: '220px', flexShrink: 0 }}>
    <button
      onClick={onToday}
      className="btn-primary"
      style={{ width: '100%', padding: '0.75rem', marginBottom: '1.5rem' }}
    >
      <Plus size={18} /> Página de Hoje
    </button>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {entries.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
          Nenhuma entrada ainda. Clique em "Página de Hoje" para começar.
        </p>
      )}
      {entries.map((entry) => (
        <TimelineItem
          key={entry.entry_date}
          date={entry.entry_date}
          isSelected={entry.entry_date === selectedDate}
          isToday={entry.entry_date === today}
          onSelect={onSelect}
        />
      ))}
    </div>
  </div>
);

const TimelineItem: React.FC<{
  date: string;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (date: string) => void;
}> = ({ date, isSelected, isToday, onSelect }) => (
  <button
    onClick={() => onSelect(date)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      borderRadius: 'var(--radius-md)',
      border: 'none',
      background: isSelected ? 'rgba(var(--color-primary-rgb, 79, 70, 229), 0.1)' : 'transparent',
      borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all var(--transition-fast)',
      color: isSelected ? 'var(--color-primary)' : 'var(--text-main)',
    }}
  >
    <Calendar size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
    <div>
      <div style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400 }}>{formatDiaryDateShort(date)}</div>
      {isToday && <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 600 }}>Hoje</div>}
    </div>
  </button>
);
