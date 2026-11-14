import React, { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ArchiveProjectReader } from './reader/ArchiveProjectReader';
import { fetchTransport, HttpProjectReader } from './reader/HttpProjectReader';
import type { ProjectReader } from './reader/ProjectReader';
import { fileSource } from './reader/zipFile';
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

const REVOKED =
  'O acesso deste aparelho foi revogado no computador. Para voltar, abra um novo código em Configurações › Acesso pelo celular e leia o QR de novo.';

async function boot(env: AppEnvironment, onRevoked: () => void): Promise<Boot> {
  const desktopReader = (token: string) => new HttpProjectReader(fetchTransport(token, env.send, onRevoked));
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
  return { reader: token ? desktopReader(token) : null, servedByDesktop, notice };
}

const readerOfFile = (file: File): Promise<ProjectReader> => ArchiveProjectReader.open(fileSource(file));

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
    // The desktop refused the token: forget it and say why, instead of an error on every screen.
    const revoked = () => {
      environment.tokens.clear();
      setState((current) => current && { ...current, reader: null, notice: REVOKED });
    };
    void boot(environment, revoked).then(setState);
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
