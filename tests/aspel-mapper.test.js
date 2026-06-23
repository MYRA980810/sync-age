import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAspelToLiveComerce } from '../src/sync/aspel/aspel-mapper.js';

describe('mapAspelToLiveComerce', () => {
  it('maps all Aspel fields correctly', () => {
    const row = {
      CLAVE: 'BLS-001',
      DESCRIPCION: 'Blusa floral talla S',
      EXISTENCIA: 10,
      PRECIO1: 350.00,
      LINEA: 'ROPA',
      IMAGEN: 'blusa.jpg',
      ACTIVO: 1,
      UNIDAD: 'PZA'
    };

    const result = mapAspelToLiveComerce(row);

    assert.equal(result.sku, 'BLS-001');
    assert.equal(result.name, 'Blusa floral talla S');
    assert.equal(result.stock, 10);
    assert.equal(result.price, 350.00);
    assert.equal(result.category, 'ROPA');
    assert.equal(result.image_url, 'blusa.jpg');
    assert.equal(result.visibility, 'ACTIVE');
    assert.equal(result.unit, 'PZA');
  });

  it('trims whitespace from string fields', () => {
    const row = {
      CLAVE: '  BLS-001  ',
      DESCRIPCION: '  Blusa floral  ',
      EXISTENCIA: 10,
      PRECIO1: 350,
      LINEA: '  ROPA  ',
      ACTIVO: 1,
      UNIDAD: '  PZA  '
    };

    const result = mapAspelToLiveComerce(row);

    assert.equal(result.sku, 'BLS-001');
    assert.equal(result.name, 'Blusa floral');
    assert.equal(result.category, 'ROPA');
    assert.equal(result.unit, 'PZA');
  });

  it('rounds EXISTENCIA to integer', () => {
    const row = { CLAVE: 'X', DESCRIPCION: 'X', EXISTENCIA: 10.7, PRECIO1: 100, LINEA: 'A', ACTIVO: 1 };
    assert.equal(mapAspelToLiveComerce(row).stock, 11);

    row.EXISTENCIA = 10.3;
    assert.equal(mapAspelToLiveComerce(row).stock, 10);

    row.EXISTENCIA = 10.5;
    assert.equal(mapAspelToLiveComerce(row).stock, 11);
  });

  it('maps ACTIVO=1 to ACTIVE and ACTIVO=0 to DRAFT', () => {
    const active = { CLAVE: 'A', DESCRIPCION: 'A', EXISTENCIA: 1, PRECIO1: 1, LINEA: 'A', ACTIVO: 1 };
    const draft = { CLAVE: 'B', DESCRIPCION: 'B', EXISTENCIA: 1, PRECIO1: 1, LINEA: 'B', ACTIVO: 0 };

    assert.equal(mapAspelToLiveComerce(active).visibility, 'ACTIVE');
    assert.equal(mapAspelToLiveComerce(draft).visibility, 'DRAFT');
  });

  it('handles missing/null fields gracefully', () => {
    const row = {};
    const result = mapAspelToLiveComerce(row);

    assert.equal(result.sku, undefined);
    assert.equal(result.name, undefined);
    assert.equal(result.stock, 0);
    assert.equal(result.price, 0);
    assert.equal(result.category, undefined);
    assert.equal(result.image_url, null);
    assert.equal(result.visibility, 'DRAFT');
    assert.equal(result.unit, undefined);
  });

  it('TC-08: stock=0 maps correctly, not null or undefined', () => {
    const row = { CLAVE: 'BLS-003', DESCRIPCION: 'Blusa talla L', EXISTENCIA: 0, PRECIO1: 350, LINEA: 'ROPA', ACTIVO: 1 };
    const result = mapAspelToLiveComerce(row);

    assert.equal(result.stock, 0);
    assert.notEqual(result.stock, null);
    assert.notEqual(result.stock, undefined);
  });
});
