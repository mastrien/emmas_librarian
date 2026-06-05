import { app, BrowserWindow, session, shell, dialog, nativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';

// Configure logging for auto-updater
autoUpdater.logger = log;
log.info('App starting...');

import { setupIpcHandlers } from './ipc/handlers';

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

if (isDev) {
  // Use a local 'dev_data' directory in the project root during development to isolate data
  const devDataPath = path.join(process.cwd(), 'dev_data');
  app.setPath('userData', devDataPath);
}

// Fix for GPU Cache creation errors in terminal
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: nativeImage.createFromPath(path.join(__dirname, isDev ? '../public/favicon.ico' : '../dist/favicon.ico')),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#f8fafc',
      symbolColor: '#334155'
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.show();
      mainWindow.webContents.openDevTools();
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.show();
    });
  }

  // Log renderer errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Render process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Window unresponsive');
  });

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Handle unhandled exceptions in the main process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Main Process Error', error.message || String(error));
});

app.whenReady().then(() => {
  try {
    setupIpcHandlers();
    createWindow();
    
    // Check for updates after the app is ready and window is created
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  } catch (err: any) {
    console.error('Error during app startup:', err);
    dialog.showErrorBox('Startup Error', err.message || String(err));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('Failed to start app:', err);
  dialog.showErrorBox('Initialization Error', err.message || String(err));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
