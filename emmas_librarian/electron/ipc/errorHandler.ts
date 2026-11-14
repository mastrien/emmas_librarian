import { appErrorFrom } from '../../core/errors/appErrorFrom';

/**
 * Wraps an IPC handler to catch unhandled exceptions, convert them to JSON-safe AppErrors,
 * and throw them as simple native Error instances with JSON payloads.
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(handler: T): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      throw new Error(appErrorFrom(error).toJSONString());
    }
  }) as T;
}
