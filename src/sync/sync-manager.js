import { startAspelWatcher } from './aspel/aspel-watcher.js';
import { LiveComerceWSClient } from '../websocket/ws-client.js';
import { QueueManager } from '../queue/queue-manager.js';
import { IdentityManager } from './identity/identity-manager.js';
import { reconcileOfflineChanges } from './conflict-resolver.js';
import { logger } from '../shared/logger.js';
import { SYNC_INTERVAL, WS_URL } from '../shared/constants.js';
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
    this.wsClient.connect();

    this.identityManager = new IdentityManager(
      this.queueManager.db,
      this.wsClient,
      config.aspel
    );

    if (config.aspel?.exportPath) {
      this.watcher = startAspelWatcher(config.aspel.exportPath);
    }

    this.wsClient.on('ONLINE_SALE', (msg) => this.handleOnlineSale(msg));
    this.wsClient.on('STOCK_REQUEST', (msg) => this.handleStockRequest(msg));
    this.wsClient.on('CONFIG_UPDATE', (msg) => this.handleConfigUpdate(msg));

    schedule.scheduleJob(`*/${SYNC_INTERVAL} * * * *`, () => this.periodicSync());

    this.wsClient.on('open', () => {
      reconcileOfflineChanges(this.queueManager.db, this.wsClient);
    });

    logger.info('SyncManager inicializado correctamente');
  }

  async handleOnlineSale(msg) {
    const { orderId, sku, qty, orderRef } = msg;
    logger.info('Venta online recibida', { orderId, sku, qty });

    const aspelSku = this.identityManager.getSkuByUuid(sku) || sku;

    const localInventory = this.queueManager.db.prepare(
      'SELECT stock FROM local_inventory WHERE sku = ?'
    ).get(aspelSku);

    if (localInventory) {
      const newStock = localInventory.stock - qty;
      this.queueManager.db.prepare(
        'UPDATE local_inventory SET stock = ?, last_online_at = ? WHERE sku = ?'
      ).run(Math.max(0, newStock), Date.now(), aspelSku);
    }

    this.queueManager.enqueue({
      direction: 'TO_ASPEL',
      entity_type: 'SALE',
      entity_id: aspelSku,
      payload: JSON.stringify({ orderId, sku: aspelSku, qty, orderRef, timestamp: Date.now() })
    });
  }

  async handleStockRequest(msg) {
    const { sku } = msg;
    const aspelSku = this.identityManager.getSkuByUuid(sku) || sku;

    const inventory = this.queueManager.db.prepare(
      'SELECT stock FROM local_inventory WHERE sku = ?'
    ).get(aspelSku);

    this.wsClient.send({
      type: 'STOCK_RESPONSE',
      sku,
      stock: inventory?.stock ?? 0,
      timestamp: Date.now()
    });
  }

  handleConfigUpdate(msg) {
    logger.info('Configuración actualizada desde servidor', msg);
  }

  async periodicSync() {
    logger.info('Sincronización periódica iniciada');
    const pending = this.queueManager.getPendingCount();

    this.wsClient.send({
      type: 'SYNC_STATUS',
      pending,
      lastSync: Date.now(),
      status: pending === 0 ? 'SYNCED' : 'PENDING'
    });
  }

  async shutdown() {
    if (this.watcher) await this.watcher.close();
    logger.info('SyncManager detenido');
  }
}
