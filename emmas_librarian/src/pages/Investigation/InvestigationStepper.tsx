import React from 'react';
import { Check } from 'lucide-react';
import {
  canReach,
  NEW_INVESTIGATION_STEPS,
  type DraftCounts,
  type NewInvestigationStep,
} from './newInvestigationSteps';

interface InvestigationStepperProps {
  current: NewInvestigationStep;
  counts: DraftCounts;
  onGo: (step: NewInvestigationStep) => void;
}

/**
 * The four steps of a new investigation as a line (board 159): numbered, the current one in the accent, the ones
 * before it checked. A step opens on click once the steps before it are complete.
 *
 * @example <InvestigationStepper current="articles" counts={{ questions: 2, articles: 9 }} onGo={setStep} />
 */
export const InvestigationStepper: React.FC<InvestigationStepperProps> = ({ current, counts, onGo }) => {
  const currentIndex = NEW_INVESTIGATION_STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="inv-stepper" aria-label="Passos da investigação">
      {NEW_INVESTIGATION_STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'on' : 'next';
        return (
          <li key={step.id} className={`inv-step inv-step--${state}`}>
            <button
              type="button"
              aria-current={state === 'on' ? 'step' : undefined}
              disabled={!canReach(step.id, counts)}
              onClick={() => onGo(step.id)}
            >
              <span className="inv-step__number" aria-hidden="true">
                {state === 'done' ? <Check size={12} /> : index + 1}
              </span>
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
};
