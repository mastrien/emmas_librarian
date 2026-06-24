import { describe, it, expect, vi } from 'vitest';
import { AppError, ErrorCode, ErrorType } from '../errorHandler';
import { withErrorHandling } from '../errorHandler';

describe('AppError', () => {
  it('should instantiate correctly with code, type and message', () => {
    const err = new AppError('ERR_MISSING_API_KEY', 'USER_ERROR', 'API key is missing');
    expect(err.code).toBe('ERR_MISSING_API_KEY');
    expect(err.type).toBe('USER_ERROR');
    expect(err.message).toBe('API key is missing');
    expect(err.isAppError).toBe(true);
  });

  it('should serialize to JSON correctly', () => {
    const err = new AppError('ERR_MODEL_NOT_DEFINED', 'USER_ERROR', 'Model not found');
    const jsonStr = err.toJSONString();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.isAppError).toBe(true);
    expect(parsed.code).toBe('ERR_MODEL_NOT_DEFINED');
    expect(parsed.type).toBe('USER_ERROR');
    expect(parsed.message).toBe('Model not found');
  });
});

describe('withErrorHandling', () => {
  it('should return the result of a successful handler', async () => {
    const mockHandler = vi.fn().mockResolvedValue('success data');
    const wrapped = withErrorHandling(mockHandler);
    
    // Simulate IPC event invocation
    const result = await wrapped({} as any, 'arg1', 123);
    
    expect(result).toBe('success data');
    expect(mockHandler).toHaveBeenCalledWith({}, 'arg1', 123);
  });

  it('should format AppError into a JSON string and throw an Error with it', async () => {
    const mockHandler = vi.fn().mockRejectedValue(new AppError('ERR_TEST', 'SYSTEM_ERROR', 'Test failed'));
    const wrapped = withErrorHandling(mockHandler);
    
    await expect(wrapped({} as any)).rejects.toThrowError(/^{"isAppError":true,"code":"ERR_TEST","type":"SYSTEM_ERROR","message":"Test failed"}$/);
  });

  it('should format unknown errors into a generic SYSTEM_ERROR', async () => {
    const mockHandler = vi.fn().mockRejectedValue(new Error('Some weird native crash'));
    const wrapped = withErrorHandling(mockHandler);
    
    await expect(wrapped({} as any)).rejects.toThrowError(/^{"isAppError":true,"code":"ERR_INTERNAL","type":"SYSTEM_ERROR","message":"Some weird native crash"/);
  });
});
