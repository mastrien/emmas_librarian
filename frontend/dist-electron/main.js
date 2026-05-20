"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const handlers_1 = require("./ipc/handlers");
const isDev = process.env.NODE_ENV !== 'production' && !electron_1.app.isPackaged;
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
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
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* blob: https://unpkg.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:* blob:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; worker-src 'self' blob:;"],
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
