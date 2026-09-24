import React from 'react';
import { BookOpen, FileText, History, PieChart, Tags } from 'lucide-react';

export type ProjectTabId = 'articles' | 'overview' | 'diary' | 'categories' | 'history';

interface ProjectTabsProps {
  activeTab: ProjectTabId;
  onSelect: (tab: ProjectTabId) => void;
  articleCount: number;
  historyCount: number;
}

/**
 * Tab strip of the project page; article and search-history tabs show their counts.
 *
 * Usage:
 *   <ProjectTabs activeTab={tab} onSelect={setTab} articleCount={articles.length} historyCount={history.length} />
 */
export const ProjectTabs: React.FC<ProjectTabsProps> = ({ activeTab, onSelect, articleCount, historyCount }) => {
  const tabs: { id: ProjectTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'articles', label: `Artigos (${articleCount})`, icon: <FileText size={16} /> },
    { id: 'overview', label: 'Estatísticas', icon: <PieChart size={16} /> },
    { id: 'diary', label: 'Diário', icon: <BookOpen size={16} /> },
    { id: 'categories', label: 'Categorias', icon: <Tags size={16} /> },
    { id: 'history', label: `Histórico (${historyCount})`, icon: <History size={16} /> },
  ];
  return (
    <div
      style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)' }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );
};
