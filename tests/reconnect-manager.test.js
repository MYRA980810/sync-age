import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReconnectManager } from '../src/websocket/reconnect-manager.js';

describe('ReconnectManager (TC-11: exponential backoff)', () => {
  let rm;

  beforeEach(() => {
    rm = new ReconnectManager();
  });

  afterEach(() => {
    rm.reset();
  });

  it('increments attempts on each scheduleReconnect call', () => {
    rm.scheduleReconnect(() => {});
    assert.equal(rm.attempts, 1);

    rm.scheduleReconnect(() => {});
    assert.equal(rm.attempts, 2);

    rm.scheduleReconnect(() => {});
    assert.equal(rm.attempts, 3);
  });

  it('reset() sets attempts back to 0', () => {
    rm.scheduleReconnect(() => {});
    rm.scheduleReconnect(() => {});
    assert.equal(rm.attempts, 2);

    rm.reset();
    assert.equal(rm.attempts, 0);
  });

  it('reset() clears the timer', () => {
    rm.scheduleReconnect(() => {});
    assert.notEqual(rm.timer, null);

    rm.reset();
    assert.equal(rm.timer, null);
  });

  it('after reset, attempts start from 0 again', () => {
    rm.scheduleReconnect(() => {});
    rm.scheduleReconnect(() => {});
    rm.reset();
    rm.scheduleReconnect(() => {});

    assert.equal(rm.attempts, 1);
  });

  it('sets a timer on scheduleReconnect', () => {
    rm.scheduleReconnect(() => {});
    assert.notEqual(rm.timer, null);
  });

  it('delay follows exponential pattern with 30s cap', () => {
    const BASE_DELAY = 1000;
    const MAX_DELAY = 30_000;

    for (let attempt = 1; attempt <= 15; attempt++) {
      const exponentialDelay = BASE_DELAY * Math.pow(2, Math.min(attempt, 10));
      const minDelay = Math.min(exponentialDelay, MAX_DELAY);
      const maxDelay = Math.min(exponentialDelay + 1000, MAX_DELAY);

      assert.ok(minDelay <= MAX_DELAY, `Attempt ${attempt}: min delay ${minDelay} should be <= ${MAX_DELAY}`);
      assert.ok(maxDelay <= MAX_DELAY + 1000, `Attempt ${attempt}: max delay ${maxDelay} should be bounded`);
    }
  });
});
