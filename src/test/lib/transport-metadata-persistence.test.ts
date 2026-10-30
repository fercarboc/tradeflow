/**
 * TX-C3-B-FIX — Tests de persistencia de metadata de transporte.
 *
 * Verifica que mergeQuoteMetadata conserva correctamente la metadata
 * en todos los escenarios de creación, edición y reapertura de presupuestos.
 */

import { describe, it, expect } from 'vitest';
import {
  mergeQuoteMetadata,
  isValidTransportIntake,
  type TransportIntake,
  type TransportIntakeData,
} from '../../lib/transportVoiceIntake';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INTAKE_DATA: TransportIntakeData = {
  tipo_servicio: 'excursion',
  origen: 'Bilbao',
  destino: 'Jaca',
  fecha_servicio: '2026-11-15',
  fecha_fin_servicio: null,
  num_viajeros: 40,
  precio_base: 2000,
  precio_incluye_iva: false,
  precio_origen: 'dictado_usuario',
  itinerario: [],
  condiciones_especiales: [],
  campos_pendientes: [],
};

const TRANSPORT_INTAKE: TransportIntake = {
  schemaVersion: 1,
  vertical: 'transporte',
  intake: INTAKE_DATA,
};

const TRANSPORT_METADATA = {
  vertical: 'transporte',
  transport_intake: TRANSPORT_INTAKE,
};

// ── 1. mergeQuoteMetadata — semántica básica ──────────────────────────────────

describe('mergeQuoteMetadata — sin pending', () => {
  it('devuelve existing si pending es null', () => {
    const result = mergeQuoteMetadata(TRANSPORT_METADATA, null);
    expect(result).toEqual(TRANSPORT_METADATA);
  });

  it('devuelve existing si pending es undefined', () => {
    const result = mergeQuoteMetadata(TRANSPORT_METADATA, undefined);
    expect(result).toEqual(TRANSPORT_METADATA);
  });

  it('devuelve existing si pending está vacío', () => {
    const result = mergeQuoteMetadata(TRANSPORT_METADATA, {});
    expect(result).toEqual(TRANSPORT_METADATA);
  });

  it('devuelve undefined si existing y pending son null', () => {
    const result = mergeQuoteMetadata(null, null);
    expect(result).toBeUndefined();
  });

  it('devuelve undefined si existing está vacío y pending es null', () => {
    const result = mergeQuoteMetadata({}, null);
    expect(result).toBeUndefined();
  });
});

describe('mergeQuoteMetadata — pending prevalece', () => {
  it('pending sobre-escribe clave duplicada en existing', () => {
    const existing = { vertical: 'cleaning', otro: 'dato' };
    const pending = { vertical: 'transporte', transport_intake: TRANSPORT_INTAKE };
    const result = mergeQuoteMetadata(existing, pending);
    expect(result?.['vertical']).toBe('transporte');
    expect(result?.['otro']).toBe('dato');
    expect(result?.['transport_intake']).toBe(TRANSPORT_INTAKE);
  });

  it('preserva claves de existing no presentes en pending', () => {
    const existing = { clave_extra: 'valor', vertical: 'transporte' };
    const pending = { transport_intake: TRANSPORT_INTAKE };
    const result = mergeQuoteMetadata(existing, pending);
    expect(result?.['clave_extra']).toBe('valor');
    expect(result?.['transport_intake']).toBe(TRANSPORT_INTAKE);
  });

  it('funciona con existing null (presupuesto nuevo)', () => {
    const result = mergeQuoteMetadata(null, TRANSPORT_METADATA);
    expect(result).toEqual(TRANSPORT_METADATA);
  });

  it('funciona con existing undefined', () => {
    const result = mergeQuoteMetadata(undefined, TRANSPORT_METADATA);
    expect(result).toEqual(TRANSPORT_METADATA);
  });
});

// ── 2. Escenario: primera creación ────────────────────────────────────────────

describe('primera creación — metadata se construye desde cero', () => {
  it('metadata resultante contiene vertical y transport_intake', () => {
    const metadata = mergeQuoteMetadata(null, TRANSPORT_METADATA);
    expect(metadata?.['vertical']).toBe('transporte');
    expect(isValidTransportIntake(metadata?.['transport_intake'])).toBe(true);
  });
});

// ── 3. Escenario: edición de presupuesto con transporte ───────────────────────

describe('edición — metadata existente se preserva y enriquece', () => {
  it('datos de intake originales se mantienen si no hay cambio de pending', () => {
    const existingMeta = { ...TRANSPORT_METADATA, numero_viaje: 1 };
    const result = mergeQuoteMetadata(existingMeta, null);
    expect(result?.['numero_viaje']).toBe(1);
    expect(result?.['vertical']).toBe('transporte');
  });

  it('nuevo intake de voz reemplaza el anterior', () => {
    const nuevoIntake: TransportIntake = {
      ...TRANSPORT_INTAKE,
      intake: { ...INTAKE_DATA, precio_base: 3000 },
    };
    const pending = { vertical: 'transporte', transport_intake: nuevoIntake };
    const result = mergeQuoteMetadata(TRANSPORT_METADATA, pending);
    const intake = result?.['transport_intake'] as TransportIntake;
    expect(intake.intake.precio_base).toBe(3000);
  });
});

// ── 4. Escenario: reapertura — isValidTransportIntake ─────────────────────────

describe('reapertura — isValidTransportIntake permite restaurar estado', () => {
  it('metadata del BD pasa la validación', () => {
    expect(isValidTransportIntake(TRANSPORT_INTAKE)).toBe(true);
  });

  it('metadata guardada en BD (como Record) pasa la validación', () => {
    const fromDB = JSON.parse(JSON.stringify(TRANSPORT_INTAKE)) as unknown;
    expect(isValidTransportIntake(fromDB)).toBe(true);
  });

  it('metadata sin vertical=transporte no activa el panel', () => {
    const other = { schemaVersion: 1, vertical: 'cleaning', intake: {} };
    expect(isValidTransportIntake(other)).toBe(false);
  });

  it('metadata nula no activa el panel', () => {
    expect(isValidTransportIntake(null)).toBe(false);
    expect(isValidTransportIntake(undefined)).toBe(false);
  });
});

// ── 5. Invariante: no afecta a instaladores ───────────────────────────────────

describe('invariante — presupuestos sin transporte no generan metadata transporte', () => {
  it('mergeQuoteMetadata con pending=null y existing=null → undefined', () => {
    expect(mergeQuoteMetadata(null, null)).toBeUndefined();
  });

  it('metadata de instalador (sin vertical) no activa isValidTransportIntake', () => {
    const instaladorMeta = { tarifa: 'hora', material: 'incluido' };
    expect(isValidTransportIntake(instaladorMeta)).toBe(false);
  });
});
