import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('loads and saves the optional OpenAlex key with the other search keys', async () => {
    fakeService.getSetting.mockImplementation(async (key: string) =>
      key === 'openalex_api_key' ? 'openalex-123' : null,
    );
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );
    const field = await screen.findByLabelText(/OpenAlex API Key/);
    await waitFor(() => expect(field).toHaveValue('openalex-123'));

    fireEvent.change(field, { target: { value: 'openalex-456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Chaves' }));

    await waitFor(() => expect(fakeService.setSetting).toHaveBeenCalledWith('openalex_api_key', 'openalex-456'));
  });

  it('pre-fills a current Claude model when a skill switches to Anthropic', async () => {
    fakeService.getAiModelConfigs.mockResolvedValue([
      { id: 1, skill: 'summary', provider: 'gemini', model_name: 'gemini-2.5-flash', updated_at: '2026-09-26' },
    ]);
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );
    const provider = await screen.findByRole('combobox', { name: 'Provedor: 📝 Geração de Resumos' });

    fireEvent.change(provider, { target: { value: 'anthropic' } });

    expect(screen.getByRole('textbox', { name: 'Modelo: 📝 Geração de Resumos' })).toHaveValue('claude-sonnet-5');
  });
});
