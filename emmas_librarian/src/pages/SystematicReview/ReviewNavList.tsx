import React from 'react';
import { NavLink } from 'react-router-dom';

/** The parts of the review, each with its own address (#50, #54). */
export type ReviewTab = 'screening' | 'prisma' | 'evaluation';

export const REVIEW_PARTS: readonly { tab: ReviewTab; label: string; path: string }[] = [
  { tab: 'screening', label: 'Triagem', path: '' },
  { tab: 'prisma', label: 'Diagrama PRISMA', path: '/prisma' },
  { tab: 'evaluation', label: 'Avaliar sugestões', path: '/evaluation' },
];

const subClass = ({ isActive }: { isActive: boolean }) => `project-nav__sub${isActive ? ' is-active' : ''}`;

/**
 * The parts of the review under "Revisão sistemática" in the project sidebar (board 164), in place of the tabs the
 * page had: Triagem with how many articles still wait for a decision, the PRISMA diagram and the evaluation.
 *
 * @example <ReviewNavList projectId={3} pending={96} />
 */
export const ReviewNavList: React.FC<{ projectId: number; pending: number }> = ({ projectId, pending }) => (
  <nav className="project-nav__sub-list" aria-label="Partes da revisão">
    {REVIEW_PARTS.map((part) => (
      <NavLink key={part.tab} end to={`/projects/${projectId}/review${part.path}`} className={subClass}>
        <span className="project-nav__sub-label">{part.label}</span>
        {part.tab === 'screening' && pending > 0 && (
          <>
            {' '}
            <span className="project-nav__sub-count" aria-label={`${pending} sem decisão`}>
              {pending}
            </span>
          </>
        )}
      </NavLink>
    ))}
  </nav>
);
