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
  error: string | null;
}

/** What the desktop shows for a phone to pair: valid once, for a few minutes. */
export interface RemotePairingInvite {
  url: string;
  expiresAt: string;
  fingerprint: string;
  /** The URL as a QR code (SVG markup). */
  qrSvg: string;
}
