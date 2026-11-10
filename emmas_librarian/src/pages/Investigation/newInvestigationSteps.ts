// The new investigation in steps (board 159): what is asked, of which articles, by which model at what size, then
// the last look before it runs. A step is reachable once every step before it has what it needs.

export type NewInvestigationStep = 'questions' | 'articles' | 'model' | 'run';

export const NEW_INVESTIGATION_STEPS: readonly { id: NewInvestigationStep; label: string }[] = [
  { id: 'questions', label: 'Perguntas' },
  { id: 'articles', label: 'Artigos' },
  { id: 'model', label: 'Modelo e custo' },
  { id: 'run', label: 'Executar' },
];

/** What the steps check: the filled questions and the chosen articles. */
export interface DraftCounts {
  questions: number;
  articles: number;
}

/**
 * Why this step cannot be left forward, or null when it can.
 *
 * @example stepBlocker('questions', { questions: 0, articles: 3 }) // 'Escreva pelo menos uma pergunta.'
 */
export function stepBlocker(step: NewInvestigationStep, counts: DraftCounts): string | null {
  if (step === 'questions' && counts.questions === 0) return 'Escreva pelo menos uma pergunta.';
  if (step === 'articles' && counts.articles === 0) return 'Escolha pelo menos um artigo.';
  return null;
}

/**
 * Whether a step can be opened: every step before it must be complete.
 *
 * @example canReach('run', { questions: 2, articles: 0 }) // false
 */
export function canReach(step: NewInvestigationStep, counts: DraftCounts): boolean {
  const index = NEW_INVESTIGATION_STEPS.findIndex((s) => s.id === step);
  return NEW_INVESTIGATION_STEPS.slice(0, index).every((s) => stepBlocker(s.id, counts) === null);
}

/**
 * The step after this one, or null on the last.
 *
 * @example nextStep('articles') // 'model'
 */
export function nextStep(step: NewInvestigationStep): NewInvestigationStep | null {
  const index = NEW_INVESTIGATION_STEPS.findIndex((s) => s.id === step);
  return NEW_INVESTIGATION_STEPS[index + 1]?.id ?? null;
}

/**
 * The step before this one, or null on the first.
 *
 * @example previousStep('articles') // 'questions'
 */
export function previousStep(step: NewInvestigationStep): NewInvestigationStep | null {
  const index = NEW_INVESTIGATION_STEPS.findIndex((s) => s.id === step);
  return index > 0 ? NEW_INVESTIGATION_STEPS[index - 1].id : null;
}

/**
 * The label of a step, as the stepper shows it.
 *
 * @example stepLabel('model') // 'Modelo e custo'
 */
export function stepLabel(step: NewInvestigationStep): string {
  return NEW_INVESTIGATION_STEPS.find((s) => s.id === step)?.label ?? step;
}
