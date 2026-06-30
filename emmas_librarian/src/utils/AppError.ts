// Mirrored ErrorTypes from backend
export type ErrorType = 'USER_ERROR' | 'SYSTEM_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR';
export type ErrorCode =
  | 'ERR_MISSING_API_KEY'
  | 'ERR_MODEL_NOT_DEFINED'
  | 'ERR_INVALID_PDF'
  | 'ERR_API_QUOTA_EXCEEDED'
  | 'ERR_API_UNAUTHORIZED'
  | 'ERR_INTERNAL'
  | 'ERR_NOT_FOUND'
  | string;

export class FrontendAppError extends Error {
  public readonly isAppError = true;
  public readonly code: ErrorCode;
  public readonly type: ErrorType;
  public readonly details?: unknown;

  constructor(code: ErrorCode, type: ErrorType, message: string, details?: unknown) {
    super(message);
    this.name = 'FrontendAppError';
    this.code = code;
    this.type = type;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseIpcError(error: any): Error {
  if (!error) return new Error('Unknown error');

  const message = error.message || String(error);

  // Extract JSON payload from "Error: {...}"
  const jsonMatch = message.match(/({.*})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.isAppError) {
        return new FrontendAppError(parsed.code, parsed.type, parsed.message, parsed.details);
      }
    } catch (e) {
      // Ignore parse errors, fallback to raw error
    }
  }

  return error;
}
