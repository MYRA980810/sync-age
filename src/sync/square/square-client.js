import { logger } from '../../shared/logger.js';

const SQUARE_BASE_URL = 'https://connect.squareup.com/v2';

export class SquareClient {
  constructor(accessToken, locationId) {
    this.accessToken = accessToken;
    this.locationId = locationId;
  }

  async request(method, endpoint, body = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${SQUARE_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      logger.error('Square API error', { endpoint, status: response.status, errors: data.errors });
      throw new Error(`Square API error: ${response.status}`);
    }

    return data;
  }

  async getCatalog() {
    const data = await this.request('GET', '/catalog/list?types=ITEM');
    return data.objects || [];
  }

  async getInventoryCounts(catalogObjectIds) {
    const data = await this.request('POST', '/inventory/counts/batch-retrieve', {
      catalog_object_ids: catalogObjectIds,
      location_ids: [this.locationId]
    });
    return data.counts || [];
  }

  async adjustInventory(catalogObjectId, quantity, reason) {
    return this.request('POST', '/inventory/adjustments/create', {
      idempotency_key: `lc-${Date.now()}`,
      adjustment: {
        type: 'SALE',
        catalog_object_id: catalogObjectId,
        location_id: this.locationId,
        quantity: String(quantity),
        occurred_at: new Date().toISOString()
      }
    });
  }
}
