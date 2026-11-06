import React from 'react';
import './experimentalTag.css';

/**
 * Marks a feature whose results were not yet measured with real data (release 1.3.0, decided with the author). The
 * reason shows on hover, so the person knows what is still unchecked and can judge what to trust.
 *
 * @example <ExperimentalTag reason="A ordem ainda não foi medida numa triagem real." />
 */
export const ExperimentalTag: React.FC<{ reason: string }> = ({ reason }) => (
  <span className="experimental-tag" title={reason} data-testid="experimental-tag">
    Experimental
  </span>
);
