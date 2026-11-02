import { fireEvent, render, renderHook, act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SideDrawer } from '../SideDrawer';
import { NARROW_WINDOW_PX, useNarrowWindow } from '../../../hooks/useNarrowWindow';

describe('SideDrawer', () => {
  const open = (onClose = vi.fn()) => {
    render(
      <SideDrawer side="right" label="Resposta" onClose={onClose}>
        conteúdo
      </SideDrawer>,
    );
    return onClose;
  };

  it('is a labelled dialog on its side, outside the page that opened it', () => {
    const { container } = render(
      <SideDrawer side="left" label="Lista" onClose={vi.fn()}>
        conteúdo
      </SideDrawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Lista' })).toHaveClass('side-drawer--left');
    expect(container).toBeEmptyDOMElement();
  });

  it('closes on its X', () => {
    const onClose = open();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes clicking outside', () => {
    const onClose = open();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar: Resposta' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Esc, and stops listening once gone', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <SideDrawer side="right" label="Resposta" onClose={onClose}>
        conteúdo
      </SideDrawer>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useNarrowWindow', () => {
  const setWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
    window.dispatchEvent(new Event('resize'));
  };
  afterEach(() => setWidth(1024));

  it('follows the window across the limit', () => {
    setWidth(NARROW_WINDOW_PX);
    const { result } = renderHook(() => useNarrowWindow());
    expect(result.current).toBe(true);

    act(() => setWidth(NARROW_WINDOW_PX + 1));
    expect(result.current).toBe(false);
  });
});
