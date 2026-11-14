import React, { useEffect, useState } from 'react';
import { QrCode, Smartphone, X } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { useProjectService } from '../../../contexts/ServicesContext';
import { useDialogs } from '../../../components/common/dialogs/DialogProvider';
import type { RemoteAccessDevice, RemoteAccessStatus, RemotePairingInvite } from '../../../types/remoteAccess';
import './remoteAccessSettings.css';

const formatDay = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('pt-BR') : 'nunca');

/**
 * Where a phone finds this computer, or null while the server is off or the computer is on no network.
 *
 * @example serverAddress({ running: true, addresses: ['192.168.0.10'], port: 47810, ... }) // 'https://192.168.0.10:47810'
 */
export function serverAddress(status: RemoteAccessStatus): string | null {
  const [address] = status.addresses;
  return status.running && address && status.port ? `https://${address}:${status.port}` : null;
}

const AccessToggle: React.FC<{ status: RemoteAccessStatus; onChange: (enabled: boolean) => void }> = (props) => (
  <label className="settings-toggle">
    <input type="checkbox" checked={props.status.enabled} onChange={(e) => props.onChange(e.target.checked)} />
    <div>
      <span className="settings-toggle-title">Permitir acesso pela rede local</span>
      <span className="settings-toggle-hint">
        Só responde a celulares que você parear aqui. As chaves de API nunca saem deste computador.
      </span>
    </div>
  </label>
);

const ServerDetails: React.FC<{ status: RemoteAccessStatus }> = ({ status }) => {
  const address = serverAddress(status);
  if (status.error) {
    return (
      <p className="remote-access-error" role="alert">
        Não foi possível ligar o acesso: {status.error}
      </p>
    );
  }
  if (!status.running) return null;
  return (
    <dl className="remote-access-details">
      <dt>Endereço</dt>
      <dd>{address ?? 'Este computador não está em uma rede local.'}</dd>
      <dt>Impressão digital do certificado (SHA-256)</dt>
      <dd className="remote-access-fingerprint">{status.fingerprint}</dd>
    </dl>
  );
};

const PairingInvite: React.FC<{ invite: RemotePairingInvite; onClose: () => void }> = ({ invite, onClose }) => (
  <div className="remote-access-invite">
    <img
      className="remote-access-qr"
      alt="Código QR de pareamento"
      src={`data:image/svg+xml;utf8,${encodeURIComponent(invite.qrSvg)}`}
    />
    <div>
      <p className="settings-subsection-text">
        Leia o código com a câmera do celular, na mesma rede Wi-Fi. Ele vale uma vez só, até as{' '}
        {new Date(invite.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
      </p>
      <p className="settings-subsection-text">
        O navegador do celular vai avisar que não reconhece o certificado. Antes de continuar, confira nos detalhes do
        aviso se a impressão digital é a mostrada acima.
      </p>
      <button onClick={onClose} className="btn-secondary settings-icon-button">
        <X size={16} /> Fechar código
      </button>
    </div>
  </div>
);

const DeviceItem: React.FC<{ device: RemoteAccessDevice; onRevoke: () => void }> = ({ device, onRevoke }) => (
  <div className="backup-item">
    <div>
      <span className="backup-item-date">{device.name}</span>
      <span className="backup-item-size">
        Pareado em {formatDay(device.pairedAt)} · último acesso: {formatDay(device.lastSeenAt)}
      </span>
    </div>
    <button onClick={onRevoke} className="btn-secondary settings-tiny-button settings-danger-text">
      Revogar
    </button>
  </div>
);

const DeviceList: React.FC<{ devices: RemoteAccessDevice[]; onRevoke: (device: RemoteAccessDevice) => void }> = (
  props,
) => (
  <div className="settings-subsection">
    <h3>Celulares pareados</h3>
    {props.devices.length === 0 ? (
      <div className="settings-empty settings-empty--small">Nenhum celular pareado.</div>
    ) : (
      <div className="backup-list">
        {props.devices.map((device) => (
          <DeviceItem key={device.id} device={device} onRevoke={() => props.onRevoke(device)} />
        ))}
      </div>
    )}
  </div>
);

/** The LAN server's state and the actions of the screen, kept apart from how they are drawn. */
function useRemoteAccess() {
  const service = useProjectService();
  const { confirm } = useDialogs();
  const [status, setStatus] = useState<RemoteAccessStatus | null>(null);
  const [invite, setInvite] = useState<RemotePairingInvite | null>(null);

  useEffect(() => {
    service.getRemoteAccessStatus().then(setStatus).catch(console.error);
    // Leaving the screen closes an open code: it must not stay valid with nobody looking at it.
    return () => void service.cancelRemotePairing().catch(console.error);
  }, [service]);

  const closeInvite = async () => {
    setInvite(null);
    await service.cancelRemotePairing();
    setStatus(await service.getRemoteAccessStatus());
  };
  const toggle = async (enabled: boolean) => {
    setInvite(null);
    // The first start issues a certificate, which takes a moment: the switch answers the click at once.
    setStatus((current) => current && { ...current, enabled });
    setStatus(await service.setRemoteAccessEnabled(enabled));
  };
  const pair = async () => setInvite(await service.startRemotePairing());
  const revoke = async (device: RemoteAccessDevice) => {
    const message = `Revogar o acesso de "${device.name}"? Ele para de funcionar na hora e só volta com um novo pareamento.`;
    if (!(await confirm({ title: 'Revogar celular', message, confirmLabel: 'Revogar', danger: true }))) return;
    setStatus(await service.revokeRemoteDevice(device.id));
  };
  return { status, invite, toggle, pair, closeInvite, revoke };
}

/**
 * Settings of the access from a phone (#32): turn the LAN server on, pair a phone by QR code, revoke it.
 *
 * @example <RemoteAccessSettings />
 */
export const RemoteAccessSettings: React.FC = () => {
  const { status, invite, toggle, pair, closeInvite, revoke } = useRemoteAccess();
  if (!status) return null;
  return (
    <SettingsCard
      title="Acesso pelo celular"
      icon={<Smartphone size={24} />}
      description="Deixa um celular da mesma rede ler esta biblioteca e anotar no diário. Fica desligado até você ligar. A tela para celular ainda não foi lançada; por enquanto este acesso serve a quem usa a API."
    >
      <AccessToggle status={status} onChange={toggle} />
      <ServerDetails status={status} />
      {serverAddress(status) && !invite && (
        <button onClick={pair} className="btn-primary settings-icon-button remote-access-pair">
          <QrCode size={16} /> Parear um celular
        </button>
      )}
      {invite && <PairingInvite invite={invite} onClose={closeInvite} />}
      <DeviceList devices={status.devices} onRevoke={revoke} />
    </SettingsCard>
  );
};
