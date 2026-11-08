import React from 'react';
import { BookOpen, FileText, History, PieChart, Tags } from 'lucide-react';
import '../projectPage.css';

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
    <div className="project-tabs">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            className={isActive ? 'project-tab is-active' : 'project-tab'}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );
};
