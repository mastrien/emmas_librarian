import React, { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { AppEnvironment } from './App';
import { errorText } from './errorText';
import { libraryRoutes } from './libraryRoutes';
import { ArchiveProjectReader } from './reader/ArchiveProjectReader';
import { fetchTransport, HttpProjectReader } from './reader/HttpProjectReader';
import type { ProjectReader } from './reader/ProjectReader';
import { fileSource } from './reader/zipFile';
import { StartScreen } from './screens/StartScreen';
import { deviceNameFrom, isServedByDesktop, pairingCodeFrom, pairWithDesktop } from './session/pairing';
import { SessionProvider } from './session/SessionContext';

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
      (error: unknown) => (notice = errorText(error)),
    );
  }
  const servedByDesktop = await isServedByDesktop(env.send);
  const token = servedByDesktop ? env.tokens.read() : null;
  return { reader: token ? desktopReader(token) : null, servedByDesktop, notice };
}

const readerOfFile = (file: File): Promise<ProjectReader> => ArchiveProjectReader.open(fileSource(file));

const RequireLibrary: React.FC<{ open: boolean; children: React.ReactElement }> = ({ open, children }) =>
  open ? children : <Navigate to="/" replace />;

/** Boots the classic modes (live desktop, or a project file) and gives the handlers that change what is open. */
function useClassicSession(environment: AppEnvironment) {
  const [state, setState] = useState<Boot | null>(null);
  useEffect(() => {
    // The desktop refused the token: forget it and say why, instead of an error on every screen.
    const revoked = () => {
      environment.tokens.clear();
      setState((current) => current && { ...current, reader: null, notice: REVOKED });
    };
    void boot(environment, revoked).then(setState);
  }, [environment]);
  const openFile = (file: File) =>
    readerOfFile(file).then(
      (reader) => setState((current) => current && { ...current, reader, notice: null }),
      (error: unknown) => setState((current) => current && { ...current, notice: errorText(error) }),
    );
  const leave = () => {
    if (state?.reader?.source === 'desktop') environment.tokens.clear();
    setState((current) => current && { ...current, reader: null, notice: null });
  };
  return { state, openFile, leave };
}

/**
 * The mobile client of #33: pairs with the desktop when opened from its QR code, or opens a project file; from there
 * the same screens read either one.
 *
 * @example <ClassicApp environment={environment} />
 */
export const ClassicApp: React.FC<{ environment: AppEnvironment }> = ({ environment }) => {
  const { state, openFile, leave } = useClassicSession(environment);
  if (!state) return <p className="m-note">Abrindo…</p>;
  const start = <StartScreen servedByDesktop={state.servedByDesktop} notice={state.notice} onOpenFile={openFile} />;
  return (
    <SessionProvider reader={state.reader} leave={leave}>
      <HashRouter>
        <Routes>
          <Route path="/" element={state.reader ? <Navigate to="/projects" replace /> : start} />
          {libraryRoutes((screen) => (
            <RequireLibrary open={state.reader !== null}>{screen}</RequireLibrary>
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </SessionProvider>
  );
};
