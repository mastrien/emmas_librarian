import React from 'react';
import { ClassicApp } from './ClassicApp';
import { LocalBoot } from './LocalBoot';
import type { LocalWorkspace } from './local/LocalWorkspace';
import type { TokenStore } from './session/pairing';

/** What the app needs from the browser, so tests can stand in for it. */
export interface AppEnvironment {
  tokens: TokenStore;
  /** The fragment of the address the page was opened with (a pairing QR code puts its code there). */
  initialHash: string;
  userAgent: string;
  send: typeof fetch;
  /** Removes the pairing code from the address bar, so a reload does not try to use it again. */
  clearHash: () => void;
  /** Present when the phone keeps its own library (the app, or the web copy opted in); then nothing else is used. */
  local?: LocalAppEnvironment;
}

export interface LocalAppEnvironment {
  /** Opens the phone's workspace from its storage. */
  open: () => Promise<LocalWorkspace>;
  /** Reads the pairing QR code with the camera, where the app can. */
  scan?: () => Promise<string>;
  /** The least time the opening screen stays, so it does not flash. */
  minimumSplashMs?: number;
}

/**
 * The mobile client: the app on the phone's own library when the environment has one, else the classic modes (the
 * live desktop, or a project file).
 *
 * @example <App environment={browserEnvironment()} />
 */
export const App: React.FC<{ environment: AppEnvironment }> = ({ environment }) =>
  environment.local ? <LocalBoot local={environment.local} /> : <ClassicApp environment={environment} />;
