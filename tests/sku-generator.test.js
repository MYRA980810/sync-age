import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { generateSku } from '../src/sync/identity/sku-generator.js';

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE sku_sequence (category TEXT PRIMARY KEY, last_seq INTEGER DEFAULT 0);
    INSERT INTO sku_sequence (category, last_seq) VALUES
      ('ROP', 0), ('COS', 0), ('ACC', 0), ('HOG', 0), ('GEN', 0);
  `);
  return db;
}

describe('generateSku (TC-12)', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('generates LC-ROP-000001 for first ROPA product', () => {
    const sku = generateSku(db, 'ROPA');
    assert.equal(sku, 'LC-ROP-000001');
  });

  it('increments sequence for consecutive calls', () => {
    const first = generateSku(db, 'ROPA');
    const second = generateSku(db, 'ROPA');

    assert.equal(first, 'LC-ROP-000001');
    assert.equal(second, 'LC-ROP-000002');
  });

  it('maps COSMETICOS to COS', () => {
    assert.equal(generateSku(db, 'COSMETICOS'), 'LC-COS-000001');
  });

  it('maps ACCESORIOS to ACC', () => {
    assert.equal(generateSku(db, 'ACCESORIOS'), 'LC-ACC-000001');
  });

  it('maps HOGAR to HOG', () => {
    assert.equal(generateSku(db, 'HOGAR'), 'LC-HOG-000001');
  });

  it('maps BELLEZA to COS (alias)', () => {
    assert.equal(generateSku(db, 'BELLEZA'), 'LC-COS-000001');
  });

  it('maps JOYERIA to ACC (alias)', () => {
    assert.equal(generateSku(db, 'JOYERIA'), 'LC-ACC-000001');
  });

  it('uses GEN for unknown category', () => {
    assert.equal(generateSku(db, 'DESCONOCIDO'), 'LC-GEN-000001');
  });

  it('uses GEN for null category', () => {
    assert.equal(generateSku(db, null), 'LC-GEN-000001');
  });

  it('handles case-insensitive category input', () => {
    assert.equal(generateSku(db, 'ropa'), 'LC-ROP-000001');
    assert.equal(generateSku(db, 'Cosmeticos'), 'LC-COS-000001');
  });

  it('generates format LC-{CAT}-{6 digits} with total length 13', () => {
    const sku = generateSku(db, 'ROPA');

    assert.match(sku, /^LC-[A-Z]{3}-\d{6}$/);
    assert.equal(sku.length, 13);
  });

  it('pads sequence numbers to 6 digits', () => {
    for (let i = 0; i < 99; i++) generateSku(db, 'ROPA');
    const sku100 = generateSku(db, 'ROPA');

    assert.equal(sku100, 'LC-ROP-000100');
  });
});
