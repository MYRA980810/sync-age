import { eventBus } from '../shared/event-bus.js';
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

export async function reconcileOfflineChanges(db) {
  const pendingChanges = db.prepare(
    'SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC'
  ).all('PENDING');

  for (const change of pendingChanges) {
    const payload = JSON.parse(change.payload);

    if (change.entity_type === 'STOCK' && change.direction === 'TO_SERVER') {
      payload.needsConflictResolution = true;
    }

    eventBus.emit('agent:send:message', {
      type: change.entity_type,
      ...payload
    });

    db.prepare('UPDATE sync_queue SET status = ?, processed_at = ? WHERE id = ?')
      .run('DONE', Date.now(), change.id);
  }
}
