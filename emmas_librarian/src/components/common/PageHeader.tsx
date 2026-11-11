import React, { type ReactNode } from 'react';
import './pageHeader.css';

interface PageHeaderProps {
  /** Small upper-case label above the title ("Projeto" on the project overview). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Controls that sit on the title's line (the month navigation of the agenda). */
  titleExtra?: ReactNode;
  /** One muted line under the title: counts and dates, in tabular numbers. */
  subtitle?: ReactNode;
  /** Buttons on the right; at most one primary (canvas rule "um botão primário por tela"). */
  actions?: ReactNode;
}

/**
 * The top of a redesigned screen (redesign canvas, `.ph`): the title and its line of context on the left,
 * the screen's actions on the right, wrapping under the title on narrow windows. The path in the title bar
 * replaces the old "Voltar aos projetos" links, so there is no back link here.
 *
 * @example <PageHeader title="Artigos" subtitle="96 no projeto · 7 lidos" actions={<button>Exportar</button>} />
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, titleExtra, subtitle, actions }) => (
  <header className="page-header">
    <div className="page-header__titles">
      {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
      {titleExtra ? (
        <div className="page-header__title-row">
          <h1 className="page-header__title">{title}</h1>
          {titleExtra}
        </div>
      ) : (
        <h1 className="page-header__title">{title}</h1>
      )}
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-header__actions">{actions}</div>}
  </header>
);
