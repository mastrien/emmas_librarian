import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Library, Plus, Settings } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isReader = location.pathname.startsWith('/articles/');

  if (isReader) {
    // The reader page usually wants full screen without the main navigation wrapper
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-panel" style={{ 
        position: 'sticky', 
        top: 0, 
        zIndex: 50,
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'var(--text-heading)' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            padding: '0.5rem',
            borderRadius: 'var(--radius-md)',
            color: 'white',
            display: 'flex'
          }}>
            <Library size={24} />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Emma's Librarian</h1>
        </Link>
        
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/" className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
            Projetos
          </Link>
          <Link to="/settings" className="btn-secondary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} /> Configurações
          </Link>
        </nav>
      </header>

      <main className="fade-in" style={{ flexGrow: 1, padding: '2rem' }}>
        {children}
      </main>
    </div>
  );
};
