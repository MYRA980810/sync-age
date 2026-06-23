import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { initTray } from './tray.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { initAutoUpdater } from './auto-updater.js';
import { detectAspelInstallation } from './windows-registry.js';
import { getAgentToken } from '../shared/crypto.js';
import { SyncManager } from '../sync/sync-manager.js';
import { initDatabase } from '../queue/schema.js';
import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';

let mainWindow = null;
let syncManager = null;
let db = null;
const syncState = { wsConnected: false, lastSync: null };

app.whenReady().then(async () => {
  logger.info('LiveComerce Sync Agent iniciando...');

  const dbPath = join(app.getPath('userData'), 'queue.db');
  db = initDatabase(dbPath);

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
      sandbox: true,
      preload: new URL('../renderer/preload.js', import.meta.url).pathname
    }
  });

  mainWindow.loadFile('src/renderer/onboarding/index.html');

  initTray(mainWindow);
  registerIpcHandlers(mainWindow, db, syncState);
  initAutoUpdater();

  eventBus.on('ws:connected', () => {
    syncState.wsConnected = true;
    mainWindow.webContents.send('agent:syncUpdate', { status: 'connected' });
  });

  eventBus.on('ws:disconnected', () => {
    syncState.wsConnected = false;
    mainWindow.webContents.send('agent:syncUpdate', { status: 'disconnected' });
  });

  eventBus.on('sync:periodic', () => {
    syncState.lastSync = Date.now();
    const pending = db.prepare(
      'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?'
    ).get('PENDING').count;
    mainWindow.webContents.send('agent:syncUpdate', {
      status: syncState.wsConnected ? 'connected' : 'disconnected',
      pending,
      lastSync: syncState.lastSync
    });
  });

  syncManager = new SyncManager();

  const aspelInfo = await detectAspelInstallation();
  if (aspelInfo.found) {
    logger.info('Aspel SAE detectado', aspelInfo);
  }

  if (!needsOnboarding) {
    const sellerId = db.prepare(
      'SELECT value FROM agent_config WHERE key = ?'
    ).get('seller_id')?.value;

    await syncManager.initialize({
      sellerId,
      token: existingToken,
      aspel: aspelInfo.found
        ? { exportPath: aspelInfo.exportPath, importPath: aspelInfo.exportPath }
        : null
    });
  }

  eventBus.on('agent:authenticated', async ({ sellerId }) => {
    const token = getAgentToken(db);
    const freshAspelInfo = await detectAspelInstallation();

    await syncManager.initialize({
      sellerId,
      token,
      aspel: freshAspelInfo.found
        ? { exportPath: freshAspelInfo.exportPath, importPath: freshAspelInfo.exportPath }
        : null
    });

    mainWindow.hide();
    logger.info('SyncManager iniciado post-login');
  });

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
});

app.on('before-quit', async () => {
  if (syncManager) await syncManager.shutdown();
});

app.on('window-all-closed', () => {
  // No cerrar — el agente vive en system tray
});
