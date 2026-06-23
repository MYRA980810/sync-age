import { ipcMain } from 'electron';
import { detectAspelInstallation } from './windows-registry.js';
import { saveAgentToken, getOrCreateDeviceId } from '../shared/crypto.js';
import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';

const AUTH_URL = 'https://api.livecomerce.mx/api/agent/auth';

export function registerIpcHandlers(mainWindow, db, syncState) {
  ipcMain.handle('agent:detectPOS', async () => {
    const result = await detectAspelInstallation();
    logger.info('Detección POS solicitada desde renderer', result);
    return result;
  });

  ipcMain.handle('agent:getStatus', async () => {
    const pending = db.prepare(
      'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?'
    ).get('PENDING').count;

    return {
      status: syncState.wsConnected ? 'connected' : 'disconnected',
      pending,
      lastSync: syncState.lastSync
    };
  });

  ipcMain.handle('agent:login', async (event, { email, password }) => {
    try {
      const deviceId = getOrCreateDeviceId(db);

      const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId })
      });

      if (!response.ok) {
        logger.warn('Autenticación fallida', { status: response.status });
        return { success: false, error: 'Correo o contraseña incorrectos' };
      }

      const data = await response.json();

      saveAgentToken(db, data.agentToken);

      db.prepare(
        'INSERT OR REPLACE INTO agent_config (key, value) VALUES (?, ?)'
      ).run('seller_id', data.sellerId);

      db.prepare(
        'INSERT OR REPLACE INTO agent_config (key, value) VALUES (?, ?)'
      ).run('store_name', data.storeName);

      logger.info('Agente autenticado exitosamente', {
        sellerId: data.sellerId,
        storeName: data.storeName,
        deviceId
      });

      eventBus.emit('agent:authenticated', { sellerId: data.sellerId });

      return {
        success: true,
        sellerId: data.sellerId,
        storeName: data.storeName
      };
    } catch (error) {
      logger.error('Error en autenticación', { error: error.message });
      return { success: false, error: 'Error de conexión' };
    }
  });
}
