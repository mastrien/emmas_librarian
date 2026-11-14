import React from 'react';
import '../projectPage.css';

/**
 * Placeholder layout (header, actions, content) shown while the project loads; the tabs became the sidebar.
 *
 * Usage:
 *   if (loading) return <ProjectDetailsSkeleton />;
 */
export const ProjectDetailsSkeleton: React.FC = () => (
  <div className="fade-in project-page">
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
    <div className="skeleton-block skeleton-block--content" />
  </div>
);
