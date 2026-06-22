import WebSocket from 'ws';
import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';

const WS_URL = 'wss://api.livecomerce.mx/ws/agent';
const MAX_RECONNECT_DELAY = 30_000;

export class LiveComerceWSClient {
  constructor(sellerId, token) {
    this.sellerId = sellerId;
    this.token = token;
    this.reconnectDelay = 1000;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(WS_URL, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    this.ws.on('open', () => {
      this.reconnectDelay = 1000;
      this.send({
        type: 'AGENT_CONNECT',
        sellerId: this.sellerId
      });
      logger.info('WebSocket conectado');
      eventBus.emit('ws:connected');
    });

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data);
      this.routeMessage(msg);
    });

    this.ws.on('close', () => {
      const jitter = Math.random() * 1000;
      const delay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY) + jitter;
      this.reconnectDelay = delay;
      logger.info(`Reconectando en ${Math.round(delay / 1000)}s...`);
      setTimeout(() => this.connect(), delay);
    });

    this.ws.on('error', (err) => {
      logger.error('WebSocket error', { err: err.message });
    });
  }

  routeMessage(msg) {
    switch (msg.type) {
      case 'ONLINE_SALE':
        eventBus.emit('server:online:sale', msg);
        break;
      case 'STOCK_REQUEST':
        eventBus.emit('server:stock:request', msg);
        break;
      case 'CONFIG_UPDATE':
        eventBus.emit('server:config:update', msg);
        break;
      case 'NEW_PRODUCT':
        eventBus.emit('server:new:product', msg);
        break;
      case 'DELETE_PRODUCT':
        eventBus.emit('server:delete:product', msg);
        break;
      default:
        logger.warn('Mensaje WebSocket no manejado', { type: msg.type });
    }
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.warn('WebSocket no conectado — mensaje encolado', { type: message.type });
    }
  }

  async getStock(sku) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(0), 5000);

      const handler = (msg) => {
        if (msg.type === 'STOCK_RESPONSE' && msg.sku === sku) {
          clearTimeout(timeout);
          eventBus.off('server:stock:response', handler);
          resolve(msg.stock);
        }
      };

      eventBus.on('server:stock:response', handler);
      this.send({ type: 'STOCK_REQUEST', sku });
    });
  }
}
