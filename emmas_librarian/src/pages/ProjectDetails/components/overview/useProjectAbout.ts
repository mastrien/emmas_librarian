import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectService } from '../../../../contexts/ServicesContext';

export type AboutSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ProjectAbout {
  /** Null while loading, so the editor starts only with the stored text. */
  markdown: string | null;
  saveState: AboutSaveState;
  onChange: (markdown: string) => void;
}

/** Waits for a pause in typing before saving, like the diary. */
export const ABOUT_AUTOSAVE_DELAY_MS = 1500;

function useAboutLoad(projectId: number): string | null {
  const projectService = useProjectService();
  const [markdown, setMarkdown] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    projectService
      .getProjectAbout(projectId)
      .catch(() => '')
      .then((text) => current && setMarkdown(text));
    return () => {
      current = false;
    };
  }, [projectService, projectId]);
  return markdown;
}

/**
 * Calls `save` with the last text after `delayMs` without changes, and at once on unmount if one is waiting.
 *
 * @example const schedule = useDebouncedSave((text) => api.save(text), 1500); schedule('novo texto');
 */
function useDebouncedSave(save: (text: string) => void, flush: (text: string) => void, delayMs: number) {
  const pending = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  useEffect(
    () => () => {
      if (!pending.current) return;
      clearTimeout(pending.current.timer);
      flushRef.current(pending.current.text);
    },
    [],
  );

  return (text: string) => {
    if (pending.current) clearTimeout(pending.current.timer);
    const timer = setTimeout(() => {
      pending.current = null;
      save(text);
    }, delayMs);
    pending.current = { text, timer };
  };
}

/**
 * The project's "Sobre o projeto" page (board 154): loaded once, saved after each pause in typing, and saved on
 * the way out if a change is still waiting.
 *
 * @example const about = useProjectAbout(3); <Editor markdown={about.markdown} onChange={about.onChange} />
 */
export function useProjectAbout(projectId: number, delayMs = ABOUT_AUTOSAVE_DELAY_MS): ProjectAbout {
  const projectService = useProjectService();
  const markdown = useAboutLoad(projectId);
  const [saveState, setSaveState] = useState<AboutSaveState>('idle');
  const save = useCallback(
    (text: string) => {
      setSaveState('saving');
      projectService
        .updateProjectAbout(projectId, text)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [projectService, projectId],
  );
  const flush = (text: string) => void projectService.updateProjectAbout(projectId, text).catch(console.error);
  const onChange = useDebouncedSave(save, flush, delayMs);
  return { markdown, saveState, onChange };
}
