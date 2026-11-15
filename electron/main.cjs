// Electron shell for NZB-7/24. Loads the built Vite bundle from disk.
const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');

const APP_ORIGIN_ALLOWED = true;

function createWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: '#090b0f',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The app talks to Sonarr/Radarr/SABnzbd over plain HTTP on the LAN, and
      // those services do not send CORS headers for arbitrary origins. Nothing
      // remote is ever loaded in this window (window.open goes to the system
      // browser), so the same-origin policy buys nothing here.
      webSecurity: !APP_ORIGIN_ALLOWED,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return window;
}

app.whenReady().then(() => {
  // Belt and braces for the few services that do send preflight headers.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
