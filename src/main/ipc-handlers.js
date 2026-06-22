import { ipcMain } from 'electron';
import { detectAspelInstallation } from './windows-registry.js';
import { saveAgentToken, getOrCreateDeviceId } from '../shared/crypto.js';
import { logger } from '../shared/logger.js';

const AUTH_URL = 'https://api.livecomerce.mx/api/agent/auth';

export function registerIpcHandlers(mainWindow, db) {
  ipcMain.handle('agent:detectPOS', async () => {
    const result = await detectAspelInstallation();
    logger.info('Detección POS solicitada desde renderer', result);
    return result;
  });

  ipcMain.handle('agent:getStatus', async () => {
    return {
      status: 'connected',
      pending: 0,
      lastSync: Date.now()
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
