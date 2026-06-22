import { autoUpdater } from 'electron-updater';
import { logger } from '../shared/logger.js';

export function initAutoUpdater() {
  autoUpdater.logger = logger;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
  autoUpdater.checkForUpdates();

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Actualización descargada', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Error en auto-update', { err });
  });
}
