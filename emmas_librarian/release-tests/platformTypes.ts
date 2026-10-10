export interface InstallOptions {
  /** Extra arguments, e.g. --updated, the one electron-updater passes to the NSIS installer. */
  args?: string[];
  /**
   * Start the installer again once if it crashes with the access violation (Windows). Only for an install whose
   * crash is not what the test is about (the published release, or the first install of the update-flow test):
   * the build under test's installer crashing is a finding.
   */
  tolerateCrash?: boolean;
}

/**
 * What the release tests need to know and do differently per operating system: where the installed app keeps
 * its library, how it is installed and what is launched. Everything else (filling, dumping, comparing the
 * library, driving the window) is shared.
 */
export interface InstalledAppPlatform {
  /** Electron's userData folder of the installed app: its real library. */
  userData: string;
  /** The file Playwright launches. */
  appExecutable: string;
  /** electron-builder's update metadata for this platform, the first file the updater asks for. */
  updateMetadataFile: string;
  /** Extension of the file the updater downloads for this platform. */
  installerExtension: string;
  install(installer: string, options?: InstallOptions): void;
  /** Whether an app process is running that Playwright did not start (e.g. reopened after an update). */
  appIsRunning(): boolean;
  /** Asks the app to close as clicking X would. */
  askAppToClose(): void;
  forceQuitApp(): void;
}
