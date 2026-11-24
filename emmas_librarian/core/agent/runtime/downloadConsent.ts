import type { Prompter } from '../../cli/terminalConfirmer';
import { isYes } from '../../cli/terminalConfirmer';
import type { AgentModelFile } from './agentModels';

const GIB = 1024 ** 3;

/** The question before a download: what, how big, from where and under which license. */
export function describeDownload(model: AgentModelFile): string {
  const size = (model.sizeBytes / GIB).toFixed(2).replace('.', ',');
  return [
    `O agente local precisa baixar o modelo ${model.file} (${size} GB) de ${model.url}.`,
    `Licença: ${model.license} (${model.licenseUrl}).`,
    'Baixar agora? [s/N] ',
  ].join('\n');
}

/**
 * Asks on the terminal before each download; only an explicit yes lets it start.
 *
 * Usage:
 *   const deps = { ...rest, consent: consentOnTerminal(prompter) };
 */
export function consentOnTerminal(prompter: Prompter): (model: AgentModelFile) => Promise<boolean> {
  return async (model) => isYes(await prompter.ask(describeDownload(model)));
}
