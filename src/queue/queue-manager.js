import { join } from 'path';
import { app } from 'electron';
import { initDatabase } from './schema.js';
import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';

const PROCESSING_TIMEOUT = 60_000;
const MAX_ATTEMPTS = 5;
const PROCESS_INTERVAL = 5_000;
const BATCH_SIZE = 50;

export class QueueManager {
  constructor() {
    this.db = null;
    this.processingTimer = null;
  }

  initialize() {
    const dbPath = join(app.getPath('userData'), 'queue.db');
    this.db = initDatabase(dbPath);
    logger.info('SQLite queue inicializada', { dbPath });
  }

  startProcessingLoop() {
    this.recoverStuckItems();

    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, PROCESS_INTERVAL);

    logger.info('Outbox processing loop iniciado', { intervalMs: PROCESS_INTERVAL });
  }

  stopProcessingLoop() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
  }

  recoverStuckItems() {
    const cutoff = Date.now() - PROCESSING_TIMEOUT;
    const result = this.db.prepare(
      'UPDATE sync_queue SET status = ? WHERE status = ? AND processing_at < ?'
    ).run('PENDING', 'PROCESSING', cutoff);

    if (result.changes > 0) {
      logger.warn('Items stuck en PROCESSING recuperados', { count: result.changes });
    }
  }

  processQueue() {
    const pending = this.db.prepare(
      'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC LIMIT ?'
    ).all('PENDING', BATCH_SIZE);

    if (pending.length === 0) return;

    for (const item of pending) {
      this.db.prepare(
        'UPDATE sync_queue SET status = ?, processing_at = ? WHERE id = ?'
      ).run('PROCESSING', Date.now(), item.id);
    }

    eventBus.emit('queue:items:ready', pending);
  }

  enqueue(item) {
    this.db.prepare(`
      INSERT INTO sync_queue (direction, entity_type, entity_id, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
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

  buildSyncStatus() {
    const pending = this.getPendingCount();
    return {
      type: 'SYNC_STATUS',
      pending,
      lastSync: Date.now(),
      status: pending === 0 ? 'SYNCED' : 'PENDING'
    };
  }

  markDone(id) {
    this.db.prepare(
      'UPDATE sync_queue SET status = ?, processed_at = ? WHERE id = ?'
    ).run('DONE', Date.now(), id);
  }

  markFailed(id, errorMessage) {
    const item = this.db.prepare('SELECT attempts FROM sync_queue WHERE id = ?').get(id);
    const newAttempts = (item?.attempts || 0) + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';

    this.db.prepare(
      'UPDATE sync_queue SET status = ?, attempts = ?, error_message = ? WHERE id = ?'
    ).run(newStatus, newAttempts, errorMessage, id);

    if (newStatus === 'FAILED') {
      logger.error('Item marcado como FAILED después de máximos intentos', { id, attempts: newAttempts });
    }
  }

  close() {
    this.stopProcessingLoop();
    if (this.db) this.db.close();
  }
}
