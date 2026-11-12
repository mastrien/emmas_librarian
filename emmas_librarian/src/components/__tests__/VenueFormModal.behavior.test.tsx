import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VenueFormModal } from '../modals/VenueFormModal';
import type { ScientificVenue } from '../../types';

let onSave: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;

const renderModal = (props: { initialData?: ScientificVenue | null; initialDate?: string | null } = {}) =>
  render(<VenueFormModal isOpen={true} onClose={onClose} onSave={onSave} {...props} />);

const titleInput = () => screen.getByPlaceholderText('Ex: Simpósio Brasileiro de BD');
const form = () => titleInput().closest('form') as HTMLFormElement;
const milestoneCards = () =>
  screen.getAllByTitle('Remover prazo').map((button) => button.closest('.venue-milestone') as HTMLElement);
const savedVenue = () => onSave.mock.calls[0][0] as Omit<ScientificVenue, 'id' | 'created_at'>;

const venue: ScientificVenue = {
  id: 7,
  title: 'SBBD',
  category: 'journal',
  milestones: [
    {
      label: 'Prazo',
      field_type: 'range',
      target_date: '2026-01-01',
      end_date: null as unknown as string,
      has_time: false,
      status: 'pending',
    },
    {
      label: 'Aviso',
      field_type: 'single',
      target_date: '2026-02-01',
      has_time: true,
      target_time: '14:30',
      status: 'done',
    },
  ],
} as ScientificVenue;

beforeEach(() => {
  onSave = vi.fn();
  onClose = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VenueFormModal initial state', () => {
  it('renders nothing when closed', () => {
    render(<VenueFormModal isOpen={false} onClose={onClose} onSave={onSave} />);

    expect(screen.queryByText('Novo evento')).not.toBeInTheDocument();
  });

  it('defaults the three standard milestones to today without an initial date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-04T12:00:00Z'));
    renderModal();

    const dates = Array.from(document.querySelectorAll('input[type="date"]')).map((i) => (i as HTMLInputElement).value);
    expect(dates).toEqual(['2026-03-04', '2026-03-04', '', '2026-03-04']);
  });

  it('prefills an existing venue, defaulting missing optional fields', () => {
    renderModal({ initialData: venue });

    expect(screen.getByText('Editar evento')).toBeInTheDocument();
    expect(titleInput()).toHaveValue('SBBD');
    expect(screen.getByPlaceholderText('Ex: SBBD 2026')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Periódico / Revista' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByDisplayValue('Prazo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('14:30')).toBeInTheDocument();
  });

  it('names the save button by what it does: "Criar evento" for a new one, "Salvar" when editing (board 180)', () => {
    const { unmount } = renderModal();
    expect(screen.getByRole('button', { name: 'Criar evento' })).toBeInTheDocument();
    expect(screen.getByText('Evento ou revista')).toBeInTheDocument();
    unmount();

    renderModal({ initialData: venue });

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar evento' })).not.toBeInTheDocument();
  });

  it('falls back to the default category and color when the venue has none', () => {
    renderModal({
      initialData: {
        ...venue,
        category: undefined,
        color: undefined,
        milestones: undefined,
      } as unknown as ScientificVenue,
    });
    fireEvent.submit(form());

    expect(screen.getByRole('button', { name: 'Congresso / Conferência' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Adicione e preencha pelo menos um prazo válido para o evento.')).toBeInTheDocument();
  });
});

describe('VenueFormModal closing', () => {
  // The shared Modal (Arca 134): the X, Esc and Cancelar close it; a click inside, or on the backdrop, does not.
  it('closes from the X, Esc and the footer, not from a click on the window', () => {
    renderModal();

    fireEvent.click(screen.getByText('Novo evento'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' }).at(-1)!);

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('VenueFormModal milestones', () => {
  it('removes a milestone', () => {
    renderModal({ initialDate: '2026-05-05' });

    fireEvent.click(screen.getAllByTitle('Remover prazo')[1]);

    expect(screen.queryByDisplayValue('Submissão')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('Remover prazo')).toHaveLength(2);
  });

  it('requires a name for a custom field', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Prazo$/ }));

    fireEvent.click(screen.getByText('Confirmar Campo'));

    expect(screen.getByText('Informe o nome do novo prazo.')).toBeInTheDocument();
    expect(screen.getAllByTitle('Remover prazo')).toHaveLength(3);
  });

  it('hides the custom field form on cancel', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /^Prazo$/ }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0]);

    expect(screen.queryByText('Novo Campo Personalizado')).not.toBeInTheDocument();
  });

  it('starts a custom range with both dates on the initial date', () => {
    renderModal({ initialDate: '2026-05-05' });
    fireEvent.click(screen.getByRole('button', { name: /^Prazo$/ }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Avaliação de Pares/), { target: { value: '  Revisão  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Intervalo' }));

    fireEvent.click(screen.getByText('Confirmar Campo'));

    const card = milestoneCards().at(-1)!;
    expect(within(card).getByDisplayValue('Revisão')).toBeInTheDocument();
    expect(within(card).getAllByDisplayValue('2026-05-05')).toHaveLength(2);
    expect(within(card).getByLabelText('Até')).toBeInTheDocument();
  });

  it('shows a time input only while "Incluir horário" is checked', () => {
    renderModal({ initialDate: '2026-05-05' });
    const card = milestoneCards()[0];

    fireEvent.click(within(card).getByRole('checkbox'));
    fireEvent.change(card.querySelector('input[type="time"]')!, { target: { value: '09:15' } });

    expect(within(card).getByDisplayValue('09:15')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('checkbox'));
    expect(card.querySelector('input[type="time"]')).toBeNull();
  });
});

describe('VenueFormModal submit', () => {
  it('requires a title', () => {
    renderModal();
    fireEvent.change(titleInput(), { target: { value: '   ' } });

    fireEvent.submit(form());

    expect(screen.getByText('O título do evento/periódico é obrigatório.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('drops milestones without a label or date and requires at least one', () => {
    renderModal({ initialDate: '2026-05-05' });
    fireEvent.change(titleInput(), { target: { value: 'T' } });
    milestoneCards().forEach((card) =>
      fireEvent.change(within(card).getByDisplayValue(/Inscrição|Submissão|Apresentação/), { target: { value: ' ' } }),
    );

    fireEvent.submit(form());

    expect(screen.getByText('Adicione e preencha pelo menos um prazo válido para o evento.')).toBeInTheDocument();
  });

  it('saves the trimmed venue with normalized milestones and closes', () => {
    renderModal({ initialData: venue });
    fireEvent.change(titleInput(), { target: { value: ' SBBD 2 ' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: SBBD 2026'), { target: { value: ' S2 ' } });
    fireEvent.change(screen.getByPlaceholderText('https://...'), { target: { value: ' http://x ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Workshop' }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Cor / })[3]);

    fireEvent.submit(form());

    expect(savedVenue()).toEqual({
      title: 'SBBD 2',
      acronym: 'S2',
      category: 'workshop',
      url: 'http://x',
      color: '#ef4444',
      milestones: [
        expect.objectContaining({ label: 'Prazo', end_date: undefined, has_time: false, target_time: undefined }),
        expect.objectContaining({ label: 'Aviso', end_date: undefined, has_time: true, target_time: '14:30' }),
      ],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a valid range end date and drops the time of untimed single milestones', () => {
    renderModal({ initialDate: '2026-05-05' });
    fireEvent.change(titleInput(), { target: { value: 'T' } });
    fireEvent.change(milestoneCards()[1].querySelectorAll('input[type="date"]')[1], {
      target: { value: '2026-05-09' },
    });

    fireEvent.submit(form());

    const [inscricao, submissao] = savedVenue().milestones!;
    expect(submissao).toMatchObject({ end_date: '2026-05-09', has_time: false });
    expect(inscricao).toMatchObject({ end_date: undefined, target_time: undefined, has_time: false });
    expect(savedVenue()).toMatchObject({
      acronym: undefined,
      url: undefined,
      color: '#3b82f6',
      category: 'conference',
    });
  });
});
