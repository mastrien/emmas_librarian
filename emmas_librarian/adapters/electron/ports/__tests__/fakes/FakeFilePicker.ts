import type { FilePicker, OpenFileRequest, SaveFileRequest } from '../../FilePicker';

/**
 * The user in front of a file dialog: answers with the paths set on it (null and [] mean "cancelled")
 * and keeps what was asked.
 *
 * Usage:
 *   const picker = new FakeFilePicker();
 *   picker.savePath = '/tmp/tese.emmapcarc';
 *   await ipc.invoke(IpcChannel.SYNC_EXPORT_PROJECT, 3);
 *   expect(picker.saveRequests[0].defaultPath).toBe('projeto_3.emmapcarc');
 */
export class FakeFilePicker implements FilePicker {
  savePath: string | null = null;
  openPath: string | null = null;
  openPaths: string[] = [];
  readonly saveRequests: SaveFileRequest[] = [];
  readonly openRequests: OpenFileRequest[] = [];

  async chooseSavePath(request: SaveFileRequest): Promise<string | null> {
    this.saveRequests.push(request);
    return this.savePath;
  }

  async chooseFile(request: OpenFileRequest): Promise<string | null> {
    this.openRequests.push(request);
    return this.openPath;
  }

  async chooseFiles(request: OpenFileRequest): Promise<string[]> {
    this.openRequests.push(request);
    return this.openPaths;
  }
}
