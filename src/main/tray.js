import { Tray, Menu, nativeImage, app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let tray = null;

export function initTray(mainWindow) {
  const iconPath = join(__dirname, '../../build/icon.ico');
  tray = new Tray(nativeImage.createEmpty());

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
        mainWindow.webContents.send('force-sync');
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
