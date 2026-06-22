import Papa from 'papaparse';
import iconv from 'iconv-lite';
import { readFileSync } from 'fs';
import { autoMapColumns } from './column-mapper.js';
import { logger } from '../../shared/logger.js';

export function importCsv(filePath, encoding = 'utf-8') {
  const rawBuffer = readFileSync(filePath);
  const csvString = encoding === 'utf-8'
    ? rawBuffer.toString('utf-8')
    : iconv.decode(rawBuffer, encoding);

  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });

  if (result.errors.length > 0) {
    logger.warn('Errores en parsing CSV', { errors: result.errors });
  }

  const columnMapping = autoMapColumns(result.meta.fields);
  logger.info('Mapeo de columnas detectado', { mapping: columnMapping });

  return result.data.map(row => ({
    sku: row[columnMapping.sku] ?? null,
    name: row[columnMapping.name] ?? null,
    stock: Math.round(row[columnMapping.stock] ?? 0),
    price: row[columnMapping.price] ?? 0,
    category: row[columnMapping.category] ?? null
  }));
}
