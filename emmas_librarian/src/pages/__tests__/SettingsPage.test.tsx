import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
  });

  it('loads saved settings and the app version into the page', async () => {
    fakeService.getSetting.mockImplementation(async (key: string) => (key === 'scopus_api_key' ? 'scopus-123' : null));
    fakeService.getAppVersion.mockResolvedValue('1.2.3');

    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(await screen.findByText("Emma's Librarian v1.2.3")).toBeInTheDocument();
    expect(screen.getByDisplayValue('scopus-123')).toBeInTheDocument();
  });
});
