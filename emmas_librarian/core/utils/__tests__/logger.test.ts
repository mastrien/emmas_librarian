import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should format info logs correctly', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    Logger.info('user_login', { userId: 123 });
    expect(infoSpy).toHaveBeenCalled();
    const logged = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(logged.level).toBe('INFO');
    expect(logged.action).toBe('user_login');
    expect(logged.details.userId).toBe(123);
  });

  it('should format warn logs correctly', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Logger.warn('disk_full', '90% usage');
    expect(warnSpy).toHaveBeenCalled();
    const logged = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(logged.level).toBe('WARN');
    expect(logged.action).toBe('disk_full');
    expect(logged.details).toBe('90% usage');
  });

  it('should format error logs correctly with Error instances', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Test DB Error');
    Logger.error('db_failure', err);
    expect(errorSpy).toHaveBeenCalled();
    const logged = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logged.level).toBe('ERROR');
    expect(logged.action).toBe('db_failure');
    expect(logged.details.message).toBe('Test DB Error');
  });

  it('should format error logs correctly with non-Error objects', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Logger.error('custom_error', { code: 500 });
    expect(errorSpy).toHaveBeenCalled();
    const logged = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logged.level).toBe('ERROR');
    expect(logged.action).toBe('custom_error');
    expect(logged.details.code).toBe(500);
  });
});
