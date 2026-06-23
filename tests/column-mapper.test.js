import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoMapColumns } from '../src/sync/generic/column-mapper.js';

describe('autoMapColumns', () => {
  it('maps Aspel headers correctly', () => {
    const headers = ['CLAVE', 'DESCRIPCION', 'EXISTENCIA', 'PRECIO1', 'LINEA'];
    const mapping = autoMapColumns(headers);

    assert.equal(mapping.sku, 'CLAVE');
    assert.equal(mapping.name, 'DESCRIPCION');
    assert.equal(mapping.stock, 'EXISTENCIA');
    assert.equal(mapping.price, 'PRECIO1');
    assert.equal(mapping.category, 'LINEA');
  });

  it('maps English headers', () => {
    const headers = ['sku', 'name', 'stock', 'price', 'category'];
    const mapping = autoMapColumns(headers);

    assert.equal(mapping.sku, 'sku');
    assert.equal(mapping.name, 'name');
    assert.equal(mapping.stock, 'stock');
    assert.equal(mapping.price, 'price');
    assert.equal(mapping.category, 'category');
  });

  it('maps Spanish variants', () => {
    const headers = ['codigo', 'nombre', 'cantidad', 'precio', 'categoria'];
    const mapping = autoMapColumns(headers);

    assert.equal(mapping.sku, 'codigo');
    assert.equal(mapping.name, 'nombre');
    assert.equal(mapping.stock, 'cantidad');
    assert.equal(mapping.price, 'precio');
    assert.equal(mapping.category, 'categoria');
  });

  it('handles accented characters (descripción maps to name)', () => {
    const headers = ['código', 'descripción', 'inventario', 'pvp', 'departamento'];
    const mapping = autoMapColumns(headers);

    assert.equal(mapping.name, 'descripción');
    assert.equal(mapping.stock, 'inventario');
    assert.equal(mapping.price, 'pvp');
    assert.equal(mapping.category, 'departamento');
  });

  it('matches case-insensitively', () => {
    const headers = ['SKU', 'Name', 'STOCK', 'Price', 'Category'];
    const mapping = autoMapColumns(headers);

    assert.equal(mapping.sku, 'SKU');
    assert.equal(mapping.name, 'Name');
    assert.equal(mapping.stock, 'STOCK');
    assert.equal(mapping.price, 'Price');
    assert.equal(mapping.category, 'Category');
  });

  it('returns empty mapping for unknown headers', () => {
    const headers = ['foo', 'bar', 'baz'];
    const mapping = autoMapColumns(headers);

    assert.deepEqual(mapping, {});
  });
});
