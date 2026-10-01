import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportWithFeedback } from '../exportWithFeedback';

describe('exportWithFeedback', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells where the file was saved', async () => {
    await exportWithFeedback(async () => 'C:/Exportados/a.csv', 'CSV');

    expect(window.alert).toHaveBeenCalledWith('CSV exportado com sucesso para: C:/Exportados/a.csv');
  });

  it('says nothing when the save dialog was cancelled', async () => {
    await exportWithFeedback(async () => null, 'CSV');

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('reports the reason of a failure, whatever was thrown', async () => {
    await exportWithFeedback(() => Promise.reject(new Error('disco cheio')), 'XLSX');
    await exportWithFeedback(() => Promise.reject({ error: 'sem permissão' }), 'XLSX');

    expect(vi.mocked(window.alert).mock.calls).toEqual([
      ['Erro ao exportar XLSX: disco cheio'],
      ['Erro ao exportar XLSX: sem permissão'],
    ]);
  });
});
