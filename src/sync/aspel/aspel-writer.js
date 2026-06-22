import { Builder } from 'xml2js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../../shared/logger.js';

export function writeOnlineSaleToAspel(sale, aspelImportPath) {
  const aspelXml = {
    MOVIMIENTOS: {
      MOVIMIENTO: [{
        TIPO: 'S',
        CLAVE: sale.sku,
        CANTIDAD: sale.qty,
        PRECIO: sale.price,
        FECHA: formatAspelDate(sale.timestamp),
        CONCEPTO: `Venta LiveComerce #${sale.orderId}`,
        ALMACEN: '1',
        REFERENCIA: sale.orderId
      }]
    }
  };

  const builder = new Builder();
  const xmlString = builder.buildObject(aspelXml);

  const filename = `livecomerce_${sale.orderId}_${Date.now()}.xml`;
  const outputPath = join(aspelImportPath, filename);
  writeFileSync(outputPath, xmlString, 'latin1');

  logger.info('Venta online escrita a Aspel', { orderId: sale.orderId, sku: sale.sku });
}

export function writeNewProductToAspel(product, aspelImportPath) {
  const aspelXml = {
    MOVIMIENTOS: {
      MOVIMIENTO: [{
        TIPO: 'E',
        CLAVE: product.sku,
        DESCRIPCION: product.name,
        CANTIDAD: product.stock,
        PRECIO: product.price,
        LINEA: product.category,
        CONCEPTO: product.concepto || 'Alta desde LiveComerce',
        ALMACEN: '1'
      }]
    }
  };

  const builder = new Builder();
  const xmlString = builder.buildObject(aspelXml);

  const filename = `livecomerce_new_${product.sku}_${Date.now()}.xml`;
  const outputPath = join(aspelImportPath, filename);
  writeFileSync(outputPath, xmlString, 'latin1');

  logger.info('Producto nuevo escrito a Aspel', { sku: product.sku, name: product.name });
}

function formatAspelDate(timestamp) {
  const date = new Date(timestamp);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
