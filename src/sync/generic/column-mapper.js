const FIELD_ALIASES = {
  sku: ['sku', 'clave', 'codigo', 'code', 'ref', 'referencia', 'id'],
  name: ['nombre', 'name', 'descripcion', 'description', 'producto', 'articulo'],
  stock: ['existencia', 'stock', 'cantidad', 'qty', 'inventory', 'inventario'],
  price: ['precio', 'price', 'precio1', 'pvp', 'valor', 'costo'],
  category: ['linea', 'categoria', 'category', 'departamento', 'tipo'],
};

export function autoMapColumns(csvHeaders) {
  const mapping = {};
  const normalizedHeaders = csvHeaders.map(h =>
    h.toLowerCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
  );

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const matchIndex = normalizedHeaders.findIndex(h =>
      aliases.some(alias => h.includes(alias))
    );

    if (matchIndex !== -1) {
      mapping[field] = csvHeaders[matchIndex];
    }
  }

  return mapping;
}
