import { useCallback, useEffect, useState } from 'react';
import { useProjectService } from '../../../contexts/ServicesContext';
import { useDialogs } from '../../common/dialogs/DialogProvider';
import type { QuestionSet } from '../../../types';

/** What a new set is saved with. */
export interface NewQuestionSet {
  project_id: number | null;
  name: string;
  description: string | null;
  questions: string;
}

/**
 * The question sets of a project (plus the global ones) and what can be done with them. Each failure is told in the
 * app's message window, and the list reloads after every change.
 *
 * @example const sets = useQuestionSets(projectId); await sets.remove(3);
 */
export function useQuestionSets(projectId: number | null) {
  const projectService = useProjectService();
  const { confirm, inform } = useDialogs();
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);

  // No "loading" again on reloads: the list stays while it refreshes, instead of blinking to "Carregando".
  const reload = useCallback(
    () =>
      projectService
        .getQuestionSets(projectId ?? null)
        .then((found) => setSets(found || []))
        .catch((err: unknown) => console.error('Failed to load question sets:', err))
        .finally(() => setLoading(false)),
    [projectService, projectId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Runs a change and reloads; on failure, logs it and tells `message`. Answers whether it worked. */
  const change = async (message: string, action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      console.error(message, err);
      await inform({ title: 'Conjuntos de perguntas', message });
      return false;
    }
  };

  const remove = async (id: number): Promise<void> => {
    const message = 'Tem certeza que deseja excluir este conjunto?';
    if (!(await confirm({ title: 'Excluir conjunto', message, confirmLabel: 'Excluir', danger: true }))) return;
    await change('Erro ao excluir conjunto.', () => projectService.deleteQuestionSet(id));
  };

  return {
    sets,
    loading,
    create: (set: NewQuestionSet) =>
      change('Erro ao criar conjunto de perguntas.', () => projectService.createQuestionSet(set)),
    update: (id: number, fields: { name: string; description: string | null }) =>
      change('Erro ao atualizar conjunto.', () => projectService.updateQuestionSet(id, fields)),
    duplicate: (id: number) =>
      change('Erro ao duplicar conjunto.', () => projectService.duplicateQuestionSet(id, projectId)),
    remove,
  };
}
