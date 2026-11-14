import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Pencil } from 'lucide-react';
import type { ProjectDocument } from '../../../types';
import { quickAccessSlots, recentQuickAccess } from './recentQuickAccess';
import { useViewportHeight } from './useViewportHeight';

interface QuickAccessRecentsProps {
  projectId: number;
  documents: ProjectDocument[];
  onOpen: (doc: ProjectDocument) => void;
  onManage: () => void;
}

const RecentLink: React.FC<{ doc: ProjectDocument; onOpen: () => void }> = ({ doc, onOpen }) => (
  <button type="button" className="project-nav__quick" onClick={onOpen} title={doc.url || doc.local_file_path}>
    {doc.url ? <ExternalLink size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
    <span className="project-nav__label">{doc.title}</span>
  </button>
);

/**
 * The quick access links at the foot of the project sidebar (redesign, board 150): only the most recently
 * opened ones, as many as fit in a third of the window, with a link to the full list on the overview.
 *
 * @example <QuickAccessRecents projectId={3} documents={docs} onOpen={open} onManage={() => setManaging(true)} />
 */
export const QuickAccessRecents: React.FC<QuickAccessRecentsProps> = ({ projectId, documents, onOpen, onManage }) => {
  const recents = recentQuickAccess(documents, quickAccessSlots(useViewportHeight()));
  return (
    <section className="project-nav__quick-access" aria-label="Acesso rápido">
      <div className="project-nav__quick-head">
        <span className="project-nav__eyebrow">Acesso rápido</span>
        <button
          type="button"
          className="project-nav__icon-button"
          onClick={onManage}
          aria-label="Gerenciar acesso rápido"
          title="Gerenciar acesso rápido"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
      {recents.length === 0 && <p className="project-nav__empty">Nenhum link ainda.</p>}
      {recents.map((doc) => (
        <RecentLink key={doc.id} doc={doc} onOpen={() => onOpen(doc)} />
      ))}
      {documents.length > recents.length && (
        <Link to={`/projects/${projectId}/overview`} className="project-nav__see-all">
          Ver todos na Visão geral
        </Link>
      )}
    </section>
  );
};
