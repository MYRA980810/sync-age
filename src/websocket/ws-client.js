import WebSocket from 'ws';
import { logger } from '../shared/logger.js';

const WS_URL = 'wss://api.livecomerce.mx/ws/agent';
const MAX_RECONNECT_DELAY = 30_000;

export class LiveComerceWSClient {
  constructor(sellerId, token) {
    this.sellerId = sellerId;
    this.token = token;
    this.reconnectDelay = 1000;
    this.ws = null;
    this.messageHandlers = new Map();
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

      const handler = this.messageHandlers.get('open');
      if (handler) handler();
    });

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data);
      const handler = this.messageHandlers.get(msg.type);
      if (handler) handler(msg);
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

      const originalHandler = this.messageHandlers.get('STOCK_RESPONSE');
      this.messageHandlers.set('STOCK_RESPONSE', (msg) => {
        if (msg.sku === sku) {
          clearTimeout(timeout);
          if (originalHandler) this.messageHandlers.set('STOCK_RESPONSE', originalHandler);
          resolve(msg.stock);
        }
      });

      this.send({ type: 'STOCK_REQUEST', sku });
    });
  }

  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }
}
