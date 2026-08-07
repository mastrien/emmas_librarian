import { app, BrowserWindow, session, shell, dialog, nativeImage, protocol, net } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

// Configure logging for auto-updater
autoUpdater.logger = log;
log.info('App starting...');
const appStartTime = performance.now();
import { setupIpcRegistries } from './ipc/ipcRegistries';

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const isE2ETest = process.argv.some(
  (arg) => arg.includes('--remote-debugging-port') || arg.includes('--user-data-dir'),
);

if (isDev && !isE2ETest) {
  // Use a local 'dev_data' directory in the project root during development to isolate data
  const devDataPath = path.join(process.cwd(), 'dev_data');
  app.setPath('userData', devDataPath);
}

// Fix for GPU Cache creation errors in terminal
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function createBrowserWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: nativeImage.createFromPath(path.join(app.getAppPath(), isDev ? 'public/favicon.ico' : 'dist/favicon.ico')),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f8fafc',
      symbolColor: '#334155',
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
}

function loadWindowContent(window: BrowserWindow): void {
  if (isDev) {
    window.loadURL('http://localhost:5173');
    window.webContents.on('did-finish-load', () => {
      const startupTime = performance.now() - appStartTime;
      log.info(`[Performance] App initialized in ${startupTime.toFixed(2)}ms (Dev)`);
      console.log(`[Performance] App initialized in ${startupTime.toFixed(2)}ms (Dev)`);
      
      window.show();
      if (!isE2ETest) {
        window.webContents.openDevTools();
      }
    });
  } else {
    window.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    window.webContents.on('did-finish-load', () => {
      const startupTime = performance.now() - appStartTime;
      log.info(`[Performance] App initialized in ${startupTime.toFixed(2)}ms (Prod)`);
      console.log(`[Performance] App initialized in ${startupTime.toFixed(2)}ms (Prod)`);

      window.show();
    });
  }
}

function setupWindowListeners(window: BrowserWindow): void {
  window.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });
  window.webContents.on('unresponsive', () => {
    console.warn('Window unresponsive');
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function setupSessionCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' http://localhost:* ws://localhost:* blob: https://unpkg.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;"
      : "default-src 'self' blob: https://unpkg.com; script-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

function createWindow() {
  const mainWindow = createBrowserWindow();
  loadWindowContent(mainWindow);
  setupWindowListeners(mainWindow);
  setupSessionCSP();
}

// Handle unhandled exceptions in the main process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  const isTestOrHeadless =
    process.env.NODE_ENV === 'test' ||
    process.env.CI === 'true' ||
    process.env.HEADLESS_E2E === 'true' ||
    !!process.env.ANTIGRAVITY_AGENT ||
    process.argv.includes('--headless') ||
    process.argv.includes('--headless=new');
  if (isTestOrHeadless) {
    process.exit(1);
  } else {
    dialog.showErrorBox('Main Process Error', error.message || String(error));
  }
});

process.on('unhandledRejection', (reason: unknown) => {
  log.error('Unhandled Promise Rejection in Main Process:', reason);
  console.error('Unhandled Promise Rejection in Main Process:', reason);
});

app
  .whenReady()
  .then(() => {
    try {
      protocol.handle('emma-pdf', (request) => {
        const url = request.url.replace('emma-pdf://', '');
        const decodedPath = decodeURIComponent(url);
        return net.fetch(pathToFileURL(decodedPath).toString());
      });
      setupIpcRegistries();
      createWindow();

      // Check for updates after the app is ready and window is created
      if (!isDev) {
        autoUpdater.checkForUpdatesAndNotify();
      }
    } catch (err: unknown) {
      console.error('Error during app startup:', err);
      dialog.showErrorBox('Startup Error', (err as Error).message || String(err));
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((err) => {
    console.error('Failed to start app:', err);
    dialog.showErrorBox('Initialization Error', (err as Error).message || String(err));
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
