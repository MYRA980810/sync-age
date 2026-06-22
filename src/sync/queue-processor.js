import { writeOnlineSaleToAspel } from './aspel/aspel-writer.js';
import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';

export class QueueProcessor {
  constructor(identityManager, queueManager, aspelConfig) {
    this.identityManager = identityManager;
    this.queueManager = queueManager;
    this.aspelConfig = aspelConfig;
    this.registerHandlers();
  }

  registerHandlers() {
    eventBus.on('queue:items:ready', (items) => this.processItems(items));
  }

  processItems(items) {
    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload);

        if (item.direction === 'TO_SERVER') {
          this.processToServer(item, payload);
        } else if (item.direction === 'TO_ASPEL') {
          this.processToAspel(item, payload);
        }

        this.queueManager.markDone(item.id);
      } catch (error) {
        logger.error('Error procesando item de cola', { id: item.id, error: error.message });
        this.queueManager.markFailed(item.id, error.message);
      }
    }
  }

  processToServer(item, payload) {
    if (payload.sku) {
      const uuid = this.identityManager.getUuidBySku(payload.sku);
      if (uuid) payload.uuid = uuid;
    }

    eventBus.emit('agent:send:message', {
      type: payload.type || item.entity_type,
      ...payload
    });
  }

  processToAspel(item, payload) {
    if (item.entity_type === 'SALE') {
      const importPath = this.aspelConfig?.importPath || this.aspelConfig?.exportPath;
      writeOnlineSaleToAspel(payload, importPath);
    }
  }
}
