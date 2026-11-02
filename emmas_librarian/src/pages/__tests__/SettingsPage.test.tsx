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

  it('saves the optional OpenAlex key on its own once typing pauses', async () => {
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

    await waitFor(() => expect(fakeService.setSetting).toHaveBeenCalledWith('openalex_api_key', 'openalex-456'));
  });

  it('saves the IEEE Xplore key on its own, with no save button to press', async () => {
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );

    fireEvent.change(await screen.findByLabelText('IEEE Xplore API Key (experimental)'), {
      target: { value: 'ieee-789' },
    });
    expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull();

    await waitFor(() => expect(fakeService.setSetting).toHaveBeenCalledWith('ieee_api_key', 'ieee-789'));
  });

  it('warns next to the IEEE Xplore key that the integration is experimental', async () => {
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText(/IEEE Xplore está em fase experimental/)).toBeInTheDocument();
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

  // Validation of epic #44: a provider picked but not saved left a whole investigation failing.
  it('saves a provider choice at once, with the suggested model, and says it was saved', async () => {
    fakeService.getAiModelConfigs.mockResolvedValue([
      { id: 1, skill: 'extraction', provider: 'gemini', model_name: 'gemini-2.5-flash', updated_at: '2026-09-26' },
    ]);
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );
    const provider = await screen.findByRole('combobox', { name: /Provedor: .*Investigação Massiva/ });

    fireEvent.change(provider, { target: { value: 'anthropic' } });

    await waitFor(() =>
      expect(fakeService.updateAiModelConfig).toHaveBeenCalledWith('extraction', 'anthropic', 'claude-sonnet-5'),
    );
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
  });

  it('saves what was still waiting when the person leaves the page', async () => {
    const { unmount } = render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );
    fireEvent.change(await screen.findByLabelText('IEEE Xplore API Key (experimental)'), {
      target: { value: 'ieee-saída' },
    });

    unmount();

    expect(fakeService.setSetting).toHaveBeenCalledWith('ieee_api_key', 'ieee-saída');
  });

  it('says when a change could not be saved', async () => {
    fakeService.setSetting.mockRejectedValue(new Error('disco cheio'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>,
    );

    fireEvent.change(await screen.findByLabelText('IEEE Xplore API Key (experimental)'), { target: { value: 'x' } });

    expect(await screen.findByText(/Não foi possível salvar uma alteração/)).toBeInTheDocument();
  });
});
