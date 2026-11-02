import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMassiveExtraction } from '../useMassiveExtraction';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../../../types';

const ARTICLES = [1, 2, 3].map((id) => ({ id, project_id: 7, title: `A${id}`, status: 'new' }) as Article);

async function runWith(service: FakeProjectService) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ServicesProvider apiService={service}>{children}</ServicesProvider>
  );
  const { result } = renderHook(
    () =>
      useMassiveExtraction({
        projectId: 7,
        articles: ARTICLES,
        onQuotaExceeded: vi.fn(),
        onHistoryChanged: vi.fn(),
        onFatalError: vi.fn(),
      }),
    { wrapper },
  );
  act(() => result.current.setQuestions(['Qual a base?']));
  await act(() => result.current.run([1, 2, 3]));
  return service.saveMassiveInvestigation.mock.calls[0][4];
}

// Validation of epic #44 (2026-11-01): with the wrong provider every call failed and the run was saved "Sucesso".
describe('useMassiveExtraction saved status', () => {
  it('saves "Falhou" when every article failed', async () => {
    const service = new FakeProjectService();
    service.massiveExtraction.mockRejectedValue(new Error('HTTP 401: chave inválida'));

    expect(await runWith(service)).toBe('Falhou');
  });

  it('says how many articles failed when only some did', async () => {
    const service = new FakeProjectService();
    service.massiveExtraction.mockResolvedValueOnce([]).mockRejectedValue(new Error('timeout'));

    expect(await runWith(service)).toBe('Concluída com erros (2 de 3)');
  });

  it('keeps "Sucesso" when every article answered', async () => {
    expect(await runWith(new FakeProjectService())).toBe('Sucesso');
  });
});
