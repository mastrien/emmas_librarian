/** A phone paired to reach this library over the local network (#32). */
export interface RemoteAccessDevice {
  id: string;
  name: string;
  pairedAt: string;
  lastSeenAt: string | null;
}

export interface RemoteAccessStatus {
  /** What the person chose; the server may still have failed to start (see `error`). */
  enabled: boolean;
  running: boolean;
  port: number | null;
  /** IPv4 addresses of this computer on the local network. */
  addresses: string[];
  /** SHA-256 of the server's certificate, to compare with what the phone's browser shows. */
  fingerprint: string | null;
  devices: RemoteAccessDevice[];
  /** The phone paired for encrypted sync, if any (one per computer). */
  syncDevice: RemoteSyncDevice | null;
  error: string | null;
}

/** The phone paired for sync, and the code both screens show so the person can check it is the same one. */
export interface RemoteSyncDevice {
  deviceId: string;
  deviceName: string;
  pairedAt: number;
  /** Shown right after pairing; null when it was not paired in this run. */
  verificationCode: string | null;
}

/** A change a phone made, waiting for the person to confirm it on the computer. */
export interface PendingPhoneChange {
  opId: string;
  entity: string;
  kind: 'insert' | 'update' | 'delete';
  /** What the phone sent (columns of the row), or null for a delete. */
  fields: { [column: string]: string | number | null } | null;
  /** The row as it is now on this computer, or null when there is none. */
  current: { [column: string]: string | number | null } | null;
  changedAt: string;
}

export interface PhoneChangeDecision {
  opId: string;
  status: 'applied' | 'rejected' | 'skipped';
  reason: string | null;
}

/** What the desktop shows for a phone to pair: valid once, for a few minutes. */
export interface RemotePairingInvite {
  url: string;
  expiresAt: string;
  fingerprint: string;
  /** The URL as a QR code (SVG markup). */
  qrSvg: string;
}
