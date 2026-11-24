/** The project the person has open, when there is one. */
export interface FocusProject {
  id: number;
  name: string;
}

export interface SystemContextInput {
  today: Date;
  focusProject?: FocusProject;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** The local date as the library writes it in diary pages: 2026-11-15. */
export const isoDay = (day: Date): string => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/**
 * What a model must know that it cannot ask a tool for: today's date and the project in focus. Without the date it
 * invents one for a diary page; without the project it must list them and ask. If this grows, it becomes tools (#27).
 *
 * Usage:
 *   systemContext({ today: new Date(2026, 10, 15), focusProject: { id: 1, name: 'Revisão sobre tutoria' } });
 *   // 'Hoje é domingo, 2026-11-15.\nProjeto em foco: "Revisão sobre tutoria" (id 1).'
 */
export function systemContext({ today, focusProject }: SystemContextInput): string {
  const date = `Hoje é ${WEEKDAYS[today.getDay()]}, ${isoDay(today)}.`;
  if (!focusProject)
    return `${date}\nNenhum projeto em foco: se o pedido depender de um projeto, liste-os e pergunte qual.`;
  return `${date}\nProjeto em foco: ${JSON.stringify(focusProject.name)} (id ${focusProject.id}).`;
}
