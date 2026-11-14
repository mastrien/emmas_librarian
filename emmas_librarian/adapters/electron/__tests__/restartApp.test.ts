import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({ app: { relaunch: vi.fn(), exit: vi.fn() } }));

import { app } from 'electron';
import { restartApp } from '../restartApp';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('restartApp', () => {
  it('relaunches and exits', () => {
    restartApp({});

    expect(app.relaunch).toHaveBeenCalledTimes(1);
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  it('only exits under E2E, leaving the relaunch to the test harness', () => {
    restartApp({ E2E_SKIP_RELAUNCH: 'true' });

    expect(app.relaunch).not.toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });
});
