import { ipcMain } from 'electron';
import { detectAspelInstallation } from './windows-registry.js';
import { logger } from '../shared/logger.js';

export function registerIpcHandlers(mainWindow) {
  ipcMain.handle('detect-aspel', async () => {
    const result = await detectAspelInstallation();
    logger.info('Detección Aspel solicitada desde renderer', result);
    return result;
  });

  ipcMain.handle('get-sync-status', async () => {
    return {
      status: 'connected',
      pending: 0,
      lastSync: Date.now()
    };
  });

  ipcMain.handle('start-onboarding', async (event, posType) => {
    logger.info('Onboarding iniciado', { posType });
    return { success: true, posType };
  });

  ipcMain.handle('complete-onboarding', async (event, config) => {
    logger.info('Onboarding completado', config);
    return { success: true };
  });
}
