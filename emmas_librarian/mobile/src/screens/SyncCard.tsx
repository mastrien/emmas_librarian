import React, { useState } from 'react';
import { useWorkspace } from '../session/SessionContext';
import { PairCard } from './PairCard';

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

/**
 * Sync with the computer: pair, sync now, see what waits for the computer, and unpair (which forgets the copy).
 *
 * @example <SyncCard onScan={scanQrCode} />
 */
export const SyncCard: React.FC<{ onScan?: () => Promise<string> }> = ({ onScan }) => {
  const { workspace, status } = useWorkspace();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!workspace || !status) return null;
  if (!status.pairedTo) return <PairCard onPair={(text) => workspace.pair(text)} onScan={onScan} />;

  const sync = () =>
    workspace.syncNow().then(
      () => setProblem(null),
      (error: unknown) => setProblem(error instanceof Error ? error.message : String(error)),
    );
  const losses = workspace.lossesOnUnpair();
  return (
    <section className="m-card">
      <h2>Sincronização</h2>
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
      {(problem ?? status.lastError) && (
        <p className="m-note m-note--error" role="alert">
          {problem ?? status.lastError}
        </p>
      )}
      <button className="m-button m-button--primary" disabled={status.syncing} onClick={() => void sync()}>
        {status.syncing ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>
      {confirming ? (
        <div role="alertdialog" aria-label="Desparear">
          <p>
            Desparear apaga a cópia da biblioteca neste celular, inclusive {losses.pendingChanges} alteração(ões) ainda
            não aplicadas no computador e {losses.ownProjects} projeto(s) só do celular.
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
      ) : (
        <button className="m-button m-button--danger" onClick={() => setConfirming(true)}>
          Desparear e apagar os dados deste celular
        </button>
      )}
    </section>
  );
};
