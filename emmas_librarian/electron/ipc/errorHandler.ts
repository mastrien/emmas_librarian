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

/**
 * Wraps an IPC handler to catch unhandled exceptions, convert them to JSON-safe AppErrors,
 * and throw them as simple native Error instances with JSON payloads.
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(handler: T): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      if (error instanceof AppError) {
        throw new Error(error.toJSONString());
      }

      // Attempt to map common raw errors or construct a generic internal error
      const message = error?.message || String(error);
      const errCode = error?.code;
      const isQuota =
        message.includes('429') || message.includes('QUOTA_EXCEEDED') || message.includes('insufficient_quota');

      if (isQuota) {
        throw new Error(new AppError('ERR_API_QUOTA_EXCEEDED', 'SYSTEM_ERROR', message).toJSONString());
      }

      if (errCode === 'SQLITE_CONSTRAINT_UNIQUE' || message.includes('UNIQUE constraint failed')) {
        throw new Error(
          new AppError(
            'ERR_DUPLICATE',
            'USER_ERROR',
            `[ERR_DUPLICATE] Violação de unicidade no banco de dados. Valor conflitante detectado. Detalhes: ${message}`
          ).toJSONString()
        );
      }

      if (errCode === 'SQLITE_BUSY' || message.includes('database is locked')) {
        throw new Error(
          new AppError(
            'ERR_DATABASE_LOCKED',
            'SYSTEM_ERROR',
            `[ERR_DATABASE_LOCKED] O banco de dados está temporariamente bloqueado. Tente novamente em instantes.`
          ).toJSONString()
        );
      }

      if (errCode?.startsWith?.('SQLITE_') || message.includes('SqliteError')) {
        throw new Error(
          new AppError(
            'ERR_DATABASE',
            'SYSTEM_ERROR',
            `[ERR_DATABASE] Erro na operação de banco de dados. Causa: ${message}`
          ).toJSONString()
        );
      }

      const appError = new AppError('ERR_INTERNAL', 'SYSTEM_ERROR', message);
      throw new Error(appError.toJSONString());
    }
  }) as T;
}
