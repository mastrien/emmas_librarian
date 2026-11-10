import React, { useEffect, useState } from 'react';

/**
 * The date and the time as the eyebrow of the home header (board 151), ticking each second:
 * "Domingo, 8 de novembro · 22:14".
 *
 * @example <DashboardClock />
 */
export function dateLine(now: Date): string {
  const weekday = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dayAndMonth = now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dayAndMonth} · ${time}`;
}

export const DashboardClock: React.FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <span data-testid="dashboard-clock">{dateLine(now)}</span>;
};
