import { app, BrowserWindow, ipcMain } from 'electron';
import { initTray } from './tray.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initAutoUpdater } from './auto-updater.js';
import { detectAspelInstallation } from './windows-registry.js';
import { SyncManager } from '../sync/sync-manager.js';
import { logger } from '../shared/logger.js';

let mainWindow = null;
let syncManager = null;

app.whenReady().then(async () => {
  logger.info('LiveComerce Sync Agent iniciando...');

  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    show: false,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: new URL('../renderer/preload.js', import.meta.url).pathname
    }
  });

  mainWindow.loadFile('src/renderer/onboarding/index.html');

  initTray(mainWindow);
  registerIpcHandlers(mainWindow);
  initAutoUpdater();

  syncManager = new SyncManager();

  const aspelInfo = await detectAspelInstallation();
  if (aspelInfo.found) {
    logger.info('Aspel SAE detectado', aspelInfo);
  }

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
});

app.on('window-all-closed', () => {
  // No cerrar — el agente vive en system tray
});
