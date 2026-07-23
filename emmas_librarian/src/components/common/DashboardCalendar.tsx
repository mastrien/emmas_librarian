import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ScientificVenue } from '../../types';

interface DashboardCalendarProps {
  diarySet: Set<string>;
  venues?: ScientificVenue[];
  onAddVenue?: (dateStr?: string) => void;
  onOpenAgenda?: () => void;
  onSelectDate?: (dateStr: string) => void;
}

export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({
  diarySet,
  venues = [],
  onAddVenue,
  onOpenAgenda,
  onSelectDate,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Map of date string -> milestones
  const milestoneMap = new Map<string, number>();
  for (const v of venues) {
    for (const m of v.milestones || []) {
      if (m.target_date) {
        milestoneMap.set(m.target_date, (milestoneMap.get(m.target_date) || 0) + 1);
      }
      if (m.field_type === 'range' && m.end_date) {
        milestoneMap.set(m.end_date, (milestoneMap.get(m.end_date) || 0) + 1);
      }
    }
  }

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} style={{ aspectRatio: '1' }} />);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const activeDiary = diarySet.has(dStr);
    const deadlineCount = milestoneMap.get(dStr) || 0;

    const todayDate = new Date();
    const isToday = todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === i;

    const titleParts = [new Date(year, month, i).toLocaleDateString()];
    if (activeDiary) titleParts.push('Atividade no Diário');
    if (deadlineCount > 0) titleParts.push(`${deadlineCount} Prazo(s)`);
    if (isToday) titleParts.push('(Hoje)');

    days.push(
      <div
        key={`day-${i}`}
        title={titleParts.join(' • ')}
        onClick={() => onSelectDate && onSelectDate(dStr)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '1',
          borderRadius: '4px',
          backgroundColor: isToday
            ? 'var(--color-primary)'
            : activeDiary
              ? 'var(--bg-hover)'
              : 'transparent',
          color: isToday ? '#ffffff' : activeDiary ? 'var(--text-heading)' : 'var(--text-main)',
          fontSize: '0.8rem',
          fontWeight: isToday ? 'bold' : 'normal',
          border: '1px solid transparent',
          cursor: onSelectDate ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        {i}
        {deadlineCount > 0 && !isToday && (
          <span
            style={{
              position: 'absolute',
              bottom: '3px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
            }}
          />
        )}
      </div>,
    );
  }

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CalendarIcon size={16} color="var(--color-primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
            {monthNames[month]} {year}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--text-muted)' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
        <div>Dom</div>
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sáb</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {days}
      </div>
    </div>
  );
};
