import { app, BrowserWindow, session, shell, dialog } from 'electron';
import path from 'path';

import { setupIpcHandlers } from './ipc/handlers';

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
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
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* blob: https://unpkg.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;"],
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
