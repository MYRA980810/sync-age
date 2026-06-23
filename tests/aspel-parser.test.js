import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { parseAspelExport } from '../src/sync/aspel/aspel-parser.js';

const TEST_CSV = resolve('data/INVENT_TEST.CSV');

describe('parseAspelExport', () => {
  it('parses the 8 mock products from INVENT_TEST.CSV', async () => {
    const products = await parseAspelExport(TEST_CSV);
    assert.equal(products.length, 8);
  });

  it('returns mapped products with correct fields', async () => {
    const products = await parseAspelExport(TEST_CSV);
    const first = products[0];

    assert.equal(first.sku, 'BLS-001');
    assert.equal(first.name, 'Blusa floral talla S');
    assert.equal(first.stock, 10);
    assert.equal(first.price, 350);
    assert.equal(first.category, 'ROPA');
    assert.equal(first.visibility, 'ACTIVE');
  });

  it('TC-09: handles Windows-1252 encoding (accented characters)', async () => {
    const products = await parseAspelExport(TEST_CSV);
    const cafe = products.find(p => p.sku === 'ACC-001');

    assert.ok(cafe, 'ACC-001 should exist');
    assert.ok(cafe.name.includes('café'), `Expected name to contain "café", got "${cafe.name}"`);
  });

  it('identifies 7 active and 1 draft product', async () => {
    const products = await parseAspelExport(TEST_CSV);
    const active = products.filter(p => p.visibility === 'ACTIVE');
    const draft = products.filter(p => p.visibility === 'DRAFT');

    assert.equal(active.length, 7);
    assert.equal(draft.length, 1);
    assert.equal(draft[0].sku, 'DRAFT-001');
  });

  it('maps zero stock correctly (BLS-003)', async () => {
    const products = await parseAspelExport(TEST_CSV);
    const zeroStock = products.find(p => p.sku === 'BLS-003');

    assert.ok(zeroStock);
    assert.equal(zeroStock.stock, 0);
  });
});
