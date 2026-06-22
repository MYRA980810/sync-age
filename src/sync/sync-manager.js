import { eventBus } from '../shared/event-bus.js';
import { startAspelWatcher } from './aspel/aspel-watcher.js';
import { writeOnlineSaleToAspel, writeNewProductToAspel } from './aspel/aspel-writer.js';
import { LiveComerceWSClient } from '../websocket/ws-client.js';
import { QueueManager } from '../queue/queue-manager.js';
import { IdentityManager } from './identity/identity-manager.js';
import { resolveStockConflict } from './conflict-resolver.js';
import { logger } from '../shared/logger.js';
import { SYNC_INTERVAL } from '../shared/constants.js';
import schedule from 'node-schedule';

export class SyncManager {
  constructor() {
    this.watcher = null;
    this.wsClient = null;
    this.queueManager = null;
    this.identityManager = null;
  }

  async initialize(config) {
    logger.info('Inicializando SyncManager', config);

    this.queueManager = new QueueManager();
    this.queueManager.initialize();

    this.wsClient = new LiveComerceWSClient(config.sellerId, config.token);
    this.identityManager = new IdentityManager(
      this.queueManager.db,
      this.wsClient,
      config.aspel
    );

    this.wireEvents(config);

    this.wsClient.connect();

    if (config.aspel?.exportPath) {
      this.watcher = startAspelWatcher(config.aspel.exportPath);
    }

    this.queueManager.startProcessingLoop();

    schedule.scheduleJob(`*/${SYNC_INTERVAL} * * * *`, () => {
      eventBus.emit('sync:periodic');
    });

    logger.info('SyncManager inicializado correctamente');
  }

  wireEvents(config) {
    eventBus.on('aspel:inventory:changed', async (products) => {
      await this.queueManager.enqueueAspelChanges(products);
    });

    eventBus.on('queue:items:ready', async (items) => {
      for (const item of items) {
        const payload = JSON.parse(item.payload);

        if (item.direction === 'TO_SERVER') {
          if (payload.sku) {
            const uuid = this.identityManager.getUuidBySku(payload.sku);
            if (uuid) payload.uuid = uuid;
          }
          this.wsClient.send({ type: payload.type || item.entity_type, ...payload });
        }

        if (item.direction === 'TO_ASPEL' && item.entity_type === 'SALE') {
          const sku = this.identityManager.getSkuByUuid(payload.sku) || payload.sku;
          writeOnlineSaleToAspel(
            { ...payload, sku },
            config.aspel?.importPath || config.aspel?.exportPath
          );
        }

        this.queueManager.markDone(item.id);
      }
    });

    eventBus.on('server:online:sale', async (sale) => {
      const sku = this.identityManager.getSkuByUuid(sale.uuid || sale.sku) || sale.sku;

      const localInventory = this.queueManager.db.prepare(
        'SELECT stock FROM local_inventory WHERE sku = ?'
      ).get(sku);

      if (localInventory) {
        const newStock = Math.max(0, localInventory.stock - sale.qty);
        this.queueManager.db.prepare(
          'UPDATE local_inventory SET stock = ?, last_online_at = ? WHERE sku = ?'
        ).run(newStock, Date.now(), sku);
      }

      this.queueManager.enqueue({
        direction: 'TO_ASPEL',
        entity_type: 'SALE',
        entity_id: sku,
        payload: JSON.stringify({
          orderId: sale.orderId,
          sku,
          qty: sale.qty,
          orderRef: sale.orderRef,
          price: sale.price,
          timestamp: Date.now()
        })
      });
    });

    eventBus.on('server:stock:request', async (msg) => {
      const sku = this.identityManager.getSkuByUuid(msg.sku) || msg.sku;
      const inventory = this.queueManager.db.prepare(
        'SELECT stock FROM local_inventory WHERE sku = ?'
      ).get(sku);

      this.wsClient.send({
        type: 'STOCK_RESPONSE',
        sku: msg.sku,
        stock: inventory?.stock ?? 0,
        timestamp: Date.now()
      });
    });

    eventBus.on('server:config:update', (msg) => {
      logger.info('Configuración actualizada desde servidor', msg);
    });

    eventBus.on('sync:periodic', () => {
      const pending = this.queueManager.getPendingCount();
      this.wsClient.send({
        type: 'SYNC_STATUS',
        pending,
        lastSync: Date.now(),
        status: pending === 0 ? 'SYNCED' : 'PENDING'
      });
    });

    eventBus.on('ws:connected', () => {
      logger.info('WebSocket conectado — reconciliando cambios offline');
      this.queueManager.recoverStuckItems();
    });
  }

  async shutdown() {
    if (this.watcher) await this.watcher.close();
    this.queueManager.stopProcessingLoop();
    logger.info('SyncManager detenido');
  }
}
