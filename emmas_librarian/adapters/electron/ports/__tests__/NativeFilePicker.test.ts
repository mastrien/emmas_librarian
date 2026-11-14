import { describe, it, expect, beforeEach } from 'vitest';
import { NativeFilePicker } from '../FilePicker';
import { FakeNativeDialogs } from './fakes/FakeNativeDialogs';

const FILTERS = [{ name: 'PDF Files', extensions: ['pdf'] }];

describe('NativeFilePicker', () => {
  let dialogs: FakeNativeDialogs;
  const picker = (env: Record<string, string | undefined> = {}) => new NativeFilePicker(dialogs, env);

  beforeEach(() => {
    dialogs = new FakeNativeDialogs();
  });

  describe('chooseSavePath', () => {
    it('opens the save dialog with the request and returns the chosen path', async () => {
      dialogs.chosen = ['/home/ana/saida.csv'];
      const request = { title: 'Exportar', defaultPath: 'saida.csv', filters: FILTERS };

      expect(await picker().chooseSavePath(request)).toBe('/home/ana/saida.csv');
      expect(dialogs.saveDialogs).toEqual([request]);
    });

    it('answers null when the dialog is cancelled', async () => {
      expect(await picker().chooseSavePath({})).toBeNull();
    });

    it('answers E2E_MOCK_SAVE_FILE_PATH without opening a dialog', async () => {
      const e2e = picker({ E2E_MOCK_SAVE_FILE_PATH: '/tmp/e2e.csv' });

      expect(await e2e.chooseSavePath({})).toBe('/tmp/e2e.csv');
      expect(dialogs.saveDialogs).toEqual([]);
    });
  });

  describe('chooseFile', () => {
    it('opens a single-file dialog and returns the chosen file', async () => {
      dialogs.chosen = ['/home/ana/a.pdf'];

      expect(await picker().chooseFile({ title: 'Abrir', filters: FILTERS })).toBe('/home/ana/a.pdf');
      expect(dialogs.openDialogs).toEqual([{ title: 'Abrir', filters: FILTERS, properties: ['openFile'] }]);
    });

    it('answers null when the dialog is cancelled', async () => {
      expect(await picker().chooseFile({})).toBeNull();
    });

    it('answers E2E_MOCK_OPEN_FILE by default, without opening a dialog', async () => {
      expect(await picker({ E2E_MOCK_OPEN_FILE: '/tmp/a.json' }).chooseFile({})).toBe('/tmp/a.json');
      expect(dialogs.openDialogs).toEqual([]);
    });

    it('answers only the variable the request names', async () => {
      const env = { E2E_MOCK_OPEN_FILE: '/tmp/a.json', E2E_MOCK_BACKUP_FILE: '/tmp/b.emmabak' };

      expect(await picker(env).chooseFile({ answeredInE2EBy: 'E2E_MOCK_BACKUP_FILE' })).toBe('/tmp/b.emmabak');
      expect(await picker(env).chooseFile({ answeredInE2EBy: 'E2E_MOCK_PROJECT_FILE' })).toBeNull();
    });
  });

  describe('chooseFiles', () => {
    it('opens a multi-selection dialog and returns every chosen file', async () => {
      dialogs.chosen = ['/a.pdf', '/b.pdf'];

      expect(await picker().chooseFiles({ filters: FILTERS })).toEqual(['/a.pdf', '/b.pdf']);
      expect(dialogs.openDialogs[0].properties).toEqual(['openFile', 'multiSelections']);
    });

    it('answers an empty list when the dialog is cancelled', async () => {
      expect(await picker().chooseFiles({})).toEqual([]);
    });

    it('splits E2E_MOCK_OPEN_MULTIPLE_FILES on ";" without opening a dialog', async () => {
      const e2e = picker({ E2E_MOCK_OPEN_MULTIPLE_FILES: '/a.pdf;/b.pdf' });

      expect(await e2e.chooseFiles({})).toEqual(['/a.pdf', '/b.pdf']);
      expect(dialogs.openDialogs).toEqual([]);
    });
  });
});
