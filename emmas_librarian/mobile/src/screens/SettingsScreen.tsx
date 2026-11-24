import React from 'react';
import { ScreenHeader } from '../components';
import { BottomNav } from './BottomNav';
import { AppearanceCard } from './AppearanceCard';
import { SyncCard } from './SyncCard';

/**
 * Ajustes: how the app looks, and the sync with the computer.
 *
 * @example <Route path="/settings" element={<SettingsScreen />} />
 */
export const SettingsScreen: React.FC<{ onScan?: () => Promise<string> }> = ({ onScan }) => (
  <main className="m-screen m-screen--nav">
    <ScreenHeader title="Ajustes" />
    <SyncCard onScan={onScan} />
    <AppearanceCard />
    <BottomNav />
  </main>
);
