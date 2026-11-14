import { describe, expect, it, vi } from 'vitest';
import { importProjectWithFeedback } from '../importProjectWithFeedback';

describe('importProjectWithFeedback', () => {
  it('returns the id of the imported project, passing the dropped file along', async () => {
    const service = { importProject: vi.fn().mockResolvedValue(4) };

    const id = await importProjectWithFeedback(service, vi.fn(), { path: 'C:/p.emmapcarc' });

    expect(id).toBe(4);
    expect(service.importProject).toHaveBeenCalledWith('C:/p.emmapcarc');
  });

  it('returns null when the person cancelled the file dialog', async () => {
    const service = { importProject: vi.fn().mockResolvedValue(null) };

    expect(await importProjectWithFeedback(service, vi.fn())).toBeNull();
  });

  it('tells what failed, naming what was imported, and returns null', async () => {
    const service = { importProject: vi.fn().mockRejectedValue(new Error('arquivo corrompido')) };
    const inform = vi.fn().mockResolvedValue(undefined);

    const id = await importProjectWithFeedback(service, inform, { what: 'a.emmapcarc' });

    expect(id).toBeNull();
    expect(inform).toHaveBeenCalledWith({
      title: 'Erro ao importar',
      message: 'Erro ao importar a.emmapcarc: arquivo corrompido',
    });
  });

  it('writes a value that is not an Error as it is', async () => {
    const service = { importProject: vi.fn().mockRejectedValue('sem espaço') };
    const inform = vi.fn().mockResolvedValue(undefined);

    await importProjectWithFeedback(service, inform);

    expect(inform.mock.calls[0][0].message).toBe('Erro ao importar projeto: sem espaço');
  });
});
