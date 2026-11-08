import { describe, it, expect } from 'vitest';
import { confidenceLevel } from '../RAGResultCard';

describe('confidenceLevel', () => {
  it('bands the confidence: above 0.8 high, above 0.5 medium, otherwise low', () => {
    expect([0.81, 0.8, 0.51, 0.5, 0].map(confidenceLevel)).toEqual(['high', 'medium', 'medium', 'low', 'low']);
  });
});
