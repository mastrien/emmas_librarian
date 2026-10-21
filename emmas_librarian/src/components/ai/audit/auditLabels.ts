import type { ReviewStatus } from '../../../types';

/** How a sampled answer's review reads in the audit: its words there are correct / fixed / wrong. */
export const REVIEW_CHIP: Record<ReviewStatus, { label: string; className: string }> = {
  pending: { label: 'pendente', className: 'pending' },
  accepted: { label: 'correto', className: 'accepted' },
  edited: { label: 'corrigido', className: 'edited' },
  rejected: { label: 'incorreto', className: 'rejected' },
};
