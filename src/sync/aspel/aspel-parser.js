import Papa from 'papaparse';
import iconv from 'iconv-lite';
import { readFileSync } from 'fs';
import { mapAspelToLiveComerce } from './aspel-mapper.js';
import { logger } from '../../shared/logger.js';

export async function parseAspelExport(filePath) {
  const rawBuffer = readFileSync(filePath);
  const csvString = iconv.decode(rawBuffer, 'win1252');

  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter: ','
  });

  if (result.errors.length > 0) {
    logger.warn('Errores de parsing en CSV Aspel', { errors: result.errors });
  }

  return result.data.map(row => mapAspelToLiveComerce(row));
}
