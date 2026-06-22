import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';

export class SaleHandler {
  constructor(db, identityManager, queueManager) {
    this.db = db;
    this.identityManager = identityManager;
    this.queueManager = queueManager;
    this.registerHandlers();
  }

  registerHandlers() {
    eventBus.on('server:online:sale', (sale) => this.handleOnlineSale(sale));
    eventBus.on('server:stock:request', (msg) => this.handleStockRequest(msg));
  }

  handleOnlineSale(sale) {
    const sku = this.identityManager.getSkuByUuid(sale.uuid || sale.sku) || sale.sku;

    const localInventory = this.db.prepare(
      'SELECT stock FROM local_inventory WHERE sku = ?'
    ).get(sku);

    if (localInventory) {
      const newStock = Math.max(0, localInventory.stock - sale.qty);
      this.db.prepare(
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

    logger.info('Venta online procesada', { orderId: sale.orderId, sku });
  }

  handleStockRequest(msg) {
    const sku = this.identityManager.getSkuByUuid(msg.sku) || msg.sku;
    const inventory = this.db.prepare(
      'SELECT stock FROM local_inventory WHERE sku = ?'
    ).get(sku);

    eventBus.emit('agent:send:message', {
      type: 'STOCK_RESPONSE',
      sku: msg.sku,
      stock: inventory?.stock ?? 0,
      timestamp: Date.now()
    });
  }
}
