import { dialog } from 'electron';
import type { InstallingChoice } from './updateInstallGuard';

const CLOSE_AND_WAIT = 0;

export function installingDialogText(targetVersion: string): { message: string; detail: string } {
  return {
    message: `O Emma's Librarian está sendo atualizado para a v${targetVersion}.`,
    detail:
      'Abrir esta versão agora pode interromper a instalação: a atualização fica sem ser aplicada, o instalador pode ' +
      'ficar preso e, em casos que ainda não conseguimos explicar, a instalação pode ficar danificada e o app deixar ' +
      'de abrir. Há cópias de segurança da biblioteca na pasta backups/, mas o recomendado é fechar e aguardar um ou ' +
      'dois minutos: o app abre sozinho quando a instalação terminar.',
  };
}

/**
 * What to do when the old version is opened while its own installer is still working (#22). Closing is the default
 * and the way out of the dialog; opening anyway is allowed, with the risk spelled out, because an installer that
 * died (0xC0000005 on some first installs) would otherwise lock the person out for the whole window.
 * E2E_UPDATE_GUARD_CHOICE=quit|open answers for automated runs, which cannot click a native dialog.
 *
 * Usage:
 *   askWhileInstalling('1.3.0'); // 'quit' | 'open'
 */
export function askWhileInstalling(targetVersion: string, env: NodeJS.ProcessEnv = process.env): InstallingChoice {
  const forced = env.E2E_UPDATE_GUARD_CHOICE;
  if (forced === 'quit' || forced === 'open') return forced;
  const { message, detail } = installingDialogText(targetVersion);
  const clicked = dialog.showMessageBoxSync({
    type: 'warning',
    title: 'Atualização em andamento',
    message,
    detail,
    buttons: ['Fechar e aguardar', 'Abrir mesmo assim'],
    defaultId: CLOSE_AND_WAIT,
    cancelId: CLOSE_AND_WAIT,
    noLink: true,
  });
  return clicked === CLOSE_AND_WAIT ? 'quit' : 'open';
}
