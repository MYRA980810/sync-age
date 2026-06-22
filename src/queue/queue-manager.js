import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { SCHEMA_SQL, PRAGMAS } from './schema.js';
import { logger } from '../shared/logger.js';

export class QueueManager {
  constructor() {
    this.db = null;
  }

  initialize() {
    const dbPath = join(app.getPath('userData'), 'queue.db');
    this.db = new Database(dbPath);

    for (const pragma of PRAGMAS) {
      this.db.pragma(pragma.replace('PRAGMA ', '').replace(';', ''));
    }

    this.db.exec(SCHEMA_SQL);
    logger.info('SQLite queue inicializada', { dbPath });
  }

  enqueue(item) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (direction, entity_type, entity_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.direction,
      item.entity_type || 'STOCK',
      item.entity_id || item.sku,
      typeof item.payload === 'string' ? item.payload : JSON.stringify(item),
      Date.now()
    );
  }

  enqueueAspelChanges(products) {
    const insertQueue = this.db.prepare(`
      INSERT INTO sync_queue (direction, entity_type, entity_id, payload, created_at)
      VALUES ('TO_SERVER', 'PRODUCT', ?, ?, ?)
    `);

    const upsertInventory = this.db.prepare(`
      INSERT INTO local_inventory (sku, name, stock, price, category, visibility, last_aspel_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sku) DO UPDATE SET
        name = excluded.name,
        stock = excluded.stock,
        price = excluded.price,
        category = excluded.category,
        visibility = excluded.visibility,
        last_aspel_at = excluded.last_aspel_at
    `);

    const batchInsert = this.db.transaction((products) => {
      const now = Date.now();
      for (const product of products) {
        upsertInventory.run(
          product.sku,
          product.name,
          product.stock,
          product.price,
          product.category,
          product.visibility,
          now
        );

        insertQueue.run(
          product.sku,
          JSON.stringify(product),
          now
        );
      }
    });

    batchInsert(products);
    logger.info('Cambios Aspel encolados', { count: products.length });
  }

  getPending() {
    return this.db.prepare(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC'
    ).all('PENDING');
  }

  getPendingCount() {
    return this.db.prepare(
      'SELECT COUNT(*) as count FROM sync_queue WHERE status = ?'
    ).get('PENDING').count;
  }

  markDone(id) {
    this.db.prepare(
      'UPDATE sync_queue SET status = ?, processed_at = ? WHERE id = ?'
    ).run('DONE', Date.now(), id);
  }

  markFailed(id, errorMessage) {
    this.db.prepare(
      'UPDATE sync_queue SET status = ?, attempts = attempts + 1, error_message = ? WHERE id = ?'
    ).run('FAILED', errorMessage, id);
  }

  close() {
    if (this.db) this.db.close();
  }
}
