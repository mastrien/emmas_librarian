import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { LEGAL_REVIEW_WARNING } from '../../pages/Terms/termsContent';

interface LegalReviewNoticeProps {
  /** A second, specific line under the general warning (the IEEE ban on AI). */
  detail?: string;
  /** Smaller, for beside a field. */
  compact?: boolean;
}

/**
 * The red warning that the terms summaries were not reviewed by a lawyer, in the terms page and beside the IEEE key
 * field, so nobody feeds restricted content to an AI without knowing it. Red on purpose: it must not be skimmed.
 *
 * @example <LegalReviewNotice detail={IEEE_AI_WARNING} compact />
 */
export const LegalReviewNotice: React.FC<LegalReviewNoticeProps> = ({ detail, compact = false }) => (
  <span className={`legal-notice${compact ? ' legal-notice--compact' : ''}`} role="alert">
    <AlertTriangle size={compact ? 14 : 18} aria-hidden="true" />
    <span className="legal-notice__text">
      <strong>{LEGAL_REVIEW_WARNING}</strong>
      {detail && <span className="legal-notice__detail"> {detail}</span>}
    </span>
  </span>
);
