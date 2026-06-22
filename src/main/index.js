import { app, BrowserWindow, ipcMain } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'path';
import { initTray } from './tray.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initAutoUpdater } from './auto-updater.js';
import { detectAspelInstallation } from './windows-registry.js';
import { getAgentToken } from '../shared/crypto.js';
import { SyncManager } from '../sync/sync-manager.js';
import { SCHEMA_SQL, PRAGMAS } from '../queue/schema.js';
import { logger } from '../shared/logger.js';

let mainWindow = null;
let syncManager = null;
let db = null;

app.whenReady().then(async () => {
  logger.info('LiveComerce Sync Agent iniciando...');

  const dbPath = join(app.getPath('userData'), 'queue.db');
  db = new Database(dbPath);
  for (const pragma of PRAGMAS) {
    db.pragma(pragma.replace('PRAGMA ', '').replace(';', ''));
  }
  db.exec(SCHEMA_SQL);

  const existingToken = getAgentToken(db);
  const needsOnboarding = !existingToken;

  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    show: needsOnboarding,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: new URL('../renderer/preload.js', import.meta.url).pathname
    }
  });

  mainWindow.loadFile('src/renderer/onboarding/index.html');

  initTray(mainWindow);
  registerIpcHandlers(mainWindow, db);
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
