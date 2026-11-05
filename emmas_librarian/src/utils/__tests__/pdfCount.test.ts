import { describe, expect, it } from 'vitest';
import { embeddingModelName, pdfCount } from '../pdfCount';

describe('pdfCount', () => {
  it.each([
    [1, '1 PDF'],
    [2, '2 PDFs'],
    [0, '0 PDFs'],
  ])('says %i as %s', (count, said) => {
    expect(pdfCount(count)).toBe(said);
  });
});

describe('embeddingModelName', () => {
  it.each([
    ['ollama/nomic-embed-text', 'nomic-embed-text (Ollama)'],
    ['local/all-MiniLM-L6-v2', 'all-MiniLM-L6-v2 (Local Embutido)'],
    ['novo/modelo/com/barra', 'modelo/com/barra (novo)'],
    ['sem-provedor', 'sem-provedor'],
  ])('shows %s as %s', (modelId, shown) => {
    expect(embeddingModelName(modelId)).toBe(shown);
  });
});
