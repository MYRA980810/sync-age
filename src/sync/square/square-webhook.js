import { createServer } from 'http';
import { eventBus } from '../../shared/event-bus.js';
import { logger } from '../../shared/logger.js';

const WEBHOOK_PORT = 3847;

export class SquareWebhookServer {
  constructor() {
    this.server = null;
  }

  start() {
    this.server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/square-webhook') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const event = JSON.parse(body);
            this.handleEvent(event);
            res.writeHead(200);
            res.end('OK');
          } catch (err) {
            logger.error('Error processing Square webhook', { err });
            res.writeHead(400);
            res.end('Bad Request');
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(WEBHOOK_PORT, () => {
      logger.info('Square webhook server listening', { port: WEBHOOK_PORT });
    });
  }

  handleEvent(event) {
    if (event.type === 'inventory.count.updated') {
      logger.info('Square inventory change received', { data: event.data });
      eventBus.emit('square:inventory:changed', event.data.counts || []);
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}
