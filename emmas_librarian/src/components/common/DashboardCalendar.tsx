import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScientificVenue } from '../../types';
import { MONTH_NAMES, WEEKDAYS, dayTitle, deadlineColorsByDate, isoDay } from './calendar/calendarDays';
import './calendar/calendar.css';

interface DashboardCalendarProps {
  diarySet: Set<string>;
  venues?: ScientificVenue[];
  onAddVenue?: (dateStr?: string) => void;
  onOpenAgenda?: () => void;
  onSelectDate?: (dateStr: string) => void;
}

interface DayProps {
  date: Date;
  iso: string;
  diary: boolean;
  colors: string[];
  onSelect?: (iso: string) => void;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// A day: the number, its state (today, diary, clickable) as classes, and up to three deadline dots in venue colours.
const CalendarDay: React.FC<DayProps> = ({ date, iso, diary, colors, onSelect }) => {
  const today = isSameDay(date, new Date());
  const className = ['month-calendar-day', onSelect && 'is-clickable', diary && 'has-diary', today && 'is-today']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={className}
      title={dayTitle(date, { diary, deadlines: colors.length, today })}
      onClick={() => onSelect && onSelect(iso)}
    >
      {date.getDate()}
      {colors.length > 0 && !today && (
        <div className="month-calendar-dots">
          {colors.slice(0, 3).map((color, idx) => (
            <span key={idx} className="month-calendar-dot" style={{ '--dot-color': color } as React.CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
};

const MonthHeader: React.FC<{ year: number; month: number; onMove: (delta: number) => void }> = (props) => (
  <div className="month-calendar-head">
    <div className="month-calendar-title">
      <CalendarIcon size={16} />
      <span>
        {MONTH_NAMES[props.month]} {props.year}
      </span>
    </div>
    <div className="month-calendar-nav">
      <button type="button" onClick={() => props.onMove(-1)}>
        <ChevronLeft size={16} />
      </button>
      <button type="button" onClick={() => props.onMove(1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  </div>
);

/**
 * The month calendar of the dashboard and the agenda: diary days shaded, deadline dots in the venues' colours, today
 * highlighted. Clicking a day passes its date (yyyy-mm-dd) to `onSelectDate`.
 *
 * @example <DashboardCalendar diarySet={diary} venues={venues} onSelectDate={(d) => addVenue(d)} />
 */
export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({ diarySet, venues = [], onSelectDate }) => {
  const [shown, setShown] = useState(new Date());
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const colorsByDate = deadlineColorsByDate(venues);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = new Date(year, month, 1).getDay();
  return (
    <div data-testid="date-calendar" className="month-calendar">
      <MonthHeader year={year} month={month} onMove={(delta) => setShown(new Date(year, month + delta, 1))} />
      <div className="month-calendar-weekdays">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="month-calendar-days">
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`empty-${i}`} className="month-calendar-blank" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = isoDay(year, month, i + 1);
          return (
            <CalendarDay
              key={iso}
              date={new Date(year, month, i + 1)}
              iso={iso}
              diary={diarySet.has(iso)}
              colors={colorsByDate.get(iso) || []}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
};
