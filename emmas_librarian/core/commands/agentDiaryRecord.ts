const pad = (value: number): string => String(value).padStart(2, '0');

function stamp(when: Date): string {
  const day = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
  return `${day} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/**
 * The diary page with an AI agent's record added at the end: a blank line, a line with the date, the time and who
 * wrote it, and the agent's markdown. What was on the page is kept byte for byte, so the agent cannot lose text (#27).
 *
 * Usage:
 *   appendAgentRecord('Li dois artigos.', new Date(2026, 10, 15, 16, 40), 'Terminei a triagem.');
 *   // 'Li dois artigos.\n\n**2026-11-15 16:40 · registro do agente de IA**\nTerminei a triagem.'
 */
export function appendAgentRecord(page: string, when: Date, message: string): string {
  if (typeof message !== 'string' || message.trim() === '') {
    throw new Error(
      `[ERR_INVALID_ARGUMENTS] Offending value: ${JSON.stringify(message)}. Expected a non-empty markdown text.`,
    );
  }
  const record = `**${stamp(when)} · registro do agente de IA**\n${message.trim()}`;
  return page === '' ? record : `${page}\n\n${record}`;
}
