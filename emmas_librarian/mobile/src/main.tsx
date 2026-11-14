import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, type AppEnvironment } from './App';
import { browserTokenStore } from './session/pairing';
import './styles.css';

const environment: AppEnvironment = {
  tokens: browserTokenStore(window.localStorage),
  initialHash: window.location.hash,
  userAgent: navigator.userAgent,
  send: (...args) => fetch(...args),
  clearHash: () => window.history.replaceState(null, '', `${window.location.pathname}#/`),
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App environment={environment} />
  </React.StrictMode>,
);

// Offline use needs a service worker, which browsers only install from a certificate they trust: it
// works on the copy published on the web and is refused, harmlessly, on the copy the desktop serves.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
