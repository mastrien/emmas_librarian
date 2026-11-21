import React, { useEffect, useState } from 'react';
import type { LocalAppEnvironment } from './App';
import { errorText } from './errorText';
import { LocalApp } from './LocalApp';
import type { LocalWorkspace } from './local/LocalWorkspace';
import { SplashScreen } from './screens/SplashScreen';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The opening screen while the phone's library is read from storage, then the app on it.
 *
 * @example <LocalBoot local={environment.local} />
 */
export const LocalBoot: React.FC<{ local: LocalAppEnvironment }> = ({ local }) => {
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([local.open(), wait(local.minimumSplashMs ?? 800)]).then(
      ([opened]) => setWorkspace(opened),
      (error: unknown) => setFailure(errorText(error)),
    );
  }, [local]);
  if (failure) {
    return (
      <p className="m-note m-note--error" role="alert">
        Não foi possível abrir a biblioteca deste celular: {failure}
      </p>
    );
  }
  return workspace ? <LocalApp workspace={workspace} onScan={local.scan} /> : <SplashScreen />;
};
