import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactErrorBoundary } from '../common/ErrorBoundary';

function Thrower({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

const writeText = vi.fn();
const reload = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  // React logs caught render errors; silence them so the boundary's own log is the one asserted.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  writeText.mockReset();
  reload.mockReset();
  Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
});

describe('ReactErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ReactErrorBoundary>
        <p>conteúdo</p>
      </ReactErrorBoundary>,
    );

    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('replaces a crashing subtree with the default fallback showing the error', () => {
    render(
      <ReactErrorBoundary>
        <Thrower message="kaboom" />
      </ReactErrorBoundary>,
    );

    expect(screen.getByText('Algo deu errado na interface')).toBeInTheDocument();
    expect(screen.getByText('Error: kaboom')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith(
      'React Error Boundary captured an error:',
      expect.objectContaining({ message: 'kaboom' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('prefers a custom fallback when provided', () => {
    render(
      <ReactErrorBoundary fallback={<span>fallback customizado</span>}>
        <Thrower message="kaboom" />
      </ReactErrorBoundary>,
    );

    expect(screen.getByText('fallback customizado')).toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado na interface')).not.toBeInTheDocument();
  });

  it('reloads the app from the fallback', () => {
    render(
      <ReactErrorBoundary>
        <Thrower message="kaboom" />
      </ReactErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Recarregar Aplicação' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('copies message, stack and component stack to the clipboard', () => {
    render(
      <ReactErrorBoundary>
        <Thrower message="kaboom" />
      </ReactErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copiar Logs' }));

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toMatch(/^Error: kaboom\nStack: Error: kaboom/);
    expect(copied).toMatch(/\nComponent Stack: [\s\S]*Thrower/);
  });
});
