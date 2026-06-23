import { Tray, Menu, nativeImage, app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { eventBus } from '../shared/event-bus.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let tray = null;

export function initTray(mainWindow) {
  const iconPath = join(__dirname, '../../build/icon.ico');
  tray = new Tray(nativeImage.createFromPath(iconPath));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Estado de sincronización',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Forzar sincronización',
      click: () => {
        eventBus.emit('sync:force');
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.exit(0);
      }
    }
  ]);

  tray.setToolTip('LiveComerce Sync Agent');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}
