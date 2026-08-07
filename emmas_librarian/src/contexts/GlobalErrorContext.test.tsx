import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { GlobalErrorProvider, useGlobalError } from './GlobalErrorContext';
import { FrontendAppError } from '../utils/AppError';

describe('GlobalErrorContext', () => {
  it('throws an error if useGlobalError is used outside of GlobalErrorProvider', () => {
    // Suppress console.error for this expected error in React rendering
    const consoleError = console.error;
    console.error = () => {};
    expect(() => renderHook(() => useGlobalError())).toThrowError('useGlobalError must be used within a GlobalErrorProvider');
    console.error = consoleError;
  });

  it('provides default values and updates error state correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GlobalErrorProvider>{children}</GlobalErrorProvider>
    );

    const { result } = renderHook(() => useGlobalError(), { wrapper });

    expect(result.current.currentError).toBeNull();

    // Test showError with standard Error
    act(() => {
      result.current.showError(new Error('Standard Error'));
    });
    expect(result.current.currentError).toBeInstanceOf(Error);
    expect(result.current.currentError?.message).toBe('Standard Error');

    // Test showError with FrontendAppError
    const frontendError = new FrontendAppError('ERR_INTERNAL', 'SYSTEM_ERROR', 'Frontend Error');
    act(() => {
      result.current.showError(frontendError);
    });
    expect(result.current.currentError).toBeInstanceOf(FrontendAppError);
    expect(result.current.currentError?.message).toBe('Frontend Error');

    // Test showError with unknown/string error
    act(() => {
      result.current.showError('Unknown String Error');
    });
    expect(result.current.currentError).toBeInstanceOf(Error);
    expect(result.current.currentError?.message).toBe('Unknown String Error');

    // Test hideError
    act(() => {
      result.current.hideError();
    });
    expect(result.current.currentError).toBeNull();
  });
});
