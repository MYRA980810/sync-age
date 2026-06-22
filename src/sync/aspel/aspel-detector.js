import { detectAspelInstallation } from '../../main/windows-registry.js';
import { logger } from '../../shared/logger.js';

export async function detectAspel() {
  const result = await detectAspelInstallation();

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
