import type { AskModels } from './askServices';

// Any text gets the same vector: the search still runs on real chunks of the real PDF.
const VECTOR = [0.1, 0.2, 0.3, 0.4];

// One statement of each kind the screen tells apart; e2e-tests/ask_projects.spec.js asserts on them.
const ANSWER = JSON.stringify({
  claims: [
    { text: 'Afirmação conferida E2E', sources: [1] },
    { text: 'Afirmação inventada E2E', sources: [999] },
  ],
});

/**
 * E2E runs (E2E_MOCK_AI_ASK=true) must not reach AI providers. The indexing, the search and the saving stay real.
 *
 * @example buildAskServices(db, e2eAskModels());
 */
export function e2eAskModels(): AskModels {
  return {
    embedder: {
      embed: async () => VECTOR,
      embedBatch: async (texts) => texts.map(() => VECTOR),
    },
    complete: async () => ANSWER,
    modelId: 'e2e/mock',
  };
}
