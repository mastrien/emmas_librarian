import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';

vi.mock('../../services/api', () => ({
  projectService: {
    getSetting: vi.fn().mockResolvedValue('value'),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getTrashItems: vi.fn().mockResolvedValue([]),
    restoreTrashItem: vi.fn().mockResolvedValue(undefined),
    deleteTrashItemPermanent: vi.fn().mockResolvedValue(undefined),
    emptyTrash: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('SettingsPage', () => {
  it('renders correctly', async () => {
    const { container } = render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
