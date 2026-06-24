// @ts-nocheck
// PrismJS is loaded externally via <script> tags in index.html
// to ensure correct initialization order in production builds.
// See public/vendor/prismjs/ and the error report in relatorio_erro_prism.md.

import { StrictMode, Suspense, lazy } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { GlobalErrorProvider } from './contexts/GlobalErrorContext';
import { ErrorModal } from './components/modals/ErrorModal';

// Suppress React 19 warnings originating from third-party libraries (e.g. react-pdf-highlighter)
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string') {
    if (
      args[0].includes(
        'You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before',
      )
    ) {
      return;
    }
    if (args[0].includes('Unknown event handler property') && args[0].includes('onUpdate')) {
      return;
    }
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string') {
    if (
      args[0].includes(
        'You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before',
      )
    ) {
      return;
    }
    if (args[0].includes('Unknown event handler property') && args[0].includes('onUpdate')) {
      return;
    }
  }
  originalConsoleWarn.apply(console, args);
};

// Patch createRoot globally to reuse the same root on a container,
// preventing react-pdf-highlighter from re-creating roots.
try {
  const originalCreateRoot = ReactDOMClient.createRoot;
  Object.defineProperty(ReactDOMClient, 'createRoot', {
    configurable: true,
    writable: true,
    value: function (container: Element | DocumentFragment, options?: ReactDOMClient.RootOptions) {
      if (container && (container as { _reactRoot?: ReactDOMClient.Root })._reactRoot) {
        return (container as { _reactRoot?: ReactDOMClient.Root })._reactRoot;
      }
      const root = originalCreateRoot(container, options);
      if (container) {
        (container as { _reactRoot?: ReactDOMClient.Root })._reactRoot = root;
      }
      return root;
    },
  });
} catch (err) {
  // Safe fallback if target environment freezes module exports
}

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const NewProjectPage = lazy(() =>
  import('./pages/NewProjectPage').then((module) => ({ default: module.NewProjectPage })),
);
const ProjectDetailsPage = lazy(() =>
  import('./pages/ProjectDetailsPage').then((module) => ({ default: module.ProjectDetailsPage })),
);
const SearchPage = lazy(() => import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })));
const ArticleReaderPage = lazy(() =>
  import('./pages/ArticleReaderPage').then((module) => ({ default: module.ArticleReaderPage })),
);
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const TermsOfUsePage = lazy(() =>
  import('./pages/TermsOfUsePage').then((module) => ({ default: module.TermsOfUsePage })),
);
import './style.css';

// Initialize theme and accent
const savedTheme = localStorage.getItem('theme') || 'light';
const savedAccent = localStorage.getItem('accent') || 'blue';
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.setAttribute('data-accent', savedAccent);

if ((window as unknown as { electronAPI?: { invoke: (action: string, arg: string) => void } }).electronAPI) {
  (window as unknown as { electronAPI?: { invoke: (action: string, arg: string) => void } }).electronAPI.invoke(
    'UPDATE_TITLE_BAR',
    savedTheme,
  );
}

const rootEl = document.getElementById('root');
if (rootEl)
  ReactDOMClient.createRoot(rootEl).render(
    <GlobalErrorProvider>
      <HashRouter>
        <Layout>
          <Suspense
            fallback={<div className="flex-1 flex items-center justify-center p-8 text-gray-500">Loading...</div>}
          >
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/new-project" element={<NewProjectPage />} />
              <Route path="/projects/:id" element={<ProjectDetailsPage />} />
              <Route path="/projects/:id/search" element={<SearchPage />} />
              <Route path="/articles/:id" element={<ArticleReaderPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/terms" element={<TermsOfUsePage />} />
            </Routes>
          </Suspense>
        </Layout>
      </HashRouter>
      <ErrorModal />
    </GlobalErrorProvider>,
  );
