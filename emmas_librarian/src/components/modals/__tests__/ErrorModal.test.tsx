import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ErrorModal } from '../ErrorModal';
import { useGlobalError } from '../../../contexts/GlobalErrorContext';
import { FrontendAppError } from '../../../utils/AppError';

// Mock the context hook
vi.mock('../../../contexts/GlobalErrorContext', () => ({
  useGlobalError: vi.fn(),
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe('ErrorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no current error', () => {
    (useGlobalError as any).mockReturnValue({
      currentError: null,
      hideError: vi.fn(),
    });
    const { container } = render(<ErrorModal />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a FrontendAppError with correct translation and icon', () => {
    const hideError = vi.fn();
    const appError = new FrontendAppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'Mensagem de teste', { foo: 'bar' });

    (useGlobalError as any).mockReturnValue({
      currentError: appError,
      hideError,
    });

    render(<ErrorModal />);
    
    // Check if translation title is rendered
    expect(screen.getByText('Chave de API Ausente')).toBeInTheDocument();
    // Check if translation message is rendered
    expect(screen.getByText(/Você precisa configurar uma chave de API/i)).toBeInTheDocument();
  });

  it('renders fallback for unknown error code', () => {
    const appError = new FrontendAppError('UNKNOWN_CODE' as any, 'SYSTEM_ERROR', 'Mensagem desconhecida');

    (useGlobalError as any).mockReturnValue({
      currentError: appError,
      hideError: vi.fn(),
    });

    render(<ErrorModal />);
    
    // Fallback translation
    expect(screen.getByText('Falha no Sistema')).toBeInTheDocument();
    expect(screen.getByText(/Ocorreu um problema inesperado no Emma's Librarian/i)).toBeInTheDocument();
  });

  it('renders a generic Error (not FrontendAppError)', () => {
    const genericError = new Error('Generic JS Error');

    (useGlobalError as any).mockReturnValue({
      currentError: genericError,
      hideError: vi.fn(),
    });

    render(<ErrorModal />);
    
    expect(screen.getByText('Falha no Sistema')).toBeInTheDocument();
  });

  it('toggles technical details and copies to clipboard', async () => {
    const appError = new FrontendAppError('ERR_INTERNAL', 'SYSTEM_ERROR', 'Mensagem de teste', { extraInfo: 123 });
    // fake stack for deterministic test
    appError.stack = 'Error at mock stack';

    (useGlobalError as any).mockReturnValue({
      currentError: appError,
      hideError: vi.fn(),
    });

    render(<ErrorModal />);
    
    // Details are initially hidden
    expect(screen.queryByText('Detalhes Técnicos:')).not.toBeInTheDocument();

    // Click to show details
    fireEvent.click(screen.getByText('Ver detalhes técnicos'));
    expect(screen.getByText('Detalhes Técnicos:')).toBeInTheDocument();
    expect(screen.getByText(/\[Code\]: ERR_INTERNAL/i)).toBeInTheDocument();
    expect(screen.getByText(/\[Message\]: Mensagem de teste/i)).toBeInTheDocument();
    expect(screen.getByText(/extraInfo/i)).toBeInTheDocument();

    // Mock setTimeout for clipboard copy logic
    vi.useFakeTimers();

    // Click copy
    fireEvent.click(screen.getByText('Copiar Logs'));
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `Type: SYSTEM_ERROR\nCode: ERR_INTERNAL\nMessage: Mensagem de teste\nStack: Error at mock stack`
    );

    expect(screen.getByText('Copiado')).toBeInTheDocument();

    // Wait for the timeout that resets copied state
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Copiar Logs')).toBeInTheDocument();
    expect(screen.queryByText('Copiado')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('calls hideError when close buttons are clicked', () => {
    const hideError = vi.fn();
    (useGlobalError as any).mockReturnValue({
      currentError: new Error('test'),
      hideError,
    });

    render(<ErrorModal />);
    
    // Click 'Entendi' button
    fireEvent.click(screen.getByText('Entendi'));
    expect(hideError).toHaveBeenCalledTimes(1);
    
    // Click X icon button
    const xButton = screen.getAllByRole('button')[0]; // first button is the X close button
    fireEvent.click(xButton);
    expect(hideError).toHaveBeenCalledTimes(2);
  });
});
