import React, { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ArchiveProjectReader } from './reader/ArchiveProjectReader';
import { fetchTransport, HttpProjectReader } from './reader/HttpProjectReader';
import type { ProjectReader } from './reader/ProjectReader';
import {
  deviceNameFrom,
  isServedByDesktop,
  pairingCodeFrom,
  pairWithDesktop,
  type TokenStore,
} from './session/pairing';
import { SessionProvider } from './session/SessionContext';
import { ArticleScreen } from './screens/ArticleScreen';
import { PdfScreen } from './screens/PdfScreen';
import { ProjectScreen } from './screens/ProjectScreen';
import { ProjectsScreen } from './screens/ProjectsScreen';
import { StartScreen } from './screens/StartScreen';

/** What the app needs from the browser, so tests can stand in for it. */
export interface AppEnvironment {
  tokens: TokenStore;
  /** The fragment of the address the page was opened with (a pairing QR code puts its code there). */
  initialHash: string;
  userAgent: string;
  send: typeof fetch;
  /** Removes the pairing code from the address bar, so a reload does not try to use it again. */
  clearHash: () => void;
}

interface Boot {
  reader: ProjectReader | null;
  servedByDesktop: boolean;
  notice: string | null;
}

const desktopReader = (token: string, send: typeof fetch) => new HttpProjectReader(fetchTransport(token, send));

async function boot(env: AppEnvironment): Promise<Boot> {
  const code = pairingCodeFrom(env.initialHash);
  let notice: string | null = null;
  if (code) {
    env.clearHash();
    await pairWithDesktop(code, deviceNameFrom(env.userAgent), env.send).then(
      (token) => env.tokens.write(token),
      (error: unknown) => (notice = error instanceof Error ? error.message : String(error)),
    );
  }
  const servedByDesktop = await isServedByDesktop(env.send);
  const token = servedByDesktop ? env.tokens.read() : null;
  return { reader: token ? desktopReader(token, env.send) : null, servedByDesktop, notice };
}

// FileReader rather than file.arrayBuffer(): older mobile browsers (and the test DOM) lack the latter.
function bytesOf(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo "${file.name}".`));
    reader.readAsArrayBuffer(file);
  });
}

async function readerOfFile(file: File): Promise<ProjectReader> {
  return new ArchiveProjectReader(await bytesOf(file));
}

const RequireLibrary: React.FC<{ open: boolean; children: React.ReactElement }> = ({ open, children }) =>
  open ? children : <Navigate to="/" replace />;

/**
 * The mobile client (#33): pairs with the desktop when opened from its QR code, or opens a project
 * file; from there the same screens read either one.
 *
 * @example <App environment={browserEnvironment()} />
 */
export const App: React.FC<{ environment: AppEnvironment }> = ({ environment }) => {
  const [state, setState] = useState<Boot | null>(null);
  useEffect(() => {
    void boot(environment).then(setState);
  }, [environment]);
  if (!state) return <p className="m-note">Abrindo…</p>;

  const openFile = (file: File) =>
    readerOfFile(file).then(
      (reader) => setState({ ...state, reader, notice: null }),
      (error: unknown) => setState({ ...state, notice: error instanceof Error ? error.message : String(error) }),
    );
  const leave = () => {
    if (state.reader?.source === 'desktop') environment.tokens.clear();
    setState({ ...state, reader: null, notice: null });
  };
  const library = (screen: React.ReactElement) => (
    <RequireLibrary open={state.reader !== null}>{screen}</RequireLibrary>
  );
  const start = <StartScreen servedByDesktop={state.servedByDesktop} notice={state.notice} onOpenFile={openFile} />;

  return (
    <SessionProvider reader={state.reader} leave={leave}>
      <HashRouter>
        <Routes>
          <Route path="/" element={state.reader ? <Navigate to="/projects" replace /> : start} />
          <Route path="/projects" element={library(<ProjectsScreen />)} />
          <Route path="/projects/:projectId/:tab?" element={library(<ProjectScreen />)} />
          <Route path="/articles/:articleId" element={library(<ArticleScreen />)} />
          <Route path="/articles/:articleId/pdf" element={library(<PdfScreen />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </SessionProvider>
  );
};
