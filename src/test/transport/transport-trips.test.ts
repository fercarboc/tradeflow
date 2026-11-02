/**
 * TX-MC-1 — transportTrips: FSM, vehicle validation, UI helpers
 *
 * Pure logic tests — no DOM, no Supabase calls.
 * SQL-layer tests (EXCLUDE constraints, cross-table overlap, RPC) are
 * deferred pending Docker / remote migration availability.
 */

import { describe, it, expect } from 'vitest';
import {
  validateTripInput,
  getTripEstadoMeta,
  isTripEditable,
  canConfirmTrip,
  canStartTrip,
  canCompleteTrip,
  canCancelTrip,
  TIPO_CARGA_OPTIONS,
  TRIP_ESTADOS,
  TIPO_CARGA_COLORS,
} from '../../lib/transportTrips';
import type { TradeTransportTripInput, TripEstado, TipoCarga } from '../../lib/transportTrips';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<TradeTransportTripInput> = {}): TradeTransportTripInput {
  return {
    titulo: 'Viaje de prueba',
    origen: 'Madrid',
    destino: 'Barcelona',
    fecha_inicio: '2026-11-10T08:00:00Z',
    fecha_fin: '2026-11-10T18:00:00Z',
    tipo_carga: 'carga_general',
    estado: 'borrador',
    ...overrides,
  };
}

// ── TC-1: validateTripInput — campos obligatorios ─────────────────────────────

describe('TC-1: validateTripInput — campos obligatorios', () => {
  it('acepta input mínimo válido', () => {
    expect(() => validateTripInput(makeInput())).not.toThrow();
  });

  it('rechaza título vacío', () => {
    expect(() => validateTripInput(makeInput({ titulo: '' }))).toThrow('título');
  });

  it('rechaza título solo espacios', () => {
    expect(() => validateTripInput(makeInput({ titulo: '   ' }))).toThrow('título');
  });

  it('rechaza origen vacío', () => {
    expect(() => validateTripInput(makeInput({ origen: '' }))).toThrow('origen');
  });

  it('rechaza destino vacío', () => {
    expect(() => validateTripInput(makeInput({ destino: '' }))).toThrow('destino');
  });

  it('rechaza fecha_fin anterior a fecha_inicio', () => {
    expect(() => validateTripInput(makeInput({
      fecha_inicio: '2026-11-10T18:00:00Z',
      fecha_fin:    '2026-11-10T08:00:00Z',
    }))).toThrow('posterior');
  });

  it('rechaza fecha_fin igual a fecha_inicio', () => {
    expect(() => validateTripInput(makeInput({
      fecha_inicio: '2026-11-10T08:00:00Z',
      fecha_fin:    '2026-11-10T08:00:00Z',
    }))).toThrow('posterior');
  });

  it('acepta fecha_fin null (viaje sin hora llegada)', () => {
    expect(() => validateTripInput(makeInput({ fecha_fin: null }))).not.toThrow();
  });

  it('rechaza peso_kg negativo', () => {
    expect(() => validateTripInput(makeInput({ peso_kg: -1 }))).toThrow('peso');
  });

  it('rechaza peso_kg superior a 50.000', () => {
    expect(() => validateTripInput(makeInput({ peso_kg: 50001 }))).toThrow('peso');
  });

  it('acepta peso_kg dentro del rango', () => {
    expect(() => validateTripInput(makeInput({ peso_kg: 24000 }))).not.toThrow();
  });

  it('rechaza precio_acordado negativo', () => {
    expect(() => validateTripInput(makeInput({ precio_acordado: -100 }))).toThrow('negativo');
  });

  it('acepta precio_acordado = 0', () => {
    expect(() => validateTripInput(makeInput({ precio_acordado: 0 }))).not.toThrow();
  });
});

// ── TC-2: Catálogos — tipos de carga ─────────────────────────────────────────

describe('TC-2: catálogo TIPO_CARGA_OPTIONS', () => {
  const values = TIPO_CARGA_OPTIONS.map(t => t.value);

  it('contiene paletizado', () => expect(values).toContain('paletizado'));
  it('contiene carga_general', () => expect(values).toContain('carga_general'));
  it('contiene frigorifica', () => expect(values).toContain('frigorifica'));
  it('contiene peligrosas', () => expect(values).toContain('peligrosas'));
  it('contiene especial', () => expect(values).toContain('especial'));
  it('contiene otro', () => expect(values).toContain('otro'));
  it('tiene 6 tipos', () => expect(TIPO_CARGA_OPTIONS.length).toBe(6));

  it('cada tipo tiene su color en TIPO_CARGA_COLORS', () => {
    for (const { value } of TIPO_CARGA_OPTIONS) {
      expect(TIPO_CARGA_COLORS[value]).toBeDefined();
    }
  });
});

// ── TC-3: Catálogos — estados ─────────────────────────────────────────────────

describe('TC-3: catálogo TRIP_ESTADOS', () => {
  const values = TRIP_ESTADOS.map(e => e.value);

  it('contiene borrador',   () => expect(values).toContain('borrador'));
  it('contiene confirmado', () => expect(values).toContain('confirmado'));
  it('contiene en_curso',   () => expect(values).toContain('en_curso'));
  it('contiene completado', () => expect(values).toContain('completado'));
  it('contiene cancelado',  () => expect(values).toContain('cancelado'));
  it('tiene 5 estados', () => expect(TRIP_ESTADOS.length).toBe(5));

  it('cada estado tiene label y color', () => {
    for (const e of TRIP_ESTADOS) {
      expect(e.label).toBeTruthy();
      expect(e.color).toMatch(/bg-/);
    }
  });
});

// ── TC-4: getTripEstadoMeta ───────────────────────────────────────────────────

describe('TC-4: getTripEstadoMeta', () => {
  it('devuelve meta de borrador', () => {
    const m = getTripEstadoMeta('borrador');
    expect(m.value).toBe('borrador');
    expect(m.label).toBeTruthy();
  });

  it('devuelve meta de completado (color purple)', () => {
    const m = getTripEstadoMeta('completado');
    expect(m.color).toMatch(/purple/);
  });

  it('devuelve meta de cancelado (color red)', () => {
    const m = getTripEstadoMeta('cancelado');
    expect(m.color).toMatch(/red/);
  });
});

// ── TC-5: FSM — isTripEditable ────────────────────────────────────────────────

describe('TC-5: isTripEditable', () => {
  it('borrador es editable',   () => expect(isTripEditable('borrador')).toBe(true));
  it('confirmado es editable', () => expect(isTripEditable('confirmado')).toBe(true));
  it('en_curso no es editable', () => expect(isTripEditable('en_curso')).toBe(false));
  it('completado no es editable', () => expect(isTripEditable('completado')).toBe(false));
  it('cancelado no es editable',  () => expect(isTripEditable('cancelado')).toBe(false));
});

// ── TC-6: FSM — transiciones permitidas ──────────────────────────────────────

describe('TC-6: transiciones FSM (UI helpers)', () => {
  it('borrador puede confirmarse',     () => expect(canConfirmTrip('borrador')).toBe(true));
  it('confirmado no puede confirmarse', () => expect(canConfirmTrip('confirmado')).toBe(false));
  it('en_curso no puede confirmarse',  () => expect(canConfirmTrip('en_curso')).toBe(false));

  it('confirmado puede iniciarse',     () => expect(canStartTrip('confirmado')).toBe(true));
  it('borrador no puede iniciarse',    () => expect(canStartTrip('borrador')).toBe(false));
  it('en_curso no puede iniciarse',    () => expect(canStartTrip('en_curso')).toBe(false));

  it('en_curso puede completarse',     () => expect(canCompleteTrip('en_curso')).toBe(true));
  it('confirmado no puede completarse',() => expect(canCompleteTrip('confirmado')).toBe(false));
  it('borrador no puede completarse',  () => expect(canCompleteTrip('borrador')).toBe(false));

  it('borrador puede cancelarse',      () => expect(canCancelTrip('borrador')).toBe(true));
  it('confirmado puede cancelarse',    () => expect(canCancelTrip('confirmado')).toBe(true));
  it('en_curso puede cancelarse',      () => expect(canCancelTrip('en_curso')).toBe(true));
  it('completado no puede cancelarse', () => expect(canCancelTrip('completado')).toBe(false));
  it('cancelado no puede cancelarse',  () => expect(canCancelTrip('cancelado')).toBe(false));
});

// ── TC-7: FSM — secuencia completa ───────────────────────────────────────────

describe('TC-7: secuencia FSM completa', () => {
  it('flujo nominal: borrador → confirmado → en_curso → completado', () => {
    // borrador
    expect(canConfirmTrip('borrador')).toBe(true);
    expect(isTripEditable('borrador')).toBe(true);
    // confirmado
    expect(canStartTrip('confirmado')).toBe(true);
    expect(canConfirmTrip('confirmado')).toBe(false);
    // en_curso
    expect(canCompleteTrip('en_curso')).toBe(true);
    expect(canStartTrip('en_curso')).toBe(false);
    // completado
    expect(isTripEditable('completado')).toBe(false);
    expect(canCancelTrip('completado')).toBe(false);
    expect(canCompleteTrip('completado')).toBe(false);
  });

  it('flujo cancelación desde confirmado', () => {
    expect(canCancelTrip('confirmado')).toBe(true);
    expect(canCancelTrip('cancelado')).toBe(false);
  });
});

// ── TC-8: Validación de fechas multiday ──────────────────────────────────────

describe('TC-8: fechas multiday (viajes largos)', () => {
  it('acepta viaje de 3 días', () => {
    expect(() => validateTripInput(makeInput({
      fecha_inicio: '2026-11-10T08:00:00Z',
      fecha_fin:    '2026-11-13T18:00:00Z',
    }))).not.toThrow();
  });

  it('acepta viaje con fecha_fin null (duración abierta)', () => {
    expect(() => validateTripInput(makeInput({
      fecha_inicio: '2026-11-10T08:00:00Z',
      fecha_fin: null,
    }))).not.toThrow();
  });
});

// ── TC-9: tipos de carga específicos de mercancías ───────────────────────────

describe('TC-9: tipos de carga — cobertura', () => {
  const cargas: TipoCarga[] = ['paletizado', 'carga_general', 'frigorifica', 'peligrosas', 'especial', 'otro'];

  for (const carga of cargas) {
    it(`input con tipo_carga='${carga}' es válido`, () => {
      expect(() => validateTripInput(makeInput({ tipo_carga: carga }))).not.toThrow();
    });
  }
});

// ── TC-10: campos opcionales de carga ─────────────────────────────────────────

describe('TC-10: campos opcionales de carga', () => {
  it('acepta viaje sin peso (mercancía sin especificar)', () => {
    expect(() => validateTripInput(makeInput({ peso_kg: null }))).not.toThrow();
  });

  it('acepta viaje sin volumen', () => {
    expect(() => validateTripInput(makeInput({ volumen_m3: null }))).not.toThrow();
  });

  it('acepta viaje sin bultos', () => {
    expect(() => validateTripInput(makeInput({ num_bultos: null }))).not.toThrow();
  });

  it('acepta viaje con todos los campos de carga', () => {
    expect(() => validateTripInput(makeInput({
      peso_kg: 5000,
      volumen_m3: 20,
      num_bultos: 120,
    }))).not.toThrow();
  });
});
