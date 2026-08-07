import React, { useEffect, useState } from 'react';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          fontSize: '3.75rem',
          fontWeight: 700,
          color: 'var(--text-heading)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {currentTimeStr}
      </div>
      <div
        style={{
          fontSize: '0.95rem',
          color: 'var(--text-muted)',
          fontWeight: 500,
          textTransform: 'capitalize',
          marginTop: '0.6rem',
        }}
      >
        {currentDateStr}
      </div>
    </div>
  );
};
