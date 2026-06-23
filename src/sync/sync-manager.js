import { eventBus } from '../shared/event-bus.js';
import { startAspelWatcher } from './aspel/aspel-watcher.js';
import { writeNewProductToAspel } from './aspel/aspel-writer.js';
import { LiveComerceWSClient } from '../websocket/ws-client.js';
import { QueueManager } from '../queue/queue-manager.js';
import { IdentityManager } from './identity/identity-manager.js';
import { SaleHandler } from './sale-handler.js';
import { QueueProcessor } from './queue-processor.js';
import { SquareClient } from './square/square-client.js';
import { SquareWebhookServer } from './square/square-webhook.js';
import { logger } from '../shared/logger.js';
import { SYNC_INTERVAL } from '../shared/constants.js';
import schedule from 'node-schedule';

export class SyncManager {
  constructor() {
    this.watcher = null;
    this.wsClient = null;
    this.queueManager = null;
    this.identityManager = null;
    this.saleHandler = null;
    this.queueProcessor = null;
    this.squareClient = null;
    this.webhookServer = null;
  }

  async initialize(config) {
    logger.info('Inicializando SyncManager', config);

    this.queueManager = new QueueManager();
    this.queueManager.initialize();

    this.wsClient = new LiveComerceWSClient(config.sellerId, config.token);

    this.identityManager = new IdentityManager(
      this.queueManager.db,
      config.aspel || config.square
    );

    this.saleHandler = new SaleHandler(
      this.queueManager.db,
      this.identityManager,
      this.queueManager
    );

    this.queueProcessor = new QueueProcessor(
      this.identityManager,
      this.queueManager,
      config.aspel
    );

    eventBus.on('agent:send:message', (msg) => this.wsClient.send(msg));

    eventBus.on('aspel:inventory:changed', (products) => {
      this.queueManager.enqueueAspelChanges(products);
    });

    eventBus.on('server:config:update', (msg) => {
      logger.info('Configuracion actualizada desde servidor', msg);
    });

    eventBus.on('sync:periodic', () => {
      eventBus.emit('agent:send:message', this.queueManager.buildSyncStatus());
    });

    eventBus.on('aspel:write:product', (product) => {
      const { importPath, ...productData } = product;
      writeNewProductToAspel(productData, importPath);
    });

    eventBus.on('ws:connected', () => {
      logger.info('WebSocket conectado — recuperando items stuck');
      this.queueManager.recoverStuckItems();
    });

    eventBus.on('sync:force', () => {
      logger.info('Sincronización forzada solicitada');
      this.queueManager.recoverStuckItems();
      this.queueManager.processQueue();
      eventBus.emit('sync:periodic');
    });

    if (config.square?.accessToken && config.square?.locationId) {
      this.squareClient = new SquareClient(
        config.square.accessToken,
        config.square.locationId
      );

      this.webhookServer = new SquareWebhookServer();
      this.webhookServer.start();

      eventBus.on('square:inventory:changed', (counts) => {
        for (const count of counts) {
          const row = this.queueManager.db.prepare(
            'SELECT sku FROM local_inventory WHERE pos_external_id = ?'
          ).get(count.catalog_object_id);

          if (!row) {
            logger.warn('No SKU mapping for Square catalog object', {
              catalogObjectId: count.catalog_object_id
            });
            continue;
          }

          this.queueManager.enqueue({
            direction: 'TO_SERVER',
            entity_type: 'STOCK',
            entity_id: row.sku,
            payload: JSON.stringify({
              sku: row.sku,
              stock: parseInt(count.quantity, 10),
              source: 'square',
              catalogObjectId: count.catalog_object_id,
              timestamp: Date.now()
            })
          });
        }
      });

      eventBus.on('server:online:sale', (sale) => {
        const sku = this.identityManager.getSkuByUuid(sale.uuid || sale.sku) || sale.sku;
        const row = this.queueManager.db.prepare(
          'SELECT pos_external_id FROM local_inventory WHERE sku = ?'
        ).get(sku);

        if (row?.pos_external_id) {
          this.squareClient.adjustInventory(
            row.pos_external_id,
            sale.qty,
            `LiveComerce sale ${sale.orderId}`
          ).catch((err) => {
            logger.error('Failed to adjust Square inventory', {
              sku,
              catalogObjectId: row.pos_external_id,
              err
            });
          });
        }
      });

      logger.info('Square POS integration initialized');
    }

    this.wsClient.connect();

    if (config.aspel?.exportPath) {
      this.watcher = startAspelWatcher(config.aspel.exportPath);
    }

    this.queueManager.startProcessingLoop();

    schedule.scheduleJob(`*/${SYNC_INTERVAL} * * * *`, () => {
      eventBus.emit('sync:periodic');
    });

    logger.info('SyncManager initialized');
  }

  async shutdown() {
    if (this.watcher) await this.watcher.close();
    if (this.webhookServer) this.webhookServer.stop();
    this.queueManager.stopProcessingLoop();
    logger.info('SyncManager stopped');
  }
}
