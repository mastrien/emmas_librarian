export type ErrorType = 'USER_ERROR' | 'SYSTEM_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR';
export type ErrorCode =
  | 'ERR_MISSING_API_KEY'
  | 'ERR_MODEL_NOT_DEFINED'
  | 'ERR_INVALID_PDF'
  | 'ERR_API_QUOTA_EXCEEDED'
  | 'ERR_API_UNAUTHORIZED'
  | 'ERR_API_CONNECTION'
  | 'ERR_INTERNAL'
  | 'ERR_NOT_FOUND'
  | string;

export class AppError extends Error {
  public readonly isAppError = true;
  public readonly code: ErrorCode;
  public readonly type: ErrorType;
  public readonly details?: unknown;

  constructor(code: ErrorCode, type: ErrorType, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.type = type;
    this.details = details;

    // Restore prototype chain for instanceOf check in TS/ES6
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSONString(): string {
    return JSON.stringify({
      isAppError: true,
      code: this.code,
      type: this.type,
      message: this.message,
      details: this.details,
    });
  }
}
