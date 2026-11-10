import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DashboardClock, dateLine } from '../DashboardClock';

beforeEach(() => {
  vi.useFakeTimers();
  // Local time so the expectations do not depend on the machine's time zone.
  vi.setSystemTime(new Date(2026, 8, 24, 10, 0, 30));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DashboardClock', () => {
  it('shows the current time and date in pt-BR', () => {
    render(<DashboardClock />);

    expect(screen.getByTestId('dashboard-clock')).toHaveTextContent('Quinta-feira, 24 de setembro · 10:00');
  });

  it('ticks forward as time passes', () => {
    render(<DashboardClock />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId('dashboard-clock')).toHaveTextContent('· 10:01');
  });

  it('stops ticking after unmount', () => {
    const { unmount } = render(<DashboardClock />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('dateLine', () => {
  it('capitalises the weekday and writes the month in full (board 151)', () => {
    expect(dateLine(new Date(2026, 10, 8, 22, 14))).toBe('Domingo, 8 de novembro · 22:14');
  });
});
