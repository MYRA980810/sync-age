export function mapAspelToLiveComerce(aspelRow) {
  return {
    sku: aspelRow.CLAVE?.trim(),
    name: aspelRow.DESCRIPCION?.trim(),
    stock: Math.round(aspelRow.EXISTENCIA ?? 0),
    price: aspelRow.PRECIO1 ?? 0,
    category: aspelRow.LINEA?.trim(),
    image_url: aspelRow.IMAGEN?.trim() || null,
    visibility: aspelRow.ACTIVO ? 'ACTIVE' : 'DRAFT',
    unit: aspelRow.UNIDAD?.trim()
  };
}
