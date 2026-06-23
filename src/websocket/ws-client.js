import WebSocket from 'ws';
import { ReconnectManager } from './reconnect-manager.js';
import { MessageTypes } from './ws-protocol.js';
import { eventBus } from '../shared/event-bus.js';
import { logger } from '../shared/logger.js';
import { WS_URL } from '../shared/constants.js';

export class LiveComerceWSClient {
  constructor(sellerId, token) {
    this.sellerId = sellerId;
    this.token = token;
    this.ws = null;
    this.reconnectManager = new ReconnectManager();
  }

  connect() {
    this.ws = new WebSocket(WS_URL, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    this.ws.on('open', () => {
      this.reconnectManager.reset();
      this.send({
        type: MessageTypes.AGENT_CONNECT,
        sellerId: this.sellerId
      });
      logger.info('WebSocket conectado');
      eventBus.emit('ws:connected');
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        this.routeMessage(msg);
      } catch (err) {
        logger.error('Mensaje WebSocket malformado', { err: err.message });
      }
    });

    this.ws.on('close', () => {
      eventBus.emit('ws:disconnected');
      this.reconnectManager.scheduleReconnect(() => this.connect());
    });

    this.ws.on('error', (err) => {
      logger.error('WebSocket error', { err: err.message });
    });
  }

  routeMessage(msg) {
    switch (msg.type) {
      case MessageTypes.ONLINE_SALE:
        eventBus.emit('server:online:sale', msg);
        break;
      case MessageTypes.STOCK_REQUEST:
        eventBus.emit('server:stock:request', msg);
        break;
      case MessageTypes.STOCK_RESPONSE:
        eventBus.emit('server:stock:response', msg);
        break;
      case MessageTypes.CONFIG_UPDATE:
        eventBus.emit('server:config:update', msg);
        break;
      case MessageTypes.NEW_PRODUCT:
        eventBus.emit('server:new:product', msg);
        break;
      case MessageTypes.DELETE_PRODUCT:
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
        if (msg.sku === sku) {
          clearTimeout(timeout);
          eventBus.off('server:stock:response', handler);
          resolve(msg.stock);
        }
      };

      eventBus.on('server:stock:response', handler);
      this.send({ type: MessageTypes.STOCK_REQUEST, sku });
    });
  }
}
