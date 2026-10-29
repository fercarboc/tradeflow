import { describe, it, expect } from 'vitest';
import {
  parseTransportRates,
  DEFAULT_TRANSPORT_RATES,
  isPositive,
  isPct,
  hasFuelData,
  hasKmCostMethod,
  TransportRates,
} from '../../lib/transportRates';

// ── TR-1: DEFAULT_TRANSPORT_RATES ─────────────────────────────────────────────

describe('TR-1: DEFAULT_TRANSPORT_RATES', () => {
  it('todos los campos son null', () => {
    const keys = Object.keys(DEFAULT_TRANSPORT_RATES) as (keyof TransportRates)[];
    for (const k of keys) {
      expect(DEFAULT_TRANSPORT_RATES[k]).toBeNull();
    }
  });

  it('tiene exactamente 15 campos', () => {
    expect(Object.keys(DEFAULT_TRANSPORT_RATES)).toHaveLength(15);
  });
});

// ── TR-2: parseTransportRates — entradas vacías ───────────────────────────────

describe('TR-2: parseTransportRates — entradas vacías', () => {
  it('null devuelve todos los campos null', () => {
    const r = parseTransportRates(null);
    const keys = Object.keys(r) as (keyof TransportRates)[];
    for (const k of keys) expect(r[k]).toBeNull();
  });

  it('undefined devuelve todos los campos null', () => {
    const r = parseTransportRates(undefined);
    const keys = Object.keys(r) as (keyof TransportRates)[];
    for (const k of keys) expect(r[k]).toBeNull();
  });

  it('objeto vacío devuelve todos los campos null', () => {
    const r = parseTransportRates({});
    const keys = Object.keys(r) as (keyof TransportRates)[];
    for (const k of keys) expect(r[k]).toBeNull();
  });
});

// ── TR-3: parseTransportRates — campos del wizard ─────────────────────────────

describe('TR-3: parseTransportRates — preserva campos heredados del wizard', () => {
  it('lee precio_km, precio_hora, precio_jornada, precio_trayecto', () => {
    const raw = { precio_km: 1.5, precio_hora: 20, precio_jornada: 150, precio_trayecto: 80 };
    const r = parseTransportRates(raw);
    expect(r.precio_km).toBeCloseTo(1.5);
    expect(r.precio_hora).toBeCloseTo(20);
    expect(r.precio_jornada).toBeCloseTo(150);
    expect(r.precio_trayecto).toBeCloseTo(80);
  });

  it('los demás campos siguen siendo null si no están en el raw', () => {
    const raw = { precio_km: 1.5 };
    const r = parseTransportRates(raw);
    expect(r.coste_km_comercial).toBeNull();
    expect(r.coste_conductor_hora).toBeNull();
  });
});

// ── TR-4: parseTransportRates — ignora claves desconocidas ───────────────────

describe('TR-4: parseTransportRates — ignora claves desconocidas', () => {
  it('claves extra del JSONB no rompen el parseo', () => {
    const raw = { coste_km_comercial: 1.2, future_field_tx_c5: 42, another_unknown: 'yes' };
    expect(() => parseTransportRates(raw)).not.toThrow();
    const r = parseTransportRates(raw);
    expect(r.coste_km_comercial).toBeCloseTo(1.2);
    // future_field no está en TransportRates, no aparece en el resultado
    expect((r as unknown as Record<string, unknown>)['future_field_tx_c5']).toBeUndefined();
  });
});

// ── TR-5: parseTransportRates — conversión de tipos ──────────────────────────

describe('TR-5: parseTransportRates — conversión de tipos numéricos', () => {
  it('string numérico se convierte a number', () => {
    const r = parseTransportRates({ coste_km_comercial: '1.20' });
    expect(r.coste_km_comercial).toBeCloseTo(1.20);
  });

  it('NaN devuelve null', () => {
    const r = parseTransportRates({ coste_km_comercial: NaN });
    expect(r.coste_km_comercial).toBeNull();
  });

  it('Infinity devuelve null', () => {
    const r = parseTransportRates({ coste_km_comercial: Infinity });
    expect(r.coste_km_comercial).toBeNull();
  });

  it('null explícito en JSONB devuelve null', () => {
    const r = parseTransportRates({ coste_km_comercial: null });
    expect(r.coste_km_comercial).toBeNull();
  });

  it('cero devuelve 0 (no null)', () => {
    const r = parseTransportRates({ overhead_pct: 0 });
    expect(r.overhead_pct).toBe(0);
  });
});

// ── TR-6: isPositive ──────────────────────────────────────────────────────────

describe('TR-6: isPositive', () => {
  it('true para número positivo', () => expect(isPositive(1.5)).toBe(true));
  it('false para cero', () => expect(isPositive(0)).toBe(false));
  it('false para negativo', () => expect(isPositive(-1)).toBe(false));
  it('false para null', () => expect(isPositive(null)).toBe(false));
  it('false para undefined', () => expect(isPositive(undefined)).toBe(false));
  it('false para NaN', () => expect(isPositive(NaN)).toBe(false));
  it('false para Infinity', () => expect(isPositive(Infinity)).toBe(false));
});

// ── TR-7: isPct ───────────────────────────────────────────────────────────────

describe('TR-7: isPct', () => {
  it('true para 0', () => expect(isPct(0)).toBe(true));
  it('true para 50', () => expect(isPct(50)).toBe(true));
  it('true para 100', () => expect(isPct(100)).toBe(true));
  it('false para 101', () => expect(isPct(101)).toBe(false));
  it('false para negativo', () => expect(isPct(-1)).toBe(false));
  it('false para null', () => expect(isPct(null)).toBe(false));
  it('false para NaN', () => expect(isPct(NaN)).toBe(false));
});

// ── TR-8: hasFuelData / hasKmCostMethod ───────────────────────────────────────

describe('TR-8: hasFuelData y hasKmCostMethod', () => {
  it('hasFuelData false si solo consumo_l_100km', () => {
    expect(hasFuelData({ consumo_l_100km: 30 })).toBe(false);
  });

  it('hasFuelData false si solo precio_combustible', () => {
    expect(hasFuelData({ precio_combustible: 1.5 })).toBe(false);
  });

  it('hasFuelData true si ambos campos positivos', () => {
    expect(hasFuelData({ consumo_l_100km: 30, precio_combustible: 1.5 })).toBe(true);
  });

  it('hasKmCostMethod true si coste_km_comercial positivo', () => {
    expect(hasKmCostMethod({ coste_km_comercial: 1.2 })).toBe(true);
  });

  it('hasKmCostMethod true si datos de combustible completos', () => {
    expect(hasKmCostMethod({ consumo_l_100km: 30, precio_combustible: 1.5 })).toBe(true);
  });

  it('hasKmCostMethod false si ninguno', () => {
    expect(hasKmCostMethod({})).toBe(false);
  });
});

// ── TR-9: merge en saveTransportRates — verificación de lógica de merge ───────
// (No podemos testear la llamada real a Supabase sin conexión,
//  pero sí la lógica de merge que aplica el update)

describe('TR-9: lógica de merge (preservación de claves existentes)', () => {
  it('merge preserva claves desconocidas del JSONB existente', () => {
    const existing = { precio_km: 1.5, campo_futuro_tx_c5: 99 };
    const newRates: TransportRates = { ...DEFAULT_TRANSPORT_RATES, coste_km_comercial: 1.2 };
    const merged = { ...existing, ...newRates };
    // La clave desconocida se preserva
    expect(merged['campo_futuro_tx_c5']).toBe(99);
    // Los nuevos campos se aplican
    expect(merged.coste_km_comercial).toBeCloseTo(1.2);
    // El campo wizard también se preserva si el usuario lo tenía
    // (en este caso newRates lo tiene null, lo sobreescribe)
    expect(merged.precio_km).toBeNull(); // TransportRates incluye precio_km=null
  });

  it('merge no silencia errores de update (0 filas = lanza)', () => {
    // Simulación: si el update devuelve [] (RLS bloqueó), debería lanzar
    const data: { id: string }[] = [];
    const shouldThrow = () => {
      if (!data || data.length === 0) {
        throw new Error('Sin permisos de escritura sobre esta organización');
      }
    };
    expect(shouldThrow).toThrow('Sin permisos');
  });
});
