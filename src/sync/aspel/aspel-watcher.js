import { watch } from 'chokidar';
import { parseAspelExport } from './aspel-parser.js';
import { eventBus } from '../../shared/event-bus.js';
import { logger } from '../../shared/logger.js';

export function startAspelWatcher(exportPath) {
  const watcher = watch(exportPath, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    },
    ignored: (path, stats) => stats?.isFile() && !isAspelInventoryFile(path)
  });

  watcher.on('add', handleFileChange);
  watcher.on('change', handleFileChange);
  watcher.on('error', (err) => logger.error('Watcher error', { err }));

  return watcher;
}

async function handleFileChange(filePath) {
  logger.info('Archivo Aspel detectado', { filePath });
  const products = await parseAspelExport(filePath);
  eventBus.emit('aspel:inventory:changed', products);
}

function isAspelInventoryFile(path) {
  const name = path.split('\\').pop().toUpperCase();
  return name.includes('INVENT') && (name.endsWith('.CSV') || name.endsWith('.XML'));
}
