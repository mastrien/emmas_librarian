import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { UpdateNotificationBanner } from '../UpdateNotificationBanner';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('UpdateNotificationBanner Component', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockNavigate.mockReset();
  });

  it('renders nothing when updateInfo is null', () => {
    const { container } = render(
      <MemoryRouter>
        <UpdateNotificationBanner updateInfo={null} onDownload={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders update banner with version and buttons', () => {
    render(
      <MemoryRouter>
        <UpdateNotificationBanner updateInfo={{ version: '1.3.0', releaseNotes: 'Changelog' }} onDownload={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Nova versão/)).toBeInTheDocument();
    expect(screen.getByText('v1.3.0')).toBeInTheDocument();
    expect(screen.getByText('Atualizar')).toBeInTheDocument();
    expect(screen.getByText('Ver Notas')).toBeInTheDocument();
  });

  it('triggers onDownload and navigates to settings on clicking Atualizar', async () => {
    const onDownload = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <UpdateNotificationBanner updateInfo={{ version: '1.3.0' }} onDownload={onDownload} />
      </MemoryRouter>,
    );

    const updateBtn = screen.getByText('Atualizar');
    fireEvent.click(updateBtn);

    expect(onDownload).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('dismisses banner and sets sessionStorage when clicking close button', () => {
    render(
      <MemoryRouter>
        <UpdateNotificationBanner updateInfo={{ version: '1.3.0' }} onDownload={vi.fn()} />
      </MemoryRouter>,
    );

    const closeBtn = screen.getByTitle('Lembrar mais tarde');
    fireEvent.click(closeBtn);

    expect(sessionStorage.getItem('dismissed_update_1.3.0')).toBe('true');
    expect(screen.queryByText(/Nova versão/)).toBeNull();
  });

  it('does not render if already dismissed in sessionStorage', () => {
    sessionStorage.setItem('dismissed_update_1.3.0', 'true');

    const { container } = render(
      <MemoryRouter>
        <UpdateNotificationBanner updateInfo={{ version: '1.3.0' }} onDownload={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.firstChild).toBeNull();
  });
});
