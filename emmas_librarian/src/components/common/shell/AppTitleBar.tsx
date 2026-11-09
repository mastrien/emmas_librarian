import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Logo } from '../Logo';
import type { Crumb } from './breadcrumbs';

const Breadcrumbs: React.FC<{ trail: Crumb[] }> = ({ trail }) => (
  <nav aria-label="Caminho" className="app-breadcrumbs">
    <ol>
      {trail.map((crumb, index) => (
        <li key={`${index}-${crumb.label}`}>
          {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
          {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
        </li>
      ))}
    </ol>
  </nav>
);

/**
 * The window's title bar (redesign, board 150): the logo and the path to the current screen. It is the drag
 * area of the frameless window; the OS window buttons draw over its right end.
 *
 * @example <AppTitleBar trail={breadcrumbTrail(pathname, projectName)} />
 */
export const AppTitleBar: React.FC<{ trail: Crumb[]; children?: React.ReactNode }> = ({ trail, children }) => (
  <header className="app-titlebar">
    <Link to="/" className="app-titlebar__logo" aria-label="Emma's Librarian, ir para o início">
      <Logo size={20} />
    </Link>
    <Breadcrumbs trail={trail} />
    <div className="app-titlebar__actions">{children}</div>
  </header>
);
