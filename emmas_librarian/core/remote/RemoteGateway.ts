import type { CommandRegistry } from '../commands/CommandRegistry';
import { AppError } from '../errors/AppError';
import { shellFailureFrom } from '../errors/shellFailureFrom';
import type { PairedDevices } from './PairedDevices';
import type { PairingDesk } from './PairingDesk';
import { authorizeRemoteCommand, type RemotePrincipal } from './remoteAccessPolicy';

/** An HTTP request as the gateway needs it, whatever server received it. */
export interface GatewayRequest {
  method: string;
  /** Path without the query string. */
  path: string;
  /** Header names in lower case. */
  headers: Record<string, string | undefined>;
  body: Buffer;
  remoteAddress: string;
}

export interface GatewayResponse {
  status: number;
  contentType: string;
  body: Buffer | string;
}

export interface GatewayPairing {
  desk: PairingDesk;
  devices: PairedDevices;
}

export interface GatewayOptions {
  commands: CommandRegistry;
  /** Who a bearer token belongs to, or null. */
  authenticate: (token: string) => RemotePrincipal | null;
  /** Present on the LAN server; the local channel pairs nobody. */
  pairing?: GatewayPairing;
  now?: () => number;
}

const COMMAND_PREFIX = '/api/commands/';
const WINDOW_MS = 60_000;
const MAX_FAILURES = 10;
const STATUS_BY_CODE: Record<string, number> = {
  ERR_UNKNOWN_COMMAND: 404,
  ERR_REMOTE_FORBIDDEN: 403,
  ERR_LIBRARY_IN_USE: 409,
  ERR_REMOTE_UNAUTHORIZED: 401,
  ERR_PAIRING_REFUSED: 403,
  ERR_REMOTE_THROTTLED: 429,
  ERR_REMOTE_NOT_FOUND: 404,
};
const STATUS_BY_TYPE: Record<string, number> = { USER_ERROR: 400, VALIDATION_ERROR: 400, NETWORK_ERROR: 502 };

const remoteError = (code: string, problem: string, expected: string) =>
  new AppError(code, 'VALIDATION_ERROR', `[${code}] ${problem}. Expected shape: ${expected}.`);

const json = (status: number, document: object): GatewayResponse => ({
  status,
  contentType: 'application/json; charset=utf-8',
  body: JSON.stringify(document),
});

/**
 * The HTTP face of the command registry, free of any server: it turns a request into a response.
 * The LAN server (paired phones, HTTPS) and the local channel (the CLI on this computer) are two
 * instances with different `authenticate`; what each caller may run is in remoteAccessPolicy.
 *
 *   GET  /api/ping              -> { ok, result: { app } }             no token
 *   POST /api/pair              -> { ok, result: { token, deviceId } }  one-time code, LAN only
 *   POST /api/commands/<name>   -> { ok, result } | bytes               Authorization: Bearer <token>
 *
 * Usage:
 *   const gateway = new RemoteGateway({ commands, authenticate, pairing: { desk, devices } });
 *   const response = await gateway.handle(request);
 */
export class RemoteGateway {
  private readonly failures = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(private readonly options: GatewayOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Never throws: every failure becomes a JSON error with a status. */
  async handle(request: GatewayRequest): Promise<GatewayResponse> {
    try {
      return await this.route(request);
    } catch (error) {
      return this.failure(error);
    }
  }

  private route(request: GatewayRequest): GatewayResponse | Promise<GatewayResponse> {
    const { method, path } = request;
    if (method === 'GET' && path === '/api/ping') return json(200, { ok: true, result: { app: 'emmas-librarian' } });
    if (method === 'POST' && path === '/api/pair') return this.pair(request);
    if (method === 'POST' && path.startsWith(COMMAND_PREFIX)) return this.runCommand(request);
    throw remoteError(
      'ERR_REMOTE_NOT_FOUND',
      `Rota desconhecida. Offending value: "${method} ${path}"`,
      'POST /api/commands/<comando>',
    );
  }

  private pair(request: GatewayRequest): GatewayResponse {
    const { pairing } = this.options;
    this.refuseThrottled(request.remoteAddress);
    const { code, deviceName } = readJsonBody(request) as { code?: unknown; deviceName?: unknown };
    if (!pairing || !pairing.desk.redeem(code)) {
      this.noteFailure(request.remoteAddress);
      throw remoteError(
        'ERR_PAIRING_REFUSED',
        'Código de pareamento inválido ou vencido',
        'o código do QR aberto agora no aplicativo',
      );
    }
    const { device, token } = pairing.devices.add(deviceName);
    return json(200, { ok: true, result: { token, deviceId: device.id, deviceName: device.name } });
  }

  private async runCommand(request: GatewayRequest): Promise<GatewayResponse> {
    const principal = this.requirePrincipal(request);
    const name = decodeURIComponent(request.path.slice(COMMAND_PREFIX.length));
    const given = argumentsOf(readJsonBody(request));
    const { command, args } = authorizeRemoteCommand(this.options.commands, principal, name, given);
    const result = await command.run(...(args as never[]));
    if (Buffer.isBuffer(result)) return { status: 200, contentType: 'application/octet-stream', body: result };
    return json(200, { ok: true, result: result ?? null });
  }

  private requirePrincipal(request: GatewayRequest): RemotePrincipal {
    this.refuseThrottled(request.remoteAddress);
    const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    const principal = token ? this.options.authenticate(token) : null;
    if (principal) return principal;
    this.noteFailure(request.remoteAddress);
    throw remoteError(
      'ERR_REMOTE_UNAUTHORIZED',
      'Token ausente, inválido ou revogado',
      'o cabeçalho Authorization: Bearer <token do dispositivo>',
    );
  }

  // Ten wrong tokens or codes from one address in a minute and it waits: guessing must not be cheap.
  private recentFailures(address: string): number[] {
    const since = this.now() - WINDOW_MS;
    const recent = (this.failures.get(address) ?? []).filter((at) => at > since);
    this.failures.set(address, recent);
    return recent;
  }

  private refuseThrottled(address: string): void {
    if (this.recentFailures(address).length < MAX_FAILURES) return;
    throw remoteError(
      'ERR_REMOTE_THROTTLED',
      `Tentativas demais a partir de ${address}`,
      'esperar um minuto antes de tentar de novo',
    );
  }

  private noteFailure(address: string): void {
    this.recentFailures(address).push(this.now());
  }

  private failure(error: unknown): GatewayResponse {
    const { code, type, message } = shellFailureFrom(error);
    const status = STATUS_BY_CODE[code] ?? STATUS_BY_TYPE[type] ?? 500;
    // An internal failure may name files and folders of this computer; the caller only needs to know it failed.
    const shown = status === 500 ? 'Erro interno ao executar o comando.' : message;
    return json(status, { ok: false, error: { code, type, message: shown } });
  }
}

// application/json is not a "simple" content type: a web page of another origin cannot send it without a
// CORS preflight, which this server never answers. That keeps other sites from calling it through a browser.
function readJsonBody(request: GatewayRequest): unknown {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw remoteError(
      'ERR_REMOTE_BAD_REQUEST',
      `Content-Type inválido. Offending value: "${contentType}"`,
      'application/json',
    );
  }
  try {
    return request.body.length === 0 ? {} : JSON.parse(request.body.toString('utf8'));
  } catch {
    throw remoteError(
      'ERR_REMOTE_BAD_REQUEST',
      'O corpo não é JSON válido',
      'um objeto JSON, por exemplo {"args":[3]}',
    );
  }
}

function argumentsOf(body: unknown): unknown[] {
  const args = (body as { args?: unknown } | null)?.args ?? [];
  if (Array.isArray(args)) return args;
  throw remoteError(
    'ERR_REMOTE_BAD_REQUEST',
    `"args" inválido. Offending value: ${JSON.stringify(args)}`,
    'um array com os argumentos do comando',
  );
}
