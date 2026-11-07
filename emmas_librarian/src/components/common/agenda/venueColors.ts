import type React from 'react';
import type { ScientificVenue } from '../../../types';

/**
 * A venue's own colour as CSS variables for agenda.css: --venue-color, and --venue-tint (the same colour at 0x22
 * alpha, as the chip always used). Without a colour the CSS falls back to the default blue.
 *
 * @example <span className="venue-chip" style={venueColorVars(venue)}>SBBD</span>
 */
export function venueColorVars(venue: Pick<ScientificVenue, 'color'>): React.CSSProperties | undefined {
  if (!venue.color) return undefined;
  return { '--venue-color': venue.color, '--venue-tint': `${venue.color}22` } as React.CSSProperties;
}
