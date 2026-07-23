import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, Sparkles, FileText, MoreVertical, Folder, Calendar } from 'lucide-react';
import { HelpButton } from './HelpButton';
import { Logo } from './Logo';
import { ChangelogModal } from '../modals/ChangelogModal';
import { useProjectService } from '../../contexts/ServicesContext';

const NativeTitleBar = () => (
  <div
    style={
      {
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
        zIndex: 60,
        flexShrink: 0,
      } as React.CSSProperties
    }
    className="native-titlebar"
  >
    Emma's Librarian
  </div>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const projectService = useProjectService();
  const location = useLocation();
  const isReader = location.pathname.startsWith('/articles/');
  const [showChangelog, setShowChangelog] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    setIsMenuOpen(true);
  };

  const handleMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 200);
  };

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const version = await projectService.getAppVersion();
        setCurrentVersion(version);
        const lastSeen = localStorage.getItem('last_seen_version');

        if (!lastSeen || lastSeen !== version) {
          setShowChangelog(true);
        }
      } catch (err) {
        console.error('Failed to check app version:', err);
      }
    };
    checkVersion();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCloseChangelog = () => {
    localStorage.setItem('last_seen_version', currentVersion);
    setShowChangelog(false);
  };

  if (isReader) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <NativeTitleBar />
        <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
        <ChangelogModal isOpen={showChangelog} version={currentVersion} onClose={handleCloseChangelog} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NativeTitleBar />
      <header
        className="glass-panel"
        style={{
          position: 'sticky',
          top: '32px',
          zIndex: 50,
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textDecoration: 'none',
            color: 'var(--text-heading)',
          }}
        >
          <Logo size={36} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Emma's Librarian</h1>
        </Link>

        <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <HelpButton />

          <div
            ref={menuRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ position: 'relative' }}
          >
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Mais opções"
              style={{
                background: isMenuOpen ? 'var(--bg-surface-hover)' : 'transparent',
                border: 'none',
                padding: '0.5rem',
                cursor: 'pointer',
                color: 'var(--text-heading)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                transition: 'all 0.2s ease',
              }}
            >
              <MoreVertical size={22} />
            </button>

            {isMenuOpen && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  minWidth: '200px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.5rem',
                  gap: '0.25rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <Link
                  to="/"
                  className="menu-dropdown-item"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Folder size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Projetos
                </Link>

                <Link
                  to="/agenda"
                  className="menu-dropdown-item"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Calendar size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Agenda
                </Link>

                <Link
                  to="/pdfs"
                  className="menu-dropdown-item"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FileText size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Biblioteca de PDFs
                </Link>

                <Link
                  to="/settings"
                  className="menu-dropdown-item"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Settings size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} /> Configurações
                </Link>

                <button
                  className="menu-dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowChangelog(true);
                  }}
                >
                  <Sparkles size={18} style={{ color: '#f59e0b', flexShrink: 0 }} /> Novidades
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="fade-in" style={{ flexGrow: 1, padding: '2rem' }}>
        {children}
      </main>

      <ChangelogModal isOpen={showChangelog} version={currentVersion} onClose={handleCloseChangelog} />
    </div>
  );
};
