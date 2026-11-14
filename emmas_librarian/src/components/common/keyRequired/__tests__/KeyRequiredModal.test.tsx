import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KeyRequiredModal } from '../KeyRequiredModal';
import { aiKeySettingName } from '../aiKeyProviders';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';

describe('KeyRequiredModal', () => {
  it('shows the reason and wires cancel, the X and the settings button', () => {
    const onCancel = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <ServicesProvider apiService={new FakeProjectService()}>
        <KeyRequiredModal title="Chave X" onCancel={onCancel} onOpenSettings={onOpenSettings}>
          Precisa da chave.
        </KeyRequiredModal>
      </ServicesProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Chave X' })).toBeInTheDocument();
    expect(screen.getByText('Precisa da chave.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Chave do/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancelar'));
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onCancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Configurações'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe('KeyRequiredModal asking for the key right there (board 181)', () => {
  const renderAsking = (service: FakeProjectService, onKeySaved = vi.fn(), onOpenSettings = vi.fn()) => {
    render(
      <ServicesProvider apiService={service}>
        <KeyRequiredModal
          title="Chave de IA Necessária"
          onCancel={vi.fn()}
          onOpenSettings={onOpenSettings}
          onKeySaved={onKeySaved}
        >
          Para resumir.
        </KeyRequiredModal>
      </ServicesProvider>,
    );
    return { onKeySaved, onOpenSettings };
  };

  it('cannot save before a key is typed, and "Usar outro provedor" goes to Settings', () => {
    const { onOpenSettings } = renderAsking(new FakeProjectService());

    expect(screen.getByRole('button', { name: 'Salvar e continuar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar outro provedor' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('saves the trimmed key of the chosen provider and then continues', async () => {
    const service = new FakeProjectService();
    const { onKeySaved } = renderAsking(service);

    fireEvent.click(screen.getByRole('button', { name: 'OpenAI' }));
    fireEvent.change(screen.getByLabelText('Chave do OpenAI'), { target: { value: '  sk-123  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    await waitFor(() => expect(onKeySaved).toHaveBeenCalledTimes(1));
    expect(service.setSetting).toHaveBeenCalledWith(aiKeySettingName('openai'), 'sk-123');
  });

  it('saves with Enter in the field', async () => {
    const service = new FakeProjectService();
    const { onKeySaved } = renderAsking(service);

    fireEvent.change(screen.getByLabelText('Chave do Gemini'), { target: { value: 'AIza-1' } });
    fireEvent.keyDown(screen.getByLabelText('Chave do Gemini'), { key: 'Enter' });

    await waitFor(() => expect(onKeySaved).toHaveBeenCalledTimes(1));
    expect(service.setSetting).toHaveBeenCalledWith('api_key_gemini', 'AIza-1');
  });

  it('stays open and says why when the key could not be saved', async () => {
    const service = new FakeProjectService();
    service.setSetting.mockRejectedValueOnce(new Error('disco cheio'));
    const { onKeySaved } = renderAsking(service);

    fireEvent.change(screen.getByLabelText('Chave do Gemini'), { target: { value: 'AIza-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar a chave: disco cheio');
    expect(onKeySaved).not.toHaveBeenCalled();
  });
});
