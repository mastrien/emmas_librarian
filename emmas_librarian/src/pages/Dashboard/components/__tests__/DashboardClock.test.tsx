import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DashboardClock } from '../DashboardClock';

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

    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText(/24 set 2026/)).toBeInTheDocument();
  });

  it('ticks forward as time passes', () => {
    render(<DashboardClock />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('10:01')).toBeInTheDocument();
  });

  it('stops ticking after unmount', () => {
    const { unmount } = render(<DashboardClock />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
