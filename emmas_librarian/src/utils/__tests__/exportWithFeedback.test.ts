import { describe, expect, it } from 'vitest';
import { exportWithFeedback, EXPORT_DONE_TITLE, EXPORT_FAILED_TITLE } from '../exportWithFeedback';
import { FakeDialogs } from '../../components/common/dialogs/__tests__/fakes/FakeDialogs';

describe('exportWithFeedback', () => {
  it('tells where the file was saved', async () => {
    const dialogs = new FakeDialogs();

    await exportWithFeedback(async () => 'C:/Exportados/a.csv', 'CSV', dialogs.inform);

    expect(dialogs.informed).toEqual([
      { title: EXPORT_DONE_TITLE, message: 'CSV exportado com sucesso para: C:/Exportados/a.csv' },
    ]);
  });

  it('says nothing when the save dialog was cancelled', async () => {
    const dialogs = new FakeDialogs();

    await exportWithFeedback(async () => null, 'CSV', dialogs.inform);

    expect(dialogs.informed).toEqual([]);
  });

  it('reports the reason of a failure, whatever was thrown', async () => {
    const dialogs = new FakeDialogs();

    await exportWithFeedback(() => Promise.reject(new Error('disco cheio')), 'XLSX', dialogs.inform);
    await exportWithFeedback(() => Promise.reject({ error: 'sem permissão' }), 'XLSX', dialogs.inform);

    expect(dialogs.informMessage.mock.calls).toEqual([
      ['Erro ao exportar XLSX: disco cheio'],
      ['Erro ao exportar XLSX: sem permissão'],
    ]);
    expect(dialogs.informed.map((d) => d.title)).toEqual([EXPORT_FAILED_TITLE, EXPORT_FAILED_TITLE]);
  });
});
