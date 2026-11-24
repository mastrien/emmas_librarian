import React, { useState } from 'react';
import { errorText } from '../errorText';
import type { LocalWorkspace, WorkspaceStatus } from '../local/LocalWorkspace';
import { useWorkspace } from '../session/SessionContext';
import { PairCard } from './PairCard';

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

const Alert: React.FC<{ text: string | null }> = ({ text }) =>
  text ? (
    <p className="m-note m-note--error" role="alert">
      {text}
    </p>
  ) : null;

const SyncSummary: React.FC<{ status: WorkspaceStatus }> = ({ status }) => (
  <>
    <p>
      Pareado com {status.pairedTo}. Última troca: {when(status.lastSyncAt)}.
    </p>
    {status.verificationCode && (
      <p>
        Código de verificação: <code className="m-code">{status.verificationCode}</code>
      </p>
    )}
    <p>
      {status.pendingChanges === 0
        ? 'Nada aguardando o computador.'
        : `${status.pendingChanges} alteração(ões) aguardando confirmação no computador.`}
    </p>
  </>
);

/** Asks before forgetting the pairing, and says what that would lose. */
const UnpairPanel: React.FC<{ workspace: LocalWorkspace }> = ({ workspace }) => {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button className="m-button m-button--danger" onClick={() => setConfirming(true)}>
        Desparear e apagar os dados deste celular
      </button>
    );
  }
  const losses = workspace.lossesOnUnpair();
  return (
    <div role="alertdialog" aria-label="Desparear">
      <p>
        Desparear apaga a cópia da biblioteca neste celular, inclusive {losses.pendingChanges} alteração(ões) ainda não
        aplicadas no computador e {losses.ownProjects} projeto(s) só do celular.
      </p>
      <button className="m-button" onClick={() => setConfirming(false)}>
        Cancelar
      </button>
      <button
        className="m-button m-button--danger"
        onClick={() => void workspace.unpair().then(() => setConfirming(false))}
      >
        Desparear e apagar
      </button>
    </div>
  );
};

/**
 * Sync with the computer: pair, sync now, see what waits for the computer, and unpair (which forgets the copy).
 *
 * @example <SyncCard onScan={scanQrCode} />
 */
export const SyncCard: React.FC<{ onScan?: () => Promise<string> }> = ({ onScan }) => {
  const { workspace, status } = useWorkspace();
  const [problem, setProblem] = useState<string | null>(null);
  if (!workspace || !status) return null;
  if (!status.pairedTo) return <PairCard onPair={(text) => workspace.pair(text)} onScan={onScan} />;

  const sync = () =>
    workspace.syncNow().then(
      () => setProblem(null),
      (error: unknown) => setProblem(errorText(error)),
    );
  return (
    <section className="m-card">
      <h2>Sincronização</h2>
      <SyncSummary status={status} />
      <Alert text={problem ?? status.lastError} />
      <button className="m-button m-button--primary" disabled={status.syncing} onClick={() => void sync()}>
        {status.syncing ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>
      <UnpairPanel workspace={workspace} />
    </section>
  );
};
