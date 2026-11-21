import React from 'react';
import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/projects', label: 'Projetos' },
  { to: '/settings', label: 'Ajustes' },
];

/**
 * The bar at the bottom of the top-level screens.
 *
 * @example <BottomNav />
 */
export const BottomNav: React.FC = () => (
  <nav className="m-bottomnav" aria-label="Navegação principal">
    {ITEMS.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) => `m-bottomnav__item${isActive ? ' is-active' : ''}`}
      >
        {item.label}
      </NavLink>
    ))}
  </nav>
);
