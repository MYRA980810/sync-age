const CATEGORY_CODES = {
  'ROPA': 'ROP',
  'COSMETICOS': 'COS',
  'ACCESORIOS': 'ACC',
  'HOGAR': 'HOG',
  'BELLEZA': 'COS',
  'JOYERIA': 'ACC',
};

export function generateSku(db, category) {
  const catCode = CATEGORY_CODES[category?.toUpperCase()] ?? 'GEN';

  const generateInTransaction = db.transaction(() => {
    const row = db.prepare(
      'UPDATE sku_sequence SET last_seq = last_seq + 1 WHERE category = ? RETURNING last_seq'
    ).get(catCode);

    if (!row) {
      db.prepare('INSERT INTO sku_sequence (category, last_seq) VALUES (?, 1)').run(catCode);
      return `LC-${catCode}-000001`;
    }

    const seq = String(row.last_seq).padStart(6, '0');
    return `LC-${catCode}-${seq}`;
  });

  return generateInTransaction();
}
