import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectService } from '../../../../contexts/ServicesContext';

export type AboutSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ProjectAbout {
  /** Null while loading, so the editor starts only with the stored text. */
  markdown: string | null;
  saveState: AboutSaveState;
  /** `normalizing` is true when the editor rewrote what it loaded: that is not an edit and is not saved. */
  onChange: (markdown: string, normalizing?: boolean) => void;
}

/** Waits for a pause in typing before saving, like the diary. */
export const ABOUT_AUTOSAVE_DELAY_MS = 1500;

// The text comes with the project it belongs to, and only the open project's text is handed out: while another project
// loads there is no text, instead of the previous project's (which an editor would open on and then save under the new one).
function useAboutLoad(projectId: number): string | null {
  const projectService = useProjectService();
  const [loaded, setLoaded] = useState<{ projectId: number; markdown: string } | null>(null);
  useEffect(() => {
    let current = true;
    projectService
      .getProjectAbout(projectId)
      .catch(() => '')
      .then((text) => current && setLoaded({ projectId, markdown: text }));
    return () => {
      current = false;
    };
  }, [projectService, projectId]);
  return loaded?.projectId === projectId ? loaded.markdown : null;
}

/**
 * Calls `save` with the last text after `delayMs` without changes, and at once on unmount if one is waiting. The way to
 * save a waiting text is taken when it is written, so it goes to the project it was written in even if the project
 * changed by the time it is saved. `cancel` forgets what is waiting.
 *
 * @example const { schedule } = useDebouncedSave(save, flush, 1500); schedule('novo texto');
 */
function useDebouncedSave(save: (text: string) => void, flush: (text: string) => void, delayMs: number) {
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; flushNow: () => void } | null>(null);

  const cancel = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };

  useEffect(
    () => () => {
      if (!pending.current) return;
      clearTimeout(pending.current.timer);
      pending.current.flushNow();
    },
    [],
  );

  const schedule = (text: string) => {
    cancel();
    const timer = setTimeout(() => {
      pending.current = null;
      save(text);
    }, delayMs);
    pending.current = { timer, flushNow: () => flush(text) };
  };
  return { schedule, cancel };
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
  // What the database holds, as far as this page knows: the text it opened with, then each text saved.
  const known = useRef<string | null>(null);
  useEffect(() => {
    known.current = markdown;
  }, [markdown]);
  const save = useCallback(
    (text: string) => {
      setSaveState('saving');
      projectService
        .updateProjectAbout(projectId, text)
        .then(() => {
          known.current = text;
          setSaveState('saved');
        })
        .catch(() => setSaveState('error'));
    },
    [projectService, projectId],
  );
  const flush = (text: string) => void projectService.updateProjectAbout(projectId, text).catch(console.error);
  const { schedule, cancel } = useDebouncedSave(save, flush, delayMs);
  const onChange = (text: string, normalizing = false) => {
    if (normalizing) return;
    if (text === known.current) return cancel();
    schedule(text);
  };
  return { markdown, saveState, onChange };
}
