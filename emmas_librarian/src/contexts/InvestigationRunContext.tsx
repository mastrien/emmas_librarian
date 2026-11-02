import React, { createContext, useContext, type ReactNode } from 'react';
import { useGlobalError } from './GlobalErrorContext';
import { useInvestigationRun } from '../pages/Investigation/useInvestigationRun';

type InvestigationRunValue = ReturnType<typeof useInvestigationRun>;

const InvestigationRunContext = createContext<InvestigationRunValue | null>(null);

/**
 * Keeps the mass investigation running above the routes (#73). In a modal the run could not be left; on a page of
 * its own, opening a PDF or the settings would otherwise end the screen's view of it.
 *
 * @example <InvestigationRunProvider><Routes>…</Routes></InvestigationRunProvider>
 */
export const InvestigationRunProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showError } = useGlobalError();
  const value = useInvestigationRun(showError);
  return <InvestigationRunContext.Provider value={value}>{children}</InvestigationRunContext.Provider>;
};

/**
 * The running investigation and its controls.
 *
 * @example const { run, start, cancel } = useInvestigationRunContext();
 */
export function useInvestigationRunContext(): InvestigationRunValue {
  const value = useContext(InvestigationRunContext);
  if (!value) throw new Error('useInvestigationRunContext needs an InvestigationRunProvider above it; found none.');
  return value;
}
