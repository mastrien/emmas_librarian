import React from 'react';
import { BackLink } from '../../../components/common/BackLink';
import '../projectPage.css';

/**
 * Placeholder layout (header, toolbar, tabs, content) shown while the project loads.
 *
 * Usage:
 *   if (loading) return <ProjectDetailsSkeleton />;
 */
export const ProjectDetailsSkeleton: React.FC = () => (
  <div className="fade-in project-page">
    <BackLink to="/" className="page-back">
      Voltar aos projetos
    </BackLink>
    <div className="project-page-top">
      <div className="project-skeleton-head">
        <div className="skeleton-block skeleton-block--title" />
        <div className="skeleton-block skeleton-block--meta" />
      </div>
      <div className="project-skeleton-buttons">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-block skeleton-block--button" />
        ))}
      </div>
    </div>
    <div className="project-skeleton-tabs">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-block skeleton-block--tab" />
      ))}
    </div>
    <div className="skeleton-block skeleton-block--content" />
  </div>
);
