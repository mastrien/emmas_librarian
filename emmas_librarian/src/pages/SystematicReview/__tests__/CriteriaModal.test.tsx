import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CriteriaModal } from '../CriteriaModal';
import { ServicesProvider } from '../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../services/__tests__/fakes/FakeProjectService';

function renderModal() {
  const service = FakeProjectService.create();
  service.getScreeningCriteria.mockResolvedValue({ inclusion: 'previsão', exclusion: 'clima futuro' });
  const onClose = vi.fn();
  render(
    <ServicesProvider apiService={service}>
      <CriteriaModal projectId={3} onClose={onClose} />
    </ServicesProvider>,
  );
  return { service, onClose };
}

describe('CriteriaModal (board 179)', () => {
  it('says what the criteria are for and shows both fields once loaded', async () => {
    renderModal();

    expect(await screen.findByDisplayValue('previsão')).toBeInTheDocument();
    expect(screen.getByDisplayValue('clima futuro')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Critérios do projeto' })).toBeInTheDocument();
    expect(screen.getByText('Guiam a sua triagem e as sugestões da IA')).toBeInTheDocument();
  });

  it('saves and closes with "Concluir"', async () => {
    const { service, onClose } = renderModal();
    const field = await screen.findByDisplayValue('previsão');

    fireEvent.change(field, { target: { value: 'previsão de chuva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(service.saveScreeningCriteria).toHaveBeenLastCalledWith(3, {
      inclusion: 'previsão de chuva',
      exclusion: 'clima futuro',
    });
  });
});
