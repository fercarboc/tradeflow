/**
 * Resolución de precios de catálogo — lógica pura compartida.
 * Usada por handleApplySugerencias (cliente) y replicada en la Edge Function
 * (Deno no puede importar desde src/lib).
 *
 * NOTA: si se modifica este fichero, actualizar la copia inline en
 * supabase/functions/trade-voice-to-quote/index.ts (sección "── Price resolution").
 */

export interface TarifaLike {
  descripcion: string;
}

export interface TarifaResolvable extends TarifaLike {
  precioBase: number;
}

/**
 * Palabras genéricas (> 4 chars) que aparecen en descripciones de tarifa de cualquier oficio.
 * No pueden ser el único discriminador de un match score=1.
 */
const GENERIC_KEYWORDS = new Set([
  'oficial', 'primera', 'segunda', 'tercera', 'jornada', 'trabajo', 'laboral',
]);

/**
 * Vocabulario controlado de identificación de oficio.
 * Mapea identificadores canónicos (los mismos que usa la IA en partida.oficio)
 * a las palabras que aparecen en descripciones de tarifa de ese oficio.
 *
 * Solo incluye oficios con mayor riesgo de cross-match.
 * NO incluir sustantivos de materiales/objetos (tuberías, cables…): esos son ambiguos
 * entre oficios y son exactamente el problema que este mapa resuelve.
 */
export const OFICIO_LABEL_WORDS: Record<string, readonly string[]> = {
  fontaneria:    ['fontanería', 'fontanero', 'plomería'],
  electricidad:  ['electricidad', 'electricista'],
  pintura:       ['pintura', 'pintor'],
  albanileria:   ['albañilería', 'albañil'],
  carpinteria:   ['carpintería', 'carpintero'],
  cerrajeria:    ['cerrajería', 'cerrajero'],
  climatizacion: ['climatización', 'calefacción'],
};

/** Mapa inverso: palabra identificadora → oficio canónico. */
export const WORD_TO_OFICIO: ReadonlyMap<string, string> = new Map(
  Object.entries(OFICIO_LABEL_WORDS).flatMap(([oficio, words]) =>
    words.map(w => [w, oficio] as [string, string]),
  ),
);

/**
 * Comprueba si una tarifa (por su descripción) es compatible con un oficio canónico.
 *
 * Reglas:
 *  - Si no se proporciona oficio (o es desconocido) → compatible (conservador)
 *  - Si la tarifa no tiene ninguna palabra identificadora → compatible (sin info = no rechazar)
 *  - Si la tarifa tiene alguna palabra de un oficio DISTINTO → incompatible
 */
export function isOficioCompatible(tarifaDesc: string, conceptOficio?: string): boolean {
  if (!conceptOficio || !OFICIO_LABEL_WORDS[conceptOficio]) return true;
  const words = tarifaDesc.toLowerCase().split(/[\s,+()\/\-]+/);
  for (const word of words) {
    const tarifaOficio = WORD_TO_OFICIO.get(word);
    if (tarifaOficio && tarifaOficio !== conceptOficio) return false;
  }
  return true;
}

/**
 * Filtra una lista de items descartando los incompatibles con el oficio del concepto.
 * Items sin palabras identificadoras de oficio en su descripción se conservan siempre
 * (compatibilidad conservadora con tarifas genéricas o sin oficio explícito).
 */
export function filterCompatibleTarifas<T extends TarifaLike>(
  items: T[],
  conceptOficio?: string,
): T[] {
  if (!conceptOficio || !OFICIO_LABEL_WORDS[conceptOficio]) return items;
  return items.filter(item => isOficioCompatible(item.descripcion, conceptOficio));
}

/**
 * Extrae keywords relevantes de un texto de concepto.
 * Solo palabras de más de 4 letras para filtrar artículos y preposiciones.
 */
export function extractMatchKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,+()\/\-]+/)
    .filter(w => w.length > 4);
}

/**
 * Encuentra el mejor elemento coincidente en una lista por puntuación de keywords.
 *
 * Reglas:
 *  - Puntuación = nº de keywords del concepto que aparecen en la descripción del ítem
 *  - Puntuación ≥ 2 → match claro: devuelve el ítem con mayor puntuación
 *  - Puntuación = 1, ítem único:
 *      → rechaza si el match se logró SOLO con keywords genéricas (oficial, primera…)
 *      → acepta si hay al menos una keyword específica de oficio que coincide
 *  - Empate en puntuación → devuelve null (ambiguo)
 *  - Puntuación = 0 → null
 */
export function findBestMatch<T extends TarifaLike>(
  keywords: string[],
  items: T[],
): T | null {
  if (keywords.length === 0 || items.length === 0) return null;

  let bestScore = 0;
  let bestMatch: T | null = null;
  let tieCount = 0;

  for (const item of items) {
    const desc = item.descripcion.toLowerCase();
    const score = keywords.filter(kw => desc.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
      tieCount = 1;
    } else if (score > 0 && score === bestScore) {
      tieCount++;
    }
  }

  if (bestScore === 0) return null;
  if (bestScore >= 2) {
    if (bestMatch) {
      const desc = bestMatch.descripcion.toLowerCase();
      const matchingKws = keywords.filter(kw => desc.includes(kw));
      if (matchingKws.length > 0 && matchingKws.every(kw => GENERIC_KEYWORDS.has(kw))) return null;
    }
    return bestMatch;
  }
  if (tieCount !== 1 || !bestMatch) return null;
  const desc = bestMatch.descripcion.toLowerCase();
  const matchingKws = keywords.filter(kw => desc.includes(kw));
  if (matchingKws.length > 0 && matchingKws.every(kw => GENERIC_KEYWORDS.has(kw))) return null;
  return bestMatch;
}

/**
 * Resuelve el precio de una opción de sugerencia contra las tarifas del instalador.
 * Solo actúa sobre opciones tipo mano_de_obra.
 * Filtra tarifas incompatibles por oficio ANTES del matching.
 * Devuelve opt.precio (puede ser 0) si no hay coincidencia fiable.
 */
export function resolveOptPrice(
  opt: { descripcion: string; precio: number; tipo: 'material' | 'mano_de_obra' },
  tarifas: TarifaResolvable[],
  conceptOficio?: string,
): number {
  if (opt.tipo !== 'mano_de_obra' || tarifas.length === 0) return opt.precio;
  const kws = extractMatchKeywords(opt.descripcion);
  if (kws.length === 0) return opt.precio;
  const compatibleTarifas = filterCompatibleTarifas(tarifas, conceptOficio);
  const match = findBestMatch(kws, compatibleTarifas);
  return match ? match.precioBase : opt.precio;
}
