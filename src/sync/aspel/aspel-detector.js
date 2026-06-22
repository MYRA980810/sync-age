import { logger } from '../../shared/logger.js';

export async function detectAspel(detectFn) {
  const result = await detectFn();

  if (result.found) {
    logger.info('Aspel SAE detectado', {
      version: result.version,
      installPath: result.installPath,
      exportPath: result.exportPath
    });
  } else {
    logger.info('Aspel SAE no detectado en este equipo');
  }

  return result;
}
