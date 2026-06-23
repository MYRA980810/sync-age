import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../src/queue/schema.js';
import { QueueManager } from '../src/queue/queue-manager.js';
import { eventBus } from '../src/shared/event-bus.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('QueueManager', () => {
  let qm;

  beforeEach(() => {
    qm = new QueueManager();
    qm.db = createTestDb();
  });

  afterEach(() => {
    qm.stopProcessingLoop();
    if (qm.db) qm.db.close();
  });

  describe('enqueue (TC-05)', () => {
    it('creates PENDING items in sync_queue', () => {
      qm.enqueue({
        direction: 'TO_SERVER',
        entity_type: 'PRODUCT',
        entity_id: 'BLS-001',
        payload: JSON.stringify({ sku: 'BLS-001', stock: 10 })
      });

      const rows = qm.db.prepare('SELECT * FROM sync_queue').all();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'PENDING');
      assert.equal(rows[0].direction, 'TO_SERVER');
      assert.equal(rows[0].entity_id, 'BLS-001');
    });

    it('enqueues multiple items', () => {
      for (let i = 0; i < 3; i++) {
        qm.enqueue({
          direction: 'TO_SERVER',
          entity_type: 'STOCK',
          sku: `SKU-${i}`,
          payload: JSON.stringify({ sku: `SKU-${i}` })
        });
      }

      assert.equal(qm.getPendingCount(), 3);
    });
  });

  describe('getPendingCount (TC-05)', () => {
    it('returns correct count', () => {
      assert.equal(qm.getPendingCount(), 0);

      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });
      assert.equal(qm.getPendingCount(), 1);

      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'B', payload: '{}' });
      assert.equal(qm.getPendingCount(), 2);
    });
  });

  describe('processQueue (TC-06)', () => {
    it('moves items to PROCESSING', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });
      qm.processQueue();

      const row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.status, 'PROCESSING');
      assert.ok(row.processing_at > 0);
    });

    it('emits queue:items:ready event', () => {
      let emittedItems = null;
      eventBus.once('queue:items:ready', (items) => { emittedItems = items; });

      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });
      qm.processQueue();

      assert.ok(emittedItems);
      assert.equal(emittedItems.length, 1);
    });

    it('does nothing when queue is empty', () => {
      let emitted = false;
      eventBus.once('queue:items:ready', () => { emitted = true; });

      qm.processQueue();

      assert.equal(emitted, false);
    });
  });

  describe('markDone', () => {
    it('sets status to DONE with processed_at timestamp', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });
      qm.markDone(1);

      const row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.status, 'DONE');
      assert.ok(row.processed_at > 0);
    });
  });

  describe('markFailed', () => {
    it('increments attempts and stays PENDING under MAX_ATTEMPTS', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });

      qm.markFailed(1, 'network error');
      let row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.attempts, 1);
      assert.equal(row.status, 'PENDING');
      assert.equal(row.error_message, 'network error');

      qm.markFailed(1, 'timeout');
      row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.attempts, 2);
      assert.equal(row.status, 'PENDING');
    });

    it('sets FAILED after 5 attempts (MAX_ATTEMPTS)', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });

      for (let i = 0; i < 5; i++) {
        qm.markFailed(1, `error ${i}`);
      }

      const row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.status, 'FAILED');
      assert.equal(row.attempts, 5);
    });
  });

  describe('recoverStuckItems', () => {
    it('resets PROCESSING items older than 60s back to PENDING', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });

      const oldTimestamp = Date.now() - 120_000;
      qm.db.prepare('UPDATE sync_queue SET status = ?, processing_at = ? WHERE id = 1')
        .run('PROCESSING', oldTimestamp);

      qm.recoverStuckItems();

      const row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.status, 'PENDING');
    });

    it('does not reset recently processing items', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });

      qm.db.prepare('UPDATE sync_queue SET status = ?, processing_at = ? WHERE id = 1')
        .run('PROCESSING', Date.now());

      qm.recoverStuckItems();

      const row = qm.db.prepare('SELECT * FROM sync_queue WHERE id = 1').get();
      assert.equal(row.status, 'PROCESSING');
    });
  });

  describe('enqueueAspelChanges', () => {
    it('creates queue items and updates local_inventory', () => {
      const products = [
        { sku: 'BLS-001', name: 'Blusa S', stock: 10, price: 350, category: 'ROPA', visibility: 'ACTIVE' },
        { sku: 'COS-001', name: 'Labial', stock: 25, price: 120, category: 'COSMETICOS', visibility: 'ACTIVE' }
      ];

      qm.enqueueAspelChanges(products);

      assert.equal(qm.getPendingCount(), 2);

      const inv = qm.db.prepare('SELECT * FROM local_inventory').all();
      assert.equal(inv.length, 2);
      assert.equal(inv[0].sku, 'BLS-001');
      assert.equal(inv[0].stock, 10);
    });

    it('upserts local_inventory on duplicate sku', () => {
      const first = [{ sku: 'X', name: 'Old', stock: 5, price: 100, category: 'A', visibility: 'ACTIVE' }];
      const second = [{ sku: 'X', name: 'New', stock: 10, price: 200, category: 'B', visibility: 'DRAFT' }];

      qm.enqueueAspelChanges(first);
      qm.enqueueAspelChanges(second);

      const inv = qm.db.prepare('SELECT * FROM local_inventory WHERE sku = ?').get('X');
      assert.equal(inv.name, 'New');
      assert.equal(inv.stock, 10);
      assert.equal(inv.price, 200);
    });
  });

  describe('buildSyncStatus', () => {
    it('returns SYNCED when no pending items', () => {
      const status = qm.buildSyncStatus();
      assert.equal(status.pending, 0);
      assert.equal(status.status, 'SYNCED');
      assert.equal(status.type, 'SYNC_STATUS');
    });

    it('returns PENDING when items are queued', () => {
      qm.enqueue({ direction: 'TO_SERVER', entity_type: 'PRODUCT', entity_id: 'A', payload: '{}' });

      const status = qm.buildSyncStatus();
      assert.equal(status.pending, 1);
      assert.equal(status.status, 'PENDING');
    });
  });
});
