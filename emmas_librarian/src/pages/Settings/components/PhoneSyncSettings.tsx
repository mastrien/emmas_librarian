import React, { useCallback, useEffect, useState } from 'react';
import { QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { useProjectService } from '../../../contexts/ServicesContext';
import { useDialogs } from '../../../components/common/dialogs/DialogProvider';
import type { PendingPhoneChange, RemoteAccessStatus, RemotePairingInvite } from '../../../types/remoteAccess';
import { describePhoneChange } from '../phoneChangeText';
import { serverAddress } from './RemoteAccessSettings';
import './remoteAccessSettings.css';

const POLL_MS = 10_000;

const ChangeRow: React.FC<{ change: PendingPhoneChange; chosen: boolean; onToggle: () => void }> = ({
  change,
  chosen,
  onToggle,
}) => {
  const text = describePhoneChange(change);
  return (
    <label className={`phone-change${text.destructive ? ' phone-change--danger' : ''}`}>
      <input type="checkbox" checked={chosen} onChange={onToggle} aria-label={`${text.kind}: ${text.detail}`} />
      <span className="phone-change__kind">{text.kind}</span>
      <span className="phone-change__entity">{text.entity}</span>
      <span className="phone-change__detail">
        {text.detail}
        {text.before && <span className="phone-change__before"> (agora: {text.before})</span>}
      </span>
    </label>
  );
};

interface ReviewProps {
  changes: PendingPhoneChange[];
  onApply: (opIds: string[]) => Promise<void>;
  onReject: (opIds: string[]) => Promise<void>;
}

const ChangeReview: React.FC<ReviewProps> = ({ changes, onApply, onReject }) => {
  const [unchosen, setUnchosen] = useState<Set<string>>(new Set());
  const chosen = changes.map((change) => change.opId).filter((id) => !unchosen.has(id));
  const toggle = (id: string) =>
    setUnchosen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  if (changes.length === 0)
    return <div className="settings-empty settings-empty--small">Nenhuma alteração do celular aguardando.</div>;
  return (
    <div className="settings-subsection">
      <h3>{changes.length} alteração(ões) do celular aguardam sua confirmação</h3>
      <p className="settings-subsection-text">
        Nada foi aplicado. Desmarque o que não quiser. O que for rejeitado é desfeito no celular na próxima
        sincronização.
      </p>
      <div className="phone-changes">
        {changes.map((change) => (
          <ChangeRow
            key={change.opId}
            change={change}
            chosen={!unchosen.has(change.opId)}
            onToggle={() => toggle(change.opId)}
          />
        ))}
      </div>
      <div className="phone-changes__actions">
        <button className="btn-secondary" disabled={chosen.length === 0} onClick={() => void onReject(chosen)}>
          Rejeitar {chosen.length}
        </button>
        <button className="btn-primary" disabled={chosen.length === 0} onClick={() => void onApply(chosen)}>
          Aplicar {chosen.length}
        </button>
      </div>
    </div>
  );
};

/** The sync state and the actions of the screen, kept apart from how they are drawn. */
function usePhoneSync() {
  const service = useProjectService();
  const { confirm } = useDialogs();
  const [status, setStatus] = useState<RemoteAccessStatus | null>(null);
  const [invite, setInvite] = useState<RemotePairingInvite | null>(null);
  const [changes, setChanges] = useState<PendingPhoneChange[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await service.getRemoteAccessStatus());
    setChanges(await service.listPhoneChanges().catch(() => []));
  }, [service]);

  useEffect(() => {
    void refresh().catch(console.error);
    const timer = setInterval(() => void refresh().catch(() => undefined), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const pair = async () => {
    try {
      setInvite(await service.startPhoneSyncPairing());
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };
  const decide = (action: (ids: string[]) => Promise<unknown>) => async (ids: string[]) => {
    await action(ids);
    await refresh();
  };
  const revoke = async () => {
    const message =
      'Desparear o celular? A chave dele deixa de funcionar na hora, e as alterações dele que ainda não foram aplicadas continuam aqui até você decidir.';
    if (!(await confirm({ title: 'Desparear celular', message, confirmLabel: 'Desparear', danger: true }))) return;
    setStatus(await service.revokePhoneSync());
    setInvite(null);
  };
  return {
    status,
    invite,
    changes,
    problem,
    pair,
    refresh,
    revoke,
    closeInvite: () => setInvite(null),
    apply: decide((ids) => service.applyPhoneChanges(ids)),
    reject: decide((ids) => service.rejectPhoneChanges(ids)),
  };
}

/**
 * Sync with a paired phone (docs/sincronizacao-celular.md): pair it by QR code, check the code both screens show,
 * and decide what the phone changed in the projects that came from this computer.
 *
 * @example <PhoneSyncSettings />
 */
export const PhoneSyncSettings: React.FC = () => {
  const { status, invite, changes, problem, pair, refresh, revoke, closeInvite, apply, reject } = usePhoneSync();
  if (!status) return null;
  const device = status.syncDevice;
  return (
    <SettingsCard
      title="Sincronizar com o celular"
      icon={<Smartphone size={24} />}
      description="Mantém uma cópia cifrada da biblioteca no celular. O que o celular alterar só entra aqui depois que você confirmar."
    >
      {serverAddress(status) ? (
        !device &&
        !invite && (
          <button onClick={pair} className="btn-primary settings-icon-button remote-access-pair">
            <QrCode size={16} /> Parear um celular para sincronizar
          </button>
        )
      ) : (
        <p className="settings-subsection-text">Ligue o acesso pela rede local acima para parear um celular.</p>
      )}
      {problem && (
        <p className="remote-access-error" role="alert">
          {problem}
        </p>
      )}
      {invite && (
        <div className="remote-access-invite">
          <img
            className="remote-access-qr"
            alt="Código QR de pareamento para sincronizar"
            src={`data:image/svg+xml;utf8,${encodeURIComponent(invite.qrSvg)}`}
          />
          <div>
            <p className="settings-subsection-text">
              No aplicativo do celular, em Ajustes, leia o código. Ele vale uma vez só, até as{' '}
              {new Date(invite.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
            </p>
            <p className="settings-subsection-text">
              Depois de parear, os dois aparelhos mostram o mesmo código de verificação. Confira.
            </p>
            <button onClick={closeInvite} className="btn-secondary">
              Fechar código
            </button>
          </div>
        </div>
      )}
      {device && (
        <div className="settings-subsection">
          <h3>Celular pareado</h3>
          <div className="backup-item">
            <div>
              <span className="backup-item-date">{device.deviceName}</span>
              <span className="backup-item-size">
                Pareado em {new Date(device.pairedAt).toLocaleDateString('pt-BR')}
                {device.verificationCode && (
                  <>
                    {' '}
                    · código de verificação <code>{device.verificationCode}</code>
                  </>
                )}
              </span>
            </div>
            <button onClick={revoke} className="btn-secondary settings-tiny-button settings-danger-text">
              Desparear
            </button>
          </div>
        </div>
      )}
      {device && (
        <>
          <button
            onClick={() => void refresh()}
            className="btn-secondary settings-icon-button"
            aria-label="Atualizar lista de alterações"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
          <ChangeReview changes={changes} onApply={apply} onReject={reject} />
        </>
      )}
    </SettingsCard>
  );
};
