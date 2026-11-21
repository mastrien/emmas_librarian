import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_APPEARANCE } from '../../../src/theme/appearance';
import { applyLook, saveLook, type Appearance } from '../theme';

interface LookValue {
  look: Appearance;
  setLook: (look: Appearance) => void;
}

const LookContext = createContext<LookValue>({ look: DEFAULT_APPEARANCE, setLook: () => undefined });

export const useLook = (): LookValue => useContext(LookContext);

interface LookProviderProps {
  initial: Appearance;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  root: HTMLElement;
  children: React.ReactNode;
}

/**
 * Holds the phone's look and keeps the page and the storage in step with it.
 *
 * @example <LookProvider initial={loadLook(localStorage, dark)} storage={localStorage} root={document.documentElement}>
 */
export const LookProvider: React.FC<LookProviderProps> = ({ initial, storage, root, children }) => {
  const [look, setLookState] = useState(initial);
  useEffect(() => applyLook(root, look), [root, look]);
  const setLook = (next: Appearance) => {
    try {
      saveLook(storage, next);
    } catch {
      // A browser that blocks storage keeps the choice until the app closes.
    }
    setLookState(next);
  };
  return <LookContext.Provider value={{ look, setLook }}>{children}</LookContext.Provider>;
};
