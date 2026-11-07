import React, { type ReactNode } from 'react';
import { Layout } from './components/common/Layout';
import { InvestigationRunProvider } from './contexts/InvestigationRunContext';
import { DialogProvider } from './components/common/dialogs/DialogProvider';

/**
 * What stays mounted around every page. The investigation run sits above the Layout on purpose: the Layout draws the
 * PDF reader in another tree, so whatever is below it is mounted again on the way in and out of the reader. With the
 * run below it, leaving for a PDF lost the run's screen while the run went on and saved (validation of epic #44).
 * The confirm/message windows sit above both for the same reason: the reader must be able to ask too.
 *
 * @example <AppShell><Routes>…</Routes></AppShell>
 */
export const AppShell: React.FC<{ children: ReactNode }> = ({ children }) => (
  <DialogProvider>
    <InvestigationRunProvider>
      <Layout>{children}</Layout>
    </InvestigationRunProvider>
  </DialogProvider>
);
