import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useProjectAbout } from '../useProjectAbout';
import { ServicesProvider } from '../../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../../services/__tests__/fakes/FakeProjectService';

let service: FakeProjectService;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ServicesProvider apiService={service}>{children}</ServicesProvider>
);

beforeEach(() => {
  service = FakeProjectService.create();
  service.aboutByProject.set(3, '## Objetivo');
});

afterEach(() => vi.useRealTimers());

describe('useProjectAbout', () => {
  it('loads the stored page, null until it arrives', async () => {
    const { result } = renderHook(() => useProjectAbout(3), { wrapper });

    expect(result.current.markdown).toBeNull();
    await waitFor(() => expect(result.current.markdown).toBe('## Objetivo'));
  });

  it('starts empty when loading fails', async () => {
    service.getProjectAbout.mockRejectedValue(new Error('locked'));

    const { result } = renderHook(() => useProjectAbout(3), { wrapper });

    await waitFor(() => expect(result.current.markdown).toBe(''));
  });

  it('saves only the last text, after a pause in typing', async () => {
    const { result } = renderHook(() => useProjectAbout(3, 100), { wrapper });
    await waitFor(() => expect(result.current.markdown).not.toBeNull());
    vi.useFakeTimers();

    act(() => result.current.onChange('a'));
    act(() => result.current.onChange('ab'));
    await act(async () => vi.advanceTimersByTime(100));

    expect(service.updateProjectAbout).toHaveBeenCalledTimes(1);
    expect(service.updateProjectAbout).toHaveBeenCalledWith(3, 'ab');
    expect(result.current.saveState).toBe('saved');
  });

  it('says when saving failed', async () => {
    service.updateProjectAbout.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useProjectAbout(3, 100), { wrapper });
    await waitFor(() => expect(result.current.markdown).not.toBeNull());
    vi.useFakeTimers();

    act(() => result.current.onChange('texto'));
    await act(async () => vi.advanceTimersByTime(100));

    expect(result.current.saveState).toBe('error');
  });

  it('saves a change still waiting when the page closes', async () => {
    const { result, unmount } = renderHook(() => useProjectAbout(3, 10_000), { wrapper });
    await waitFor(() => expect(result.current.markdown).not.toBeNull());

    act(() => result.current.onChange('última frase'));
    unmount();

    expect(service.updateProjectAbout).toHaveBeenCalledWith(3, 'última frase');
  });

  // The overwrite: the hook stayed mounted when the project changed, and what was waiting for project 3 was saved on
  // the way out under the project that was open by then.
  it('saves a change that was waiting under the project it was written in, even if the project changed since', async () => {
    service.aboutByProject.set(4, 'outro projeto');
    const { result, rerender, unmount } = renderHook(({ id }) => useProjectAbout(id, 10_000), {
      wrapper,
      initialProps: { id: 3 },
    });
    await waitFor(() => expect(result.current.markdown).toBe('## Objetivo'));

    act(() => result.current.onChange('texto do projeto 3'));
    rerender({ id: 4 });
    unmount();

    expect(service.updateProjectAbout).toHaveBeenCalledWith(3, 'texto do projeto 3');
    expect(service.updateProjectAbout).not.toHaveBeenCalledWith(4, 'texto do projeto 3');
  });

  it('does not show the text of one project while it loads another', async () => {
    service.aboutByProject.set(4, 'outro projeto');
    const { result, rerender } = renderHook(({ id }) => useProjectAbout(id, 10_000), {
      wrapper,
      initialProps: { id: 3 },
    });
    await waitFor(() => expect(result.current.markdown).toBe('## Objetivo'));

    rerender({ id: 4 });

    expect(result.current.markdown).not.toBe('## Objetivo');
  });

  it('does not save the text the page already had, or an edit the editor made by itself while loading', async () => {
    const { result } = renderHook(() => useProjectAbout(3, 100), { wrapper });
    await waitFor(() => expect(result.current.markdown).toBe('## Objetivo'));
    vi.useFakeTimers();

    act(() => result.current.onChange('## Objetivo'));
    act(() => result.current.onChange('## Objetivo reescrito', true));
    await act(async () => vi.advanceTimersByTime(500));

    expect(service.updateProjectAbout).not.toHaveBeenCalled();
  });
});
