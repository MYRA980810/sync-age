import { logger } from '../shared/logger.js';

export function resolveStockConflict(aspelStock, livecomerceStock) {
  const resolved = Math.min(aspelStock, livecomerceStock);
  logger.info('Conflicto resuelto', {
    aspelStock,
    livecomerceStock,
    resolved,
    rule: 'MINIMUM_WINS'
  });
  return resolved;
}

export async function reconcileOfflineChanges(db, wsClient) {
  const pendingChanges = db.prepare(
    'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC'
  ).all('PENDING');

  for (const change of pendingChanges) {
    const payload = JSON.parse(change.payload);

    if (change.entity_type === 'STOCK' && change.direction === 'TO_SERVER') {
      const serverStock = await wsClient.getStock(change.entity_id);
      payload.stock = resolveStockConflict(payload.stock, serverStock);
    }

    await wsClient.send({
      type: change.entity_type,
      ...payload
    });

    db.prepare('UPDATE sync_queue SET status = ? WHERE id = ?').run('DONE', change.id);
  }
}
