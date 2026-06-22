import { logger } from '../shared/logger.js';

const MAX_DELAY = 30_000;
const BASE_DELAY = 1000;

export class ReconnectManager {
  constructor() {
    this.attempts = 0;
    this.timer = null;
  }

  scheduleReconnect(connectFn) {
    this.attempts++;
    const exponentialDelay = BASE_DELAY * Math.pow(2, Math.min(this.attempts, 10));
    const jitter = Math.random() * 1000;
    const delay = Math.min(exponentialDelay + jitter, MAX_DELAY);

    logger.info('Reconexión programada', {
      attempt: this.attempts,
      delayMs: Math.round(delay)
    });

    this.timer = setTimeout(() => connectFn(), delay);
  }

  reset() {
    this.attempts = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
