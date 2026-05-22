"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_log_1 = __importDefault(require("electron-log"));
const electron_updater_1 = require("electron-updater");
// Configure logging for auto-updater
electron_updater_1.autoUpdater.logger = electron_log_1.default;
electron_log_1.default.info('App starting...');
const handlers_1 = require("./ipc/handlers");
const isDev = process.env.NODE_ENV !== 'production' && !electron_1.app.isPackaged;
// Fix for GPU Cache creation errors in terminal
electron_1.app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
            // Disable background throttling so the renderer doesn't limit compositing
            // when the window loses focus — required for backdrop-filter (glassmorphism)
            // to remain active during resize, focus changes, and initial paint.
            backgroundThrottling: false,
        },
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.show();
            mainWindow.webContents.openDevTools();
        });
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
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
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const csp = isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* blob: https://unpkg.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;"
            : "default-src 'self' 'unsafe-inline' blob: https://unpkg.com; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;";
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
            },
        });
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
}
// Handle unhandled exceptions in the main process
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    electron_1.dialog.showErrorBox('Main Process Error', error.message || String(error));
});
electron_1.app.whenReady().then(() => {
    try {
        (0, handlers_1.setupIpcHandlers)();
        createWindow();
        // Check for updates after the app is ready and window is created
        if (!isDev) {
            electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
        }
    }
    catch (err) {
        console.error('Error during app startup:', err);
        electron_1.dialog.showErrorBox('Startup Error', err.message || String(err));
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
}).catch((err) => {
    console.error('Failed to start app:', err);
    electron_1.dialog.showErrorBox('Initialization Error', err.message || String(err));
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
