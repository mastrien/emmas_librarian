import type React from 'react';

// Long option names must shrink with the panel, never push past it (the #50 mock-up's select did).
export const PANEL_FIELD: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
};
export const PANEL_LABEL: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  fontSize: '0.8rem',
};
