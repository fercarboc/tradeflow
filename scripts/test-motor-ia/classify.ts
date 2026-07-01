import type { Partida, QuoteResponse, ClassifyResult, Category } from './types.js';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\/\-_]/g, ' ')
    .trim();
}

function coincidenOficios(detected: string, expected: string): boolean {
  const d = normalize(detected);
  const e = normalize(expected);
  if (!d || !e) return false;
  if (d.includes(e) || e.includes(d)) return true;
  // Word-level overlap for compound names like "Tejados/Cubiertas"
  const eWords = e.split(/\s+/).filter(w => w.length > 3);
  return eWords.some(w => d.includes(w));
}

export function classify(
  quote: QuoteResponse | null,
  expectedOficio: string,
  httpStatus: number,
  errorMsg?: string,
): ClassifyResult {
  if (httpStatus !== 200 || errorMsg || !quote) {
    return {
      category: 'ERROR_TECNICO',
      n_partidas: 0,
      n_catalogo: 0,
      n_sugeridas: 0,
      oficio_detectado: '',
      coincide_oficio: 'NO',
      error_detalle: errorMsg ?? `HTTP ${httpStatus}`,
    };
  }

  const partidas: Partida[] = Array.isArray(quote.partidas) ? quote.partidas : [];
  const oficioDetectado = quote.oficios_detectados?.[0]?.oficio ?? '';
  const coincideOficio: 'SI' | 'NO' = coincidenOficios(oficioDetectado, expectedOficio) ? 'SI' : 'NO';

  if (partidas.length === 0) {
    return {
      category: 'VACIO',
      n_partidas: 0,
      n_catalogo: 0,
      n_sugeridas: 0,
      oficio_detectado: oficioDetectado,
      coincide_oficio: coincideOficio,
    };
  }

  const nCatalogo = partidas.filter(p => p.origen === 'catalogo' || p.origen === 'proveedor').length;
  const nSugeridas = partidas.filter(p => p.origen === 'sugerida_ia').length;

  // Partida from catalog/supplier that has no valid price
  const hasPrecioInvalido = partidas.some(
    p =>
      (p.origen === 'catalogo' || p.origen === 'proveedor') &&
      (!p.precio_unitario || p.precio_unitario <= 0),
  );

  if (hasPrecioInvalido) {
    return {
      category: 'PRECIO_INVALIDO',
      n_partidas: partidas.length,
      n_catalogo: nCatalogo,
      n_sugeridas: nSugeridas,
      oficio_detectado: oficioDetectado,
      coincide_oficio: coincideOficio,
      error_detalle: 'Partida de catálogo con precio 0 o nulo',
    };
  }

  let category: Category;
  if (nCatalogo === partidas.length) {
    category = 'OK_CATALOGO';
  } else if (nSugeridas === partidas.length) {
    category = 'SOLO_SUGERIDAS';
  } else {
    category = 'OK_MIXTO';
  }

  return {
    category,
    n_partidas: partidas.length,
    n_catalogo: nCatalogo,
    n_sugeridas: nSugeridas,
    oficio_detectado: oficioDetectado,
    coincide_oficio: coincideOficio,
  };
}
