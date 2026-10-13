// TEMPORARY (issue #37): the smallest Electron app that opens a window. If it also crashes with the PartitionAlloc
// freelist abort on the runner, the app's own code and native modules are not involved.
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL('data:text/html,<h1>bare</h1>');
});
