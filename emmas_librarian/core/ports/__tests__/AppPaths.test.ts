import path from 'path';
import { describe, it, expect } from 'vitest';
import { appPathsIn } from '../AppPaths';

describe('appPathsIn', () => {
  it('lays the whole library out inside the given folder', () => {
    const root = path.join(path.sep, 'home', 'ana', 'emma');

    expect(appPathsIn(root)).toEqual({
      userData: root,
      dbPath: path.join(root, 'emma.db'),
      backupsDir: path.join(root, 'backups'),
      pdfsDir: path.join(root, 'storage', 'pdfs'),
      documentsDir: path.join(root, 'storage', 'project_documents'),
      modelsDir: path.join(root, 'models'),
    });
  });
});
