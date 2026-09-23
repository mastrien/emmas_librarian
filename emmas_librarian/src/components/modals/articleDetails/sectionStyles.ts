import type React from 'react';

/** Small uppercase caption above a section of the details modal. */
export const sectionCaptionStyle = (marginBottom: string): React.CSSProperties => ({
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  fontWeight: 600,
  marginBottom,
});

/** Top border separating the stacked sections of the details modal. */
export const sectionStyle: React.CSSProperties = { borderTop: '1px solid var(--border-color)', paddingTop: '1rem' };
