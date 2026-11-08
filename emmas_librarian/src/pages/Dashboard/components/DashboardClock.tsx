import React, { useEffect, useState } from 'react';
import '../dashboard.css';

export const DashboardClock: React.FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentTimeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = now.getDate();
  const monthShort = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const year = now.getFullYear();
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const currentDateStr = `${weekday}, ${day} ${monthShort} ${year}`;

  return (
    <div data-testid="dashboard-clock" className="dashboard-clock">
      <div className="dashboard-clock-time">{currentTimeStr}</div>
      <div className="dashboard-clock-date">{currentDateStr}</div>
    </div>
  );
};
