import { IpcChannel } from '../../src/types';
import type { DatabaseAdapter } from '../database/DatabaseAdapter';
import type { CommandRegistry } from './CommandRegistry';

/**
 * Key/value application settings (API keys, RAG parameters, UI preferences).
 *
 * Usage:
 *   registerSettingsCommands(commands, db);
 */
export function registerSettingsCommands(commands: CommandRegistry, db: DatabaseAdapter): void {
  commands.add(IpcChannel.SETTINGS_GET, (key: string) => db.getSetting(key));
  commands.add(IpcChannel.SETTINGS_SET, (key: string, value: string) => db.setSetting(key, value));
}
