import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Settings } from 'lucide-react';
import { HelpButton } from './HelpButton';
import { Logo } from './Logo';

const NativeTitleBar = () => (
  <div style={{
    height: '32px',
    width: '100%',
    WebkitAppRegion: 'drag',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-main)',
    position: 'sticky',
    top: 0,
    zIndex: 60
  }} className="native-titlebar">
    Emma's Librarian
  </div>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isReader = location.pathname.startsWith('/articles/');

  if (isReader) {
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NativeTitleBar />
      <header className="glass-panel" style={{ 
        position: 'sticky', 
        top: '32px', 
        zIndex: 50,
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'var(--text-heading)' }}>
          <Logo size={36} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Emma's Librarian</h1>
        </Link>
        
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <HelpButton />
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
