import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FrontendAppError } from '../utils/AppError';

interface GlobalErrorContextType {
  showError: (error: Error | FrontendAppError | unknown) => void;
  hideError: () => void;
  currentError: FrontendAppError | Error | null;
}

const GlobalErrorContext = createContext<GlobalErrorContextType | undefined>(undefined);

export const useGlobalError = () => {
  const context = useContext(GlobalErrorContext);
  if (!context) {
    throw new Error('useGlobalError must be used within a GlobalErrorProvider');
  }
  return context;
};

export const GlobalErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentError, setCurrentError] = useState<FrontendAppError | Error | null>(null);

  const showError = useCallback((error: Error | FrontendAppError | unknown) => {
    if (error instanceof Error || error instanceof FrontendAppError) {
      setCurrentError(error);
    } else {
      setCurrentError(new Error(String(error)));
    }
  }, []);

  const hideError = useCallback(() => {
    setCurrentError(null);
  }, []);

  return (
    <GlobalErrorContext.Provider value={{ showError, hideError, currentError }}>{children}</GlobalErrorContext.Provider>
  );
};
