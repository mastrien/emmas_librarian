import type { ErrorType, FrontendAppError } from '../../../utils/AppError';

// What each code says to the person; an unknown code reads as ERR_INTERNAL.
const errorTranslations: Record<string, { title: string; message: string }> = {
  ERR_MISSING_API_KEY: {
    title: 'Chave de API Ausente',
    message: 'Você precisa configurar uma chave de API nas Configurações do projeto para usar essa funcionalidade.',
  },
  ERR_MODEL_NOT_DEFINED: {
    title: 'Modelo não Definido',
    message:
      'Você precisa selecionar qual modelo deseja usar para esta funcionalidade. Vá até as Configurações de IA e defina um modelo.',
  },
  ERR_INVALID_PDF: {
    title: 'Arquivo PDF Inválido',
    message:
      'O sistema não conseguiu ler este arquivo PDF. Ele pode estar corrompido, protegido por senha ou sem formato de texto válido.',
  },
  ERR_API_QUOTA_EXCEEDED: {
    title: 'Cota de Uso Excedida',
    message:
      'Você atingiu o limite de uso da sua chave de API ou não há saldo suficiente na sua conta (ex: OpenAI/Anthropic).',
  },
  ERR_API_UNAUTHORIZED: {
    title: 'Chave de API Inválida',
    message: 'A chave configurada parece estar incorreta ou foi revogada pelo provedor.',
  },
  ERR_NOT_FOUND: {
    title: 'Recurso Não Encontrado',
    message: 'O item solicitado não existe mais no banco de dados.',
  },
  ERR_API_CONNECTION: {
    title: 'Falha de Conexão com IA',
    message:
      'Não foi possível conectar ao provedor de Inteligência Artificial. Verifique sua conexão com a internet ou se o serviço local (ex: Ollama) está rodando.',
  },
  ERR_INTERNAL: {
    title: 'Falha no Sistema',
    message: "Ocorreu um problema inesperado no Emma's Librarian.",
  },
};

/** What the error window shows for one error. */
export interface AppErrorView {
  code: string;
  type: ErrorType;
  title: string;
  message: string;
  /** A person can act on it (warning tone); otherwise the system failed (danger tone). */
  isUserError: boolean;
  rawMessage: string;
  stack?: string;
  details: unknown;
}

const isAppError = (error: unknown): error is FrontendAppError =>
  typeof error === 'object' && error !== null && 'isAppError' in error;

/**
 * Reads any thrown value as the error window needs it: a typed app error keeps its code and type, anything else is
 * an internal system failure.
 *
 * @example appErrorView(new Error('x')).title // 'Falha no Sistema'
 */
export function appErrorView(error: unknown): AppErrorView {
  const app = isAppError(error) ? error : null;
  const code = app?.code ?? 'ERR_INTERNAL';
  const type: ErrorType = app?.type ?? 'SYSTEM_ERROR';
  const translation = errorTranslations[code] || errorTranslations['ERR_INTERNAL'];
  const plain = error as { message?: unknown; stack?: string } | null;
  return {
    code,
    type,
    ...translation,
    isUserError: type === 'USER_ERROR' || type === 'VALIDATION_ERROR',
    rawMessage: app ? app.message : String(plain?.message || error),
    stack: plain?.stack,
    details: app ? app.details : null,
  };
}

/**
 * The text "Copiar Logs" puts on the clipboard.
 *
 * @example technicalReport(view) // 'Type: SYSTEM_ERROR\nCode: ERR_INTERNAL\n…'
 */
export function technicalReport(view: AppErrorView): string {
  return `Type: ${view.type}\nCode: ${view.code}\nMessage: ${view.rawMessage}\nStack: ${view.stack}`;
}
