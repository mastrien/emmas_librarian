import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { Logger } from './logger';

describe('Logger', () => {
  let consoleInfoSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('info', () => {
    it('logs info with timestamp and action', () => {
      Logger.info('TEST_ACTION');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        JSON.stringify({ level: 'INFO', action: 'TEST_ACTION', timestamp: '2023-01-01T12:00:00.000Z' })
      );
    });

    it('logs info with details when provided', () => {
      Logger.info('TEST_ACTION', { key: 'value' });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        JSON.stringify({ level: 'INFO', action: 'TEST_ACTION', details: { key: 'value' }, timestamp: '2023-01-01T12:00:00.000Z' })
      );
    });
  });

  describe('warn', () => {
    it('logs warn with timestamp and action', () => {
      Logger.warn('TEST_WARN');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        JSON.stringify({ level: 'WARN', action: 'TEST_WARN', timestamp: '2023-01-01T12:00:00.000Z' })
      );
    });

    it('logs warn with details when provided', () => {
      Logger.warn('TEST_WARN', { key: 'warn_value' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        JSON.stringify({ level: 'WARN', action: 'TEST_WARN', details: { key: 'warn_value' }, timestamp: '2023-01-01T12:00:00.000Z' })
      );
    });
  });

  describe('error', () => {
    it('logs error with timestamp and action', () => {
      Logger.error('TEST_ERROR');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ level: 'ERROR', action: 'TEST_ERROR', timestamp: '2023-01-01T12:00:00.000Z' })
      );
    });

    it('logs error with object details', () => {
      Logger.error('TEST_ERROR', { code: 500 });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({ level: 'ERROR', action: 'TEST_ERROR', details: { code: 500 }, timestamp: '2023-01-01T12:00:00.000Z' })
      );
    });

    it('formats Error instances extracting message, stack, and name', () => {
      const err = new Error('Something went wrong');
      err.name = 'CustomError';
      err.stack = 'Error stack trace details';
      
      Logger.error('TEST_ERROR', err);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        JSON.stringify({
          level: 'ERROR',
          action: 'TEST_ERROR',
          details: { message: 'Something went wrong', stack: 'Error stack trace details', name: 'CustomError' },
          timestamp: '2023-01-01T12:00:00.000Z'
        })
      );
    });
  });
});
