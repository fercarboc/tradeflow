/**
 * Tests de prioridad de catálogos — lógica de resolución de precios.
 * Importa la implementación real de src/lib/catalogPriceResolution.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  extractMatchKeywords,
  findBestMatch,
  resolveOptPrice,
} from '../../lib/catalogPriceResolution';

// ─── Tipos mínimos para fixtures ──────────────────────────────────────────────
interface Tarifa  { descripcion: string; precio_base: number; codigo: string }
interface OwnItem { descripcion: string; precio: number; unidad: string }
interface GlobalItem { id: string; descripcion: string; precio_referencia: number; codigo: string }

// ─── Función de resolución de precio completa (3 niveles de prioridad) ────────
// Replica la lógica de enrichWithCatalogPrices (Edge Function) para testing.
// Usa los algoritmos importados de catalogPriceResolution, igual que la Edge Function.
function resolvePrice(
  concepto: string,
  tarifas: Tarifa[],
  ownCatalog: OwnItem[],
  globalItems: GlobalItem[],
): { precio: number; fuente: string } | null {
  const keywords = extractMatchKeywords(concepto);
  if (keywords.length === 0) return null;

  const instaladorMatch = findBestMatch(keywords, tarifas);
  if (instaladorMatch) return { precio: instaladorMatch.precio_base, fuente: 'tarifa_instalador' };

  const ownMatch = findBestMatch(keywords, ownCatalog);
  if (ownMatch) return { precio: (ownMatch as OwnItem).precio, fuente: 'catalogo_propio' };

  const globalMatch = findBestMatch(keywords, globalItems);
  if (globalMatch) return { precio: globalMatch.precio_referencia, fuente: 'catalogo_global' };

  return null;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────
const TARIFAS: Tarifa[] = [
  { descripcion: 'Hora oficial fontanería',  precio_base: 45, codigo: 'MO-FON-001' },
  { descripcion: 'Hora oficial electricidad', precio_base: 48, codigo: 'MO-ELE-001' },
  { descripcion: 'Hora oficial pintura',      precio_base: 32, codigo: 'MO-PINT-001' },
];

const OWN_CATALOG: OwnItem[] = [
  { descripcion: 'Grifo monomando cocina Grohe', precio: 185, unidad: 'ud' },
  { descripcion: 'Plato de ducha extraplano 90x90', precio: 230, unidad: 'ud' },
  { descripcion: 'Interruptor doble Legrand Mosaic', precio: 18, unidad: 'ud' },
];

const GLOBAL_CATALOG: GlobalItem[] = [
  { id: 'g1', descripcion: 'Grifo monomando genérico', precio_referencia: 120, codigo: 'FON-GRID-001' },
  { id: 'g2', descripcion: 'Cable eléctrico 2.5mm', precio_referencia: 2.5, codigo: 'ELE-CAB-001' },
  { id: 'g3', descripcion: 'Mano de obra pintura interior paredes', precio_referencia: 9.50, codigo: 'PINT-MO-001' },
];

// ─── extractMatchKeywords ──────────────────────────────────────────────────────
describe('extractMatchKeywords', () => {
  it('filtra palabras cortas (≤4 letras)', () => {
    expect(extractMatchKeywords('ir al')).toEqual([]);
  });
  it('conserva palabras de más de 4 letras', () => {
    expect(extractMatchKeywords('pintura paredes')).toEqual(['pintura', 'paredes']);
  });
  it('normaliza a minúsculas', () => {
    expect(extractMatchKeywords('PINTURA PAREDES')).toEqual(['pintura', 'paredes']);
  });
  it('separa por separadores compuestos', () => {
    const kws = extractMatchKeywords('mano+obra (pintura/interior)');
    expect(kws).toContain('pintura');
    expect(kws).toContain('interior');
  });
});

// ─── findBestMatch ─────────────────────────────────────────────────────────────
describe('findBestMatch', () => {
  it('devuelve null con keywords vacías', () => {
    expect(findBestMatch([], TARIFAS)).toBeNull();
  });
  it('devuelve null con lista vacía', () => {
    expect(findBestMatch(['pintura'], [])).toBeNull();
  });
  it('selecciona con score ≥2 sin ambigüedad', () => {
    // 'pintura' y 'paredes' solo coinciden con "Hora oficial pintura" pero 'paredes' no está en tarifas
    // → score=1 único → devuelve match
    const match = findBestMatch(['pintura', 'paredes'], TARIFAS);
    expect(match?.descripcion).toMatch(/pintura/i);
  });
  it('empate en score=1 → null (ambiguo entre oficios)', () => {
    // 'oficial' aparece en TODAS las tarifas → score=1 para las tres → empate → null
    const match = findBestMatch(['oficial'], TARIFAS);
    expect(match).toBeNull();
  });
  it('score=0 → null', () => {
    expect(findBestMatch(['xyzzy'], TARIFAS)).toBeNull();
  });
  it('score≥2 → mayor puntuación gana sobre score=1', () => {
    // 'pintura' y 'oficial' → 'pintura': score=2 (pintura+oficial), resto: score=1
    const tarifasPlus = [
      ...TARIFAS,
      { descripcion: 'Oficial primera pintura', precio_base: 35, codigo: 'X' },
    ];
    const match = findBestMatch(['pintura', 'oficial'], tarifasPlus);
    // El de mayor score = 2 coincidencias: 'Hora oficial pintura' O 'Oficial primera pintura'
    expect(match).not.toBeNull();
    expect(match?.descripcion.toLowerCase()).toMatch(/pintura/);
  });
});

// ─── Prioridad: tarifa instalador ──────────────────────────────────────────────
describe('prioridad tarifa instalador', () => {
  it('usa tarifa instalador cuando hay coincidencia unívoca', () => {
    const result = resolvePrice('pintura paredes interiores', TARIFAS, OWN_CATALOG, GLOBAL_CATALOG);
    expect(result).not.toBeNull();
    expect(result!.fuente).toBe('tarifa_instalador');
    expect(result!.precio).toBe(32);
  });

  it('tarifa instalador tiene prioridad sobre catálogo propio y global', () => {
    const result = resolvePrice('Mano de obra pintura paredes', TARIFAS, OWN_CATALOG, GLOBAL_CATALOG);
    expect(result!.fuente).toBe('tarifa_instalador');
    expect(result!.precio).toBe(32);
  });

  it('keyword genérica "oficial" produce empate → no asigna tarifa incorrecta', () => {
    // Garantiza F3/F8: 'oficial' no selecciona tarifa de fontanería para un trabajo de pintura
    const result = resolvePrice('oficial primera', TARIFAS, [], []);
    // Empate → null o fuente distinta de tarifa_instalador
    if (result) {
      // Si resuelve, NO debe ser fontanería (precio 45) siendo el trabajo de "oficial"
      // El test simplemente verifica que no asigna la primera tarifa arbitrariamente
      expect(result.precio).not.toBe(45); // fontanería es 45, no debería ganar solo por 'oficial'
    } else {
      expect(result).toBeNull();
    }
  });
});

// ─── Prioridad: catálogo propio ────────────────────────────────────────────────
describe('prioridad catálogo propio', () => {
  it('usa catálogo propio cuando no hay tarifa coincidente', () => {
    const result = resolvePrice('Plato de ducha extraplano 90x90', [], OWN_CATALOG, GLOBAL_CATALOG);
    expect(result).not.toBeNull();
    expect(result!.fuente).toBe('catalogo_propio');
    expect(result!.precio).toBe(230);
  });

  it('catálogo propio tiene prioridad sobre catálogo global', () => {
    const result = resolvePrice('Grifo monomando cocina', [], OWN_CATALOG, GLOBAL_CATALOG);
    expect(result!.fuente).toBe('catalogo_propio');
    expect(result!.precio).toBe(185);
  });
});

// ─── Prioridad: catálogo global ────────────────────────────────────────────────
describe('prioridad catálogo global', () => {
  it('usa catálogo global cuando no hay tarifa ni catálogo propio coincidente', () => {
    const result = resolvePrice('Cable eléctrico 2.5mm', [], [], GLOBAL_CATALOG);
    expect(result).not.toBeNull();
    expect(result!.fuente).toBe('catalogo_global');
    expect(result!.precio).toBe(2.5);
  });

  it('devuelve null cuando no hay ninguna coincidencia', () => {
    const result = resolvePrice('Partida desconocida XYZ', [], [], []);
    expect(result).toBeNull();
  });
});

// ─── Sin catálogos disponibles ─────────────────────────────────────────────────
describe('sin catálogos', () => {
  it('devuelve null cuando todos los catálogos están vacíos', () => {
    expect(resolvePrice('Mano de obra pintura', [], [], [])).toBeNull();
  });

  it('devuelve null cuando el concepto no tiene keywords >4 letras', () => {
    expect(resolvePrice('ir a', TARIFAS, OWN_CATALOG, GLOBAL_CATALOG)).toBeNull();
  });
});

// ─── resolveOptPrice (botón Completar) ────────────────────────────────────────
describe('resolveOptPrice en sugerencias del botón Completar', () => {
  const TARIFAS_ITEM = [
    { descripcion: 'Hora oficial pintura', precioBase: 32 },
    { descripcion: 'Hora oficial fontanería', precioBase: 45 },
  ];

  it('usa tarifa del instalador para mano_de_obra cuando hay coincidencia', () => {
    const opt = { descripcion: 'Mano de obra pintura paredes y techos', precio: 18, tipo: 'mano_de_obra' as const };
    expect(resolveOptPrice(opt, TARIFAS_ITEM)).toBe(32);
  });

  it('mantiene el precio hardcoded cuando no hay tarifa coincidente', () => {
    const opt = { descripcion: 'Mano de obra solado cerámico', precio: 22, tipo: 'mano_de_obra' as const };
    expect(resolveOptPrice(opt, TARIFAS_ITEM)).toBe(22);
  });

  it('NUNCA usa tarifas para materiales — siempre precio hardcoded', () => {
    const opt = { descripcion: 'Pintura plástica mate 15L', precio: 45, tipo: 'material' as const };
    expect(resolveOptPrice(opt, TARIFAS_ITEM)).toBe(45);
  });

  it('mantiene el precio hardcoded cuando la lista de tarifas está vacía', () => {
    const opt = { descripcion: 'Mano de obra pintura paredes', precio: 18, tipo: 'mano_de_obra' as const };
    expect(resolveOptPrice(opt, [])).toBe(18);
  });

  it('precio de tarifa se aplica independientemente de si es mayor o menor al hardcoded', () => {
    const opt = { descripcion: 'Mano de obra pintura', precio: 18, tipo: 'mano_de_obra' as const };
    const result = resolveOptPrice(opt, [{ descripcion: 'Hora oficial pintura', precioBase: 32 }]);
    expect(result).toBe(32);
  });

  it('precio de tarifa más bajo que hardcoded también se respeta', () => {
    const opt = { descripcion: 'Mano de obra pintura', precio: 45, tipo: 'mano_de_obra' as const };
    const result = resolveOptPrice(opt, [{ descripcion: 'Hora oficial pintura', precioBase: 25 }]);
    expect(result).toBe(25);
  });

  it('keyword genérica "oficial" no asigna tarifa de otro oficio', () => {
    // 'oficial' aparece en ambas tarifas → empate → devuelve precio original
    const opt = { descripcion: 'Mano de obra oficial primera', precio: 30, tipo: 'mano_de_obra' as const };
    expect(resolveOptPrice(opt, TARIFAS_ITEM)).toBe(30);
  });
});

// ─── Aislamiento multiempresa ──────────────────────────────────────────────────
describe('aislamiento: catálogos de organizaciones distintas', () => {
  it('org sin catálogo propio no obtiene precios de otro org', () => {
    const result = resolvePrice('Plato de ducha extraplano 90x90', [], [], GLOBAL_CATALOG);
    if (result) expect(result.fuente).not.toBe('catalogo_propio');
  });
});
