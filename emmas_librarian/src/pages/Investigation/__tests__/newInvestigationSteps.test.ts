import { describe, expect, it } from 'vitest';
import { canReach, nextStep, previousStep, stepBlocker, stepLabel } from '../newInvestigationSteps';

const ready = { questions: 2, articles: 9 };

describe('newInvestigationSteps', () => {
  it('blocks the questions without one and the articles without one', () => {
    expect(stepBlocker('questions', { questions: 0, articles: 9 })).toBe('Escreva pelo menos uma pergunta.');
    expect(stepBlocker('articles', { questions: 2, articles: 0 })).toBe('Escolha pelo menos um artigo.');
    expect(stepBlocker('model', { questions: 0, articles: 0 })).toBeNull();
  });

  it('opens a step only when every step before it is complete', () => {
    expect(canReach('questions', { questions: 0, articles: 0 })).toBe(true);
    expect(canReach('articles', { questions: 0, articles: 9 })).toBe(false);
    expect(canReach('run', { questions: 2, articles: 0 })).toBe(false);
    expect(canReach('run', ready)).toBe(true);
  });

  it('walks the steps in order, with nothing past the ends', () => {
    expect(nextStep('questions')).toBe('articles');
    expect(nextStep('run')).toBeNull();
    expect(previousStep('model')).toBe('articles');
    expect(previousStep('questions')).toBeNull();
  });

  it('names each step as the stepper shows it', () => {
    expect(stepLabel('model')).toBe('Modelo e custo');
  });
});
