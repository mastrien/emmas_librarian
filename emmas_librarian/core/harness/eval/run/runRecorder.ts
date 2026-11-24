import fs from 'fs';
import path from 'path';

/**
 * Where one run is written: a folder with the configuration, one file per episode and a summary, plus one line in
 * the index of all runs. Everything is JSON so a later run can be compared with this one.
 *
 * Usage:
 *   const recorder = new RunRecorder(runsDir, '2026-11-15T18-00-00_qwen3.5-4b');
 *   recorder.writeConfig({ model, server }); recorder.writeEpisode('art-2', record); recorder.finish(summary);
 */
export class RunRecorder {
  readonly dir: string;

  constructor(
    private readonly runsDir: string,
    readonly runId: string,
  ) {
    this.dir = path.join(runsDir, runId);
    fs.mkdirSync(path.join(this.dir, 'episodes'), { recursive: true });
  }

  private write(file: string, value: unknown): void {
    fs.writeFileSync(path.join(this.dir, file), JSON.stringify(value, null, 2), 'utf-8');
  }

  writeConfig(config: unknown): void {
    this.write('config.json', config);
  }

  writeEpisode(caseId: string, episode: unknown): void {
    this.write(path.join('episodes', `${caseId}.json`), episode);
  }

  /** The server's own output, as it came. */
  writeServerLog(text: string, name = 'server.log'): void {
    fs.writeFileSync(path.join(this.dir, name), text, 'utf-8');
  }

  finish(summary: Record<string, unknown>): void {
    this.write('summary.json', summary);
    const line = JSON.stringify({ runId: this.runId, ...summary });
    fs.appendFileSync(path.join(this.runsDir, 'index.jsonl'), `${line}\n`, 'utf-8');
  }
}
