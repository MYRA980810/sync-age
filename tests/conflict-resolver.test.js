import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStockConflict } from '../src/sync/conflict-resolver.js';

describe('resolveStockConflict (TC-07: MINIMUM_WINS)', () => {
  it('returns aspel stock when aspel < livecomerce', () => {
    assert.equal(resolveStockConflict(1, 2), 1);
  });

  it('returns livecomerce stock when livecomerce < aspel', () => {
    assert.equal(resolveStockConflict(5, 3), 3);
  });

  it('returns 0 when aspel=0 (never sell what does not exist)', () => {
    assert.equal(resolveStockConflict(0, 10), 0);
  });

  it('returns the value when both stocks are equal', () => {
    assert.equal(resolveStockConflict(7, 7), 7);
  });

  it('returns 0 when both are zero', () => {
    assert.equal(resolveStockConflict(0, 0), 0);
  });
});
