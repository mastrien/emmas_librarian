import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export const DashboardCalendar: React.FC<{ diarySet: Set<string> }> = ({ diarySet }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} style={{ aspectRatio: '1' }}></div>);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const active = diarySet.has(dStr);
    
    const todayDate = new Date();
    const isToday = todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === i;

    days.push(
      <div 
        key={`day-${i}`} 
        title={`${new Date(year, month, i).toLocaleDateString()}: ${active ? 'Com atividade' : 'Sem atividade'}${isToday ? ' (Hoje)' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '1',
          borderRadius: '4px',
          backgroundColor: active ? 'var(--color-primary)' : 'var(--bg-main)',
          border: isToday ? '2px solid var(--color-primary)' : (active ? 'none' : '1px solid var(--border-color)'),
          color: active ? 'white' : (isToday ? 'var(--color-primary)' : 'var(--text-muted)'),
          fontSize: '0.8rem',
          fontWeight: (active || isToday) ? 'bold' : 'normal',
          opacity: active || isToday ? 1 : 0.7,
          boxShadow: active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
          cursor: 'default',
          boxSizing: 'border-box'
        }}
      >
        {i}
      </div>
    );
  }

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="fade-in" style={{
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <CalendarIcon size={20} /> Atividade no Diário
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <button onClick={prevMonth} className="btn-secondary" style={{ padding: '0.2rem' }}><ChevronLeft size={16}/></button>
          <span style={{ fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
            {monthNames[month]} {year}
          </span>
          <button onClick={nextMonth} className="btn-secondary" style={{ padding: '0.2rem' }}><ChevronRight size={16}/></button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        {weekDays.map(wd => <div key={wd}>{wd}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {days}
      </div>
    </div>
  );
};
