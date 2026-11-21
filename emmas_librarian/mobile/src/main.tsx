import '@fontsource-variable/lexend';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/jetbrains-mono';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, type AppEnvironment } from './App';
import { browserLocalEnvironment, wantsLocalLibrary } from './local/browserWorkspace';
import { LookProvider } from './look/LookContext';
import { browserTokenStore } from './session/pairing';
import { loadLook } from './theme';
import './tokens.css';
import './styles.css';

const isNativeApp = (): boolean =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

const environment: AppEnvironment = {
  tokens: browserTokenStore(window.localStorage),
  initialHash: window.location.hash,
  userAgent: navigator.userAgent,
  send: (...args) => fetch(...args),
  clearHash: () => window.history.replaceState(null, '', `${window.location.pathname}#/`),
  local: wantsLocalLibrary(window.location.search, window.localStorage, isNativeApp())
    ? browserLocalEnvironment({
        indexedDB: window.indexedDB,
        crypto: window.crypto,
        fetch: (...args) => fetch(...args),
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        newUuid: () => window.crypto.randomUUID(),
      })
    : undefined,
};

const look = loadLook(window.localStorage, window.matchMedia('(prefers-color-scheme: dark)').matches);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LookProvider initial={look} storage={window.localStorage} root={document.documentElement}>
      <App environment={environment} />
    </LookProvider>
  </React.StrictMode>,
);

// Offline use needs a service worker, which browsers only install from a certificate they trust: it
// works on the copy published on the web and is refused, harmlessly, on the copy the desktop serves.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
