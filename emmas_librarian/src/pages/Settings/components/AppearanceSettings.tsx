import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export const AppearanceSettings: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  const [accent, setAccent] = useState<string>(localStorage.getItem('accent') || 'blue');

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.invoke('UPDATE_TITLE_BAR', newTheme);
    }
  };

  const handleAccentChange = (newAccent: string) => {
    setAccent(newAccent);
    localStorage.setItem('accent', newAccent);
    document.documentElement.setAttribute('data-accent', newAccent);
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <h2
        style={{
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        Aparência
      </h2>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => handleThemeChange('light')}
          style={{
            flex: 1,
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${theme === 'light' ? 'var(--color-primary)' : 'var(--border-color)'}`,
            background: theme === 'light' ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Sun size={32} color={theme === 'light' ? 'var(--color-primary)' : 'var(--text-muted)'} />
          <span style={{ fontWeight: 600, color: theme === 'light' ? 'var(--color-primary)' : 'var(--text-main)' }}>
            Modo Claro
          </span>
        </button>
        <button
          onClick={() => handleThemeChange('dark')}
          style={{
            flex: 1,
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${theme === 'dark' ? 'var(--color-primary)' : 'var(--border-color)'}`,
            background: theme === 'dark' ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Moon size={32} color={theme === 'dark' ? 'var(--color-primary)' : 'var(--text-muted)'} />
          <span style={{ fontWeight: 600, color: theme === 'dark' ? 'var(--color-primary)' : 'var(--text-main)' }}>
            Modo Escuro
          </span>
        </button>
      </div>

      <div style={{ marginTop: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.2rem', color: 'var(--text-heading)' }}>
          Cor de Destaque
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            { id: 'blue', color: '#4f46e5', label: 'Azul' },
            { id: 'pink', color: '#db2777', label: 'Rosa' },
            { id: 'green', color: '#059669', label: 'Verde' },
            { id: 'purple', color: '#7c3aed', label: 'Roxo' },
            { id: 'orange', color: '#ea580c', label: 'Laranja' },
            { id: 'red', color: '#dc2626', label: 'Vermelho' },
          ].map((colorObj) => (
            <button
              key={colorObj.id}
              onClick={() => handleAccentChange(colorObj.id)}
              title={colorObj.label}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: colorObj.color,
                border: `3px solid ${accent === colorObj.id ? 'var(--text-heading)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)',
                boxShadow:
                  accent === colorObj.id ? '0 0 0 2px var(--bg-surface), 0 0 0 4px ' + colorObj.color : 'none',
                transform: accent === colorObj.id ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
