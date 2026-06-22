import XLSX from 'xlsx';
import { autoMapColumns } from './column-mapper.js';
import { logger } from '../../shared/logger.js';

export function importExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (data.length === 0) {
    logger.warn('Excel vacío', { filePath });
    return [];
  }

  const headers = Object.keys(data[0]);
  const columnMapping = autoMapColumns(headers);
  logger.info('Mapeo de columnas Excel detectado', { mapping: columnMapping });

  return data.map(row => ({
    sku: row[columnMapping.sku] ?? null,
    name: row[columnMapping.name] ?? null,
    stock: Math.round(row[columnMapping.stock] ?? 0),
    price: row[columnMapping.price] ?? 0,
    category: row[columnMapping.category] ?? null
  }));
}
