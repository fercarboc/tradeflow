/**
 * TX-C3-A — Tests para transportVoiceIntake.ts y validación del edge function.
 *
 * Estructura:
 *  1. Tests unitarios de las utilidades del módulo frontend.
 *  2. Guard tests que verifican invariantes del edge function (index.ts).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import {
  isValidTransportIntake,
  getTipoLabel,
  intakeHasPrefillData,
  calcularPrecioConIva,
  buildPrefillFromIntake,
  type TransportIntake,
  type TransportIntakeData,
} from '../../lib/transportVoiceIntake';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INTAKE_EXCURSION: TransportIntakeData = {
  tipo_servicio:         'excursion',
  origen:                'Santander',
  destino:               'Jaca',
  fecha_servicio:        '2026-11-15',
  fecha_fin_servicio:    null,
  num_viajeros:          45,
  precio_base:           1200,
  precio_incluye_iva:    false,
  precio_origen:         'dictado_usuario',
  itinerario:            ['Santander', 'Burgos', 'Jaca'],
  condiciones_especiales: ['Almuerzo incluido'],
  campos_pendientes:     [],
};

const INTAKE_RUTA_ESCOLAR: TransportIntakeData = {
  tipo_servicio:         'ruta_escolar',
  origen:                null,
  destino:               'Colegio San José',
  fecha_servicio:        null,
  fecha_fin_servicio:    null,
  num_viajeros:          30,
  precio_base:           null,
  precio_incluye_iva:    false,
  precio_origen:         'pendiente',
  itinerario:            [],
  condiciones_especiales: [],
  campos_pendientes:     ['origen', 'fecha_servicio', 'precio_base'],
};

const INTAKE_IVA_INCLUIDO: TransportIntakeData = {
  tipo_servicio:         'aeropuerto',
  origen:                'Hotel Bahía',
  destino:               'Aeropuerto Bilbao',
  fecha_servicio:        '2026-12-01',
  fecha_fin_servicio:    null,
  num_viajeros:          8,
  precio_base:           250,
  precio_incluye_iva:    true,
  precio_origen:         'dictado_usuario',
  itinerario:            [],
  condiciones_especiales: [],
  campos_pendientes:     [],
};

const VALID_INTAKE: TransportIntake = {
  schemaVersion: 1,
  vertical:      'transporte',
  intake:        INTAKE_EXCURSION,
};

// ── 1. isValidTransportIntake ─────────────────────────────────────────────────

describe('isValidTransportIntake', () => {
  it('acepta un intake válido', () => {
    expect(isValidTransportIntake(VALID_INTAKE)).toBe(true);
  });

  it('rechaza null', () => {
    expect(isValidTransportIntake(null)).toBe(false);
  });

  it('rechaza schemaVersion distinta de 1', () => {
    expect(isValidTransportIntake({ schemaVersion: 2, vertical: 'transporte', intake: {} })).toBe(false);
  });

  it('rechaza vertical distinta de transporte', () => {
    expect(isValidTransportIntake({ schemaVersion: 1, vertical: 'instalacion', intake: {} })).toBe(false);
  });

  it('rechaza objeto sin intake', () => {
    expect(isValidTransportIntake({ schemaVersion: 1, vertical: 'transporte' })).toBe(false);
  });
});

// ── 2. getTipoLabel ───────────────────────────────────────────────────────────

describe('getTipoLabel', () => {
  it('devuelve label para tipo conocido', () => {
    expect(getTipoLabel('excursion')).toBe('Excursión');
    expect(getTipoLabel('ruta_escolar')).toBe('Ruta escolar');
    expect(getTipoLabel('aeropuerto')).toBe('Traslado aeropuerto');
  });

  it('devuelve "—" para null', () => {
    expect(getTipoLabel(null)).toBe('—');
  });
});

// ── 3. intakeHasPrefillData ───────────────────────────────────────────────────

describe('intakeHasPrefillData', () => {
  it('true cuando tiene tipo + origen', () => {
    expect(intakeHasPrefillData(INTAKE_EXCURSION)).toBe(true);
  });

  it('true cuando tiene tipo + destino sin origen (ruta escolar)', () => {
    expect(intakeHasPrefillData(INTAKE_RUTA_ESCOLAR)).toBe(true);
  });

  it('false cuando falta tipo_servicio', () => {
    const incomplete: TransportIntakeData = { ...INTAKE_EXCURSION, tipo_servicio: null };
    expect(intakeHasPrefillData(incomplete)).toBe(false);
  });

  it('false cuando faltan origen, destino y fecha', () => {
    const incomplete: TransportIntakeData = {
      ...INTAKE_EXCURSION,
      origen: null,
      destino: null,
      fecha_servicio: null,
    };
    expect(intakeHasPrefillData(incomplete)).toBe(false);
  });
});

// ── 4. calcularPrecioConIva ───────────────────────────────────────────────────

describe('calcularPrecioConIva', () => {
  it('aplica IVA 21% cuando precio_incluye_iva=false', () => {
    expect(calcularPrecioConIva(INTAKE_EXCURSION)).toBe(1452);
  });

  it('devuelve precio_base tal cual cuando precio_incluye_iva=true', () => {
    expect(calcularPrecioConIva(INTAKE_IVA_INCLUIDO)).toBe(250);
  });

  it('devuelve null cuando precio_base es null', () => {
    expect(calcularPrecioConIva(INTAKE_RUTA_ESCOLAR)).toBeNull();
  });

  it('respeta IVA personalizado', () => {
    expect(calcularPrecioConIva(INTAKE_EXCURSION, 10)).toBe(1320);
  });
});

// ── 5. buildPrefillFromIntake ─────────────────────────────────────────────────

describe('buildPrefillFromIntake', () => {
  it('construye título origen → destino', () => {
    const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);
    expect(prefill.titulo).toBe('Santander → Jaca');
  });

  it('incluye tipo_servicio cuando es válido', () => {
    const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);
    expect(prefill.tipo_servicio).toBe('excursion');
  });

  it('incluye precio_final con IVA aplicado', () => {
    const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);
    expect(prefill.precio_final).toBe(1452);
  });

  it('mapea itinerario a array de paradas', () => {
    const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);
    expect(prefill.itinerario).toEqual([
      { nombre: 'Santander' },
      { nombre: 'Burgos' },
      { nombre: 'Jaca' },
    ]);
  });

  it('convierte condiciones_especiales a notas', () => {
    const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);
    expect(prefill.notas).toBe('Almuerzo incluido');
  });

  it('no incluye precio_final cuando precio_base es null', () => {
    const prefill = buildPrefillFromIntake(INTAKE_RUTA_ESCOLAR);
    expect(prefill.precio_final).toBeUndefined();
  });

  it('título solo destino cuando origen es null', () => {
    const prefill = buildPrefillFromIntake(INTAKE_RUTA_ESCOLAR);
    expect(prefill.titulo).toBe('Colegio San José');
  });

  it('precio_final igual a precio_base cuando IVA incluido', () => {
    const prefill = buildPrefillFromIntake(INTAKE_IVA_INCLUIDO);
    expect(prefill.precio_final).toBe(250);
  });
});

// ── 6. Guard tests del edge function (invariantes de texto) ───────────────────

const EDGE_FN_PATH = resolve(
  __dirname,
  '../../../supabase/functions/trade-voice-to-quote/index.ts',
);
const src = readFileSync(EDGE_FN_PATH, 'utf-8');

describe('edge function TX-C3-A invariants', () => {

  it('prompt_version es v59', () => {
    expect(src).toContain("prompt_version: 'v59'");
  });

  it('transport está en la lista de OFICIOS VÁLIDOS', () => {
    expect(src).toMatch(/cocina_amueblada \| transporte/);
  });

  it('SECTOR TRANSPORTE DE VIAJEROS está en el prompt', () => {
    expect(src).toContain('SECTOR TRANSPORTE DE VIAJEROS');
  });

  it('transport_intake aparece en el FORMATO DE SALIDA', () => {
    expect(src).toContain('"transport_intake": null');
  });

  it('excursion está en las OFICIO_KEYWORD_RULES', () => {
    expect(src).toMatch(/excursi\[oó\]n/);
  });

  it('ruta escolar está en las OFICIO_KEYWORD_RULES', () => {
    expect(src).toMatch(/ruta\\s\+escolar/);
  });

  it('circuito turístico está en las OFICIO_KEYWORD_RULES', () => {
    expect(src).toMatch(/circuito\\s\+tur/);
  });

  it('extractTransportIntake está definida en el edge function', () => {
    expect(src).toContain('function extractTransportIntake(');
  });

  it('TransportIntake interface definida en el edge function', () => {
    expect(src).toContain('export interface TransportIntake');
  });

  it('transport_intake incluido en la respuesta JSON', () => {
    expect(src).toContain('transport_intake: transportIntake');
  });

  it('SECTOR LIMPIEZA NO ha sido eliminado del prompt', () => {
    expect(src).toContain('SECTOR LIMPIEZA');
  });

  it('OFICIO_KEYWORD_RULES originales siguen presentes (wallbox)', () => {
    expect(src).toContain('wallbox');
  });
});
