import type { ScreeningModel } from './ScreeningEngine';

// e2e-tests/screening_suggestion.spec.js asserts on this answer. The quote is in the abstract the spec writes.
const ANSWER = JSON.stringify({
  label: 1,
  confidence: 0.9,
  reason: 'Justificativa E2E',
  quote: 'trecho que sustenta',
});

/**
 * E2E runs (E2E_MOCK_AI_ASK=true) must not reach AI providers. The prompt, the reading of the answer and the saving
 * stay real.
 *
 * @example registerScreeningSuggestionHandlers(ipcMain, db, e2eScreeningModel);
 */
export function e2eScreeningModel(): ScreeningModel {
  return { complete: async () => ANSWER, modelId: 'e2e/mock' };
}
