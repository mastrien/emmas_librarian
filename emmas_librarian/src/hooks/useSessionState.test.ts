import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSessionState } from './useSessionState';

describe('useSessionState', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('starts from the initial value when nothing was stored', () => {
    const { result } = renderHook(() => useSessionState('view.status', 'new'));

    expect(result.current[0]).toBe('new');
  });

  it('keeps the value after the component unmounts and mounts again', () => {
    const first = renderHook(() => useSessionState('view.status', 'new'));
    act(() => first.result.current[1]('archived'));
    first.unmount();

    const second = renderHook(() => useSessionState('view.status', 'new'));

    expect(second.result.current[0]).toBe('archived');
  });

  it('applies functional updates to the latest value', () => {
    const { result } = renderHook(() => useSessionState<string[]>('view.dbs', []));

    act(() => result.current[1]((prev) => [...prev, 'Scopus']));
    act(() => result.current[1]((prev) => [...prev, 'OpenAlex']));

    expect(result.current[0]).toEqual(['Scopus', 'OpenAlex']);
  });

  it('reads the value of the new key when the key changes', () => {
    window.sessionStorage.setItem('project.2.status', JSON.stringify('read'));
    const { result, rerender } = renderHook(({ key }) => useSessionState(key, 'new'), {
      initialProps: { key: 'project.1.status' },
    });

    rerender({ key: 'project.2.status' });

    expect(result.current[0]).toBe('read');
  });

  it('falls back to the initial value when the stored text is not JSON', () => {
    window.sessionStorage.setItem('view.status', '{broken');

    const { result } = renderHook(() => useSessionState('view.status', 'new'));

    expect(result.current[0]).toBe('new');
  });
});
