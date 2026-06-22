import { generateSku } from './sku-generator.js';
import { writeNewProductToAspel } from '../aspel/aspel-writer.js';
import { eventBus } from '../../shared/event-bus.js';
import { logger } from '../../shared/logger.js';

export class IdentityManager {
  constructor(db, aspelConfig) {
    this.db = db;
    this.aspelConfig = aspelConfig;
    this.registerHandlers();
  }

  registerHandlers() {
    eventBus.on('server:new:product', (msg) => this.handleNewProduct(msg));
  }

  async handleNewProduct(msg) {
    const { uuid, name, category, stock, price } = msg;

    try {
      const existing = this.db.prepare(
        'SELECT sku FROM identity_map WHERE livecomerce_uuid = ?'
      ).get(uuid);

      if (existing) {
        logger.warn('Producto ya mapeado — ignorando duplicado', { uuid, sku: existing.sku });
        return;
      }

      const sku = generateSku(this.db, category);

      this.db.prepare(
        `INSERT INTO identity_map (sku, livecomerce_uuid, origin, created_at)
         VALUES (?, ?, 'LIVE_NEW', ?)`
      ).run(sku, uuid, Date.now());

      await writeNewProductToAspel({
        sku,
        name,
        stock,
        price,
        category,
        concepto: 'Creado desde LiveComerce Live'
      }, this.aspelConfig.importPath);

      eventBus.emit('agent:send:message', {
        type: 'PRODUCT_CREATED',
        uuid,
        sku,
        timestamp: Date.now()
      });

      logger.info('Producto nuevo mapeado exitosamente', { sku, uuid });
    } catch (error) {
      logger.error('Error creando producto nuevo', { uuid, error });

      this.db.prepare(
        `INSERT INTO sync_queue (direction, entity_type, entity_id, payload, created_at)
         VALUES ('TO_ASPEL', 'PRODUCT', ?, ?, ?)`
      ).run(uuid, JSON.stringify(msg), Date.now());
    }
  }

  bulkMapFromOnboarding(mappings) {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO identity_map (sku, livecomerce_uuid, origin, created_at)
       VALUES (?, ?, 'ONBOARDING', ?)`
    );

    const insertMany = this.db.transaction((mappings) => {
      for (const m of mappings) {
        insert.run(m.sku, m.uuid, Date.now());
      }
    });

    insertMany(mappings);
    logger.info('Mapeo inicial completado', { count: mappings.length });
  }

  getUuidBySku(sku) {
    return this.db.prepare(
      'SELECT livecomerce_uuid FROM identity_map WHERE sku = ?'
    ).get(sku)?.livecomerce_uuid;
  }

  getSkuByUuid(uuid) {
    return this.db.prepare(
      'SELECT sku FROM identity_map WHERE livecomerce_uuid = ?'
    ).get(uuid)?.sku;
  }
}
