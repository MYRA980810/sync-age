import { eventBus } from '../shared/event-bus.js';
import { startAspelWatcher } from './aspel/aspel-watcher.js';
import { LiveComerceWSClient } from '../websocket/ws-client.js';
import { QueueManager } from '../queue/queue-manager.js';
import { IdentityManager } from './identity/identity-manager.js';
import { SaleHandler } from './sale-handler.js';
import { QueueProcessor } from './queue-processor.js';
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
  }

  async initialize(config) {
    logger.info('Inicializando SyncManager', config);

    this.queueManager = new QueueManager();
    this.queueManager.initialize();

    this.wsClient = new LiveComerceWSClient(config.sellerId, config.token);

    this.identityManager = new IdentityManager(
      this.queueManager.db,
      config.aspel
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
      const pending = this.queueManager.getPendingCount();
      this.wsClient.send({
        type: 'SYNC_STATUS',
        pending,
        lastSync: Date.now(),
        status: pending === 0 ? 'SYNCED' : 'PENDING'
      });
    });

    eventBus.on('ws:connected', () => {
      logger.info('WebSocket conectado — recuperando items stuck');
      this.queueManager.recoverStuckItems();
    });

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

  async shutdown() {
    if (this.watcher) await this.watcher.close();
    this.queueManager.stopProcessingLoop();
    logger.info('SyncManager detenido');
  }
}
