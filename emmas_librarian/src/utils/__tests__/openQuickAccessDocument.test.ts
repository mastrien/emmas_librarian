import { describe, it, expect } from 'vitest';
import { openQuickAccessDocument } from '../openQuickAccessDocument';
import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';

describe('openQuickAccessDocument', () => {
  it('records the visit and opens the link outside the app', async () => {
    const service = FakeProjectService.create();
    const doc = { id: 4, project_id: 1, title: 'Edital', url: 'https://exemplo.org', created_at: '2026-01-01' };

    await openQuickAccessDocument(service, doc);

    expect(service.markProjectDocumentOpened).toHaveBeenCalledWith(4);
    expect(service.openProjectDocumentExternal).toHaveBeenCalledWith('https://exemplo.org', undefined);
  });
});
