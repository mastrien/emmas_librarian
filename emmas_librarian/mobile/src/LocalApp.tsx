import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { LocalWorkspace } from './local/LocalWorkspace';
import { SessionProvider } from './session/SessionContext';
import { libraryRoutes } from './libraryRoutes';
import { SettingsScreen } from './screens/SettingsScreen';

/**
 * The app on the phone with its own library: the same screens as the other modes, plus Ajustes. There is no
 * "leave" here; unpairing is in Ajustes, and it asks first.
 *
 * @example <LocalApp workspace={workspace} onScan={scanQrCode} />
 */
export const LocalApp: React.FC<{ workspace: LocalWorkspace; onScan?: () => Promise<string> }> = ({
  workspace,
  onScan,
}) => (
  <SessionProvider reader={workspace.reader} leave={() => undefined} workspace={workspace}>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        {libraryRoutes()}
        <Route path="/settings" element={<SettingsScreen onScan={onScan} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </SessionProvider>
);
