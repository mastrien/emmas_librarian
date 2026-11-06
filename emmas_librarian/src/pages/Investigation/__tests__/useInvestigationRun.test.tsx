import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { describeExtractionModel, useInvestigationRun } from '../useInvestigationRun';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';
import type { Article } from '../../../types';

const ARTICLES = [1, 2, 3].map((id) => ({ id, project_id: 7, title: `A${id}`, status: 'new' }) as Article);

function hookWith(service: FakeProjectService, onFatal = vi.fn()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ServicesProvider apiService={service}>{children}</ServicesProvider>
  );
  return renderHook(() => useInvestigationRun(onFatal), { wrapper });
}

async function runWith(service: FakeProjectService) {
  const { result } = hookWith(service);
  await act(() =>
    result.current.start({
      projectId: 7,
      articles: ARTICLES,
      questions: ['Qual a base?', ' '],
      selectedIds: [1, 2, 3],
    }),
  );
  return { saved: service.saveMassiveInvestigation.mock.calls[0]?.[4], result };
}

// Validation of epic #44 (2026-11-01): with the wrong provider every call failed and the run was saved "Sucesso".
describe('useInvestigationRun saved status', () => {
  it('saves "Falhou" when every article failed', async () => {
    const service = new FakeProjectService();
    service.massiveExtraction.mockRejectedValue(new Error('401 Unauthorized'));

    expect((await runWith(service)).saved).toBe('Falhou');
  });

  it('says how many articles failed when only some did', async () => {
    const service = new FakeProjectService();
    service.massiveExtraction
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValueOnce([]);

    expect((await runWith(service)).saved).toBe('Concluída com erros (1 de 3)');
  });

  it('keeps "Sucesso" when every article answered', async () => {
    expect((await runWith(new FakeProjectService())).saved).toBe('Sucesso');
  });
});

describe('useInvestigationRun', () => {
  it('sends only the filled questions and ends knowing what it saved', async () => {
    const service = new FakeProjectService();
    service.saveMassiveInvestigation.mockResolvedValue(21);

    const { result } = await runWith(service);

    expect(service.massiveExtraction).toHaveBeenCalledWith(1, ['Qual a base?']);
    expect(result.current.run).toMatchObject({ isRunning: false, savedId: 21, current: 3 });
  });

  it('does nothing without a question or an article', async () => {
    const service = new FakeProjectService();
    const { result } = hookWith(service);

    await act(() => result.current.start({ projectId: 7, articles: ARTICLES, questions: [' '], selectedIds: [1] }));
    await act(() => result.current.start({ projectId: 7, articles: ARTICLES, questions: ['Q'], selectedIds: [] }));

    expect(result.current.run).toBeNull();
    expect(service.massiveExtraction).not.toHaveBeenCalled();
  });

  it('stops at a quota error, saves the rest as skipped and says so', async () => {
    const service = new FakeProjectService();
    service.massiveExtraction.mockRejectedValue(new Error('HTTP 429'));

    const { saved, result } = await runWith(service);

    expect(saved).toBe('Erro: Quota Excedida');
    expect(service.massiveExtraction).toHaveBeenCalledTimes(1);
    expect(result.current.run?.quotaHit).toBe(true);
    expect(service.saveInvestigationResults.mock.calls[1][2][0]).toMatchObject({ status: 'skipped' });
    act(() => result.current.dismissQuota());
    expect(result.current.run?.quotaHit).toBe(false);
  });

  it('reports a failed save and stops running', async () => {
    let finish: (rows: never[]) => void = () => undefined;
    const service = new FakeProjectService();
    service.massiveExtraction.mockImplementation(() => new Promise((resolve) => (finish = resolve as never)));
    service.saveMassiveInvestigation.mockRejectedValue(new Error('disco cheio'));
    const onFatal = vi.fn();
    const { result } = hookWith(service, onFatal);

    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.start({ projectId: 7, articles: ARTICLES, questions: ['Q'], selectedIds: [1] });
    });
    await act(async () => {
      finish([]);
      await running;
    });

    expect(onFatal).toHaveBeenCalledWith(expect.objectContaining({ message: 'disco cheio' }));
    expect(result.current.run?.isRunning).toBe(false);
    act(() => result.current.dismiss());
    expect(result.current.run).toBeNull();
  });
});

describe('describeExtractionModel', () => {
  it('names the provider and the model of the extraction skill', async () => {
    const service = new FakeProjectService();
    service.getAiModelConfigs.mockResolvedValue([
      { skill: 'chat', provider: 'gemini', model_name: 'x' },
      { skill: 'extraction', provider: 'ollama', model_name: 'gpt-oss:120b' },
    ] as never);

    expect(await describeExtractionModel(service)).toBe('Ollama (gpt-oss:120b)');
  });

  // The 1.3.0 tutorial captures showed "ollama_cloud (gpt-oss:120b)" in the investigation header.
  it('names Ollama Cloud by its name, not its id', async () => {
    const service = new FakeProjectService();
    service.getAiModelConfigs.mockResolvedValue([
      { skill: 'extraction', provider: 'ollama_cloud', model_name: 'gpt-oss:120b' },
    ] as never);

    expect(await describeExtractionModel(service)).toBe('Ollama Cloud (gpt-oss:120b)');
  });

  it('names a provider it has no display name for by its id, and leaves out a missing model', async () => {
    const service = new FakeProjectService();
    service.getAiModelConfigs.mockResolvedValue([
      { skill: 'extraction', provider: 'mistral', model_name: '' },
    ] as never);

    expect(await describeExtractionModel(service)).toBe('mistral');
  });

  it('says it does not know when the extraction has no model set', async () => {
    expect(await describeExtractionModel(new FakeProjectService())).toBe('Desconhecido');
  });

  it('says it does not know rather than failing', async () => {
    const service = new FakeProjectService();
    service.getAiModelConfigs.mockRejectedValue(new Error('x'));

    expect(await describeExtractionModel(service)).toBe('Desconhecido');
  });
});
