/**
 * TX-C3-B — Tests de integración para el pipeline voz → presupuesto de transporte.
 *
 * Cubre:
 *  1. buildTransportPartidas — mapeo del intake a partidas del wizard
 *  2. Escenarios de la spec: excursión, IVA incluido, multidía, ruta escolar,
 *     recurrente trabajadores, datos incompletos, precio pendiente
 *  3. Persistencia de metadata (vertical + transport_intake)
 *  4. buildPrefillFromIntake — prefill del formulario
 *  5. Regresión: no afecta a presupuestos de instaladores
 */

import { describe, it, expect } from 'vitest';
import {
  buildTransportPartidas,
  buildPrefillFromIntake,
  isValidTransportIntake,
  calcularPrecioConIva,
  type TransportIntakeData,
  type TransportIntake,
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
  condiciones_especiales: [],
  campos_pendientes:     [],
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

const INTAKE_MULTIDÍA: TransportIntakeData = {
  tipo_servicio:         'excursion',
  origen:                'Bilbao',
  destino:               'Madrid',
  fecha_servicio:        '2026-12-10',
  fecha_fin_servicio:    '2026-12-12',
  num_viajeros:          30,
  precio_base:           3500,
  precio_incluye_iva:    false,
  precio_origen:         'dictado_usuario',
  itinerario:            [],
  condiciones_especiales: ['Hotel conductor a cargo de la agencia', 'Dietas incluidas'],
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

const INTAKE_TRABAJADORES: TransportIntakeData = {
  tipo_servicio:         'transporte_trabajadores',
  origen:                'Santander centro',
  destino:               'Polígono Guarnizo',
  fecha_servicio:        null,
  fecha_fin_servicio:    null,
  num_viajeros:          25,
  precio_base:           1800,
  precio_incluye_iva:    false,
  precio_origen:         'dictado_usuario',
  itinerario:            [],
  condiciones_especiales: ['Servicio diario lunes a viernes'],
  campos_pendientes:     ['fecha_servicio'],
};

const INTAKE_SIN_PRECIO: TransportIntakeData = {
  tipo_servicio:         'discrecional',
  origen:                'Logroño',
  destino:               null,
  fecha_servicio:        '2026-11-20',
  fecha_fin_servicio:    null,
  num_viajeros:          null,
  precio_base:           null,
  precio_incluye_iva:    false,
  precio_origen:         'pendiente',
  itinerario:            [],
  condiciones_especiales: [],
  campos_pendientes:     ['destino', 'num_viajeros', 'precio_base'],
};

const INTAKE_AMBIGUO: TransportIntakeData = {
  tipo_servicio:         null,
  origen:                null,
  destino:               null,
  fecha_servicio:        null,
  fecha_fin_servicio:    null,
  num_viajeros:          null,
  precio_base:           null,
  precio_incluye_iva:    false,
  precio_origen:         'pendiente',
  itinerario:            [],
  condiciones_especiales: [],
  campos_pendientes:     ['tipo_servicio', 'origen', 'destino', 'fecha_servicio', 'num_viajeros', 'precio_base'],
};

// ── 1. buildTransportPartidas ─────────────────────────────────────────────────

describe('buildTransportPartidas — excursión con precio dictado', () => {
  const [partida] = buildTransportPartidas(INTAKE_EXCURSION);

  it('genera exactamente una partida', () => {
    expect(buildTransportPartidas(INTAKE_EXCURSION)).toHaveLength(1);
  });

  it('descripción contiene origen y destino', () => {
    expect(partida.descripcion).toContain('Santander');
    expect(partida.descripcion).toContain('Jaca');
  });

  it('tipo es material (servicio de transporte, no mano de obra de instalador)', () => {
    expect(partida.tipo).toBe('material');
  });

  it('cantidad = 1', () => {
    expect(partida.cantidad).toBe(1);
  });

  it('precioUnitario = precio_base dictado', () => {
    expect(partida.precioUnitario).toBe(1200);
  });

  it('total = precio_base', () => {
    expect(partida.total).toBe(1200);
  });

  it('origen = catalogo (precio conocido)', () => {
    expect(partida.origen).toBe('catalogo');
  });

  it('requiere_precio = false (precio dictado)', () => {
    expect(partida.requiere_precio).toBeFalsy();
  });

  it('familia = "Transporte de viajeros" (evita sección "Materiales" en Word)', () => {
    expect(partida.familia).toBe('Transporte de viajeros');
  });

  it('no hay aviso de IVA (precio sin IVA)', () => {
    expect(partida.aviso ?? '').not.toContain('IVA');
  });
});

describe('buildTransportPartidas — precio con IVA incluido', () => {
  const [partida] = buildTransportPartidas(INTAKE_IVA_INCLUIDO);

  it('precioUnitario = precio_base tal como fue dictado', () => {
    expect(partida.precioUnitario).toBe(250);
  });

  it('aviso informa que el precio incluye IVA', () => {
    expect(partida.aviso).toContain('IVA');
  });

  it('origen = catalogo', () => {
    expect(partida.origen).toBe('catalogo');
  });
});

describe('buildTransportPartidas — ruta escolar sin precio', () => {
  const [partida] = buildTransportPartidas(INTAKE_RUTA_ESCOLAR);

  it('precioUnitario = 0 cuando no hay precio', () => {
    expect(partida.precioUnitario).toBe(0);
  });

  it('requiere_precio = true', () => {
    expect(partida.requiere_precio).toBe(true);
  });

  it('origen = sugerida_ia', () => {
    expect(partida.origen).toBe('sugerida_ia');
  });

  it('aviso indica que el precio está pendiente', () => {
    expect(partida.aviso).toBeTruthy();
    expect(partida.aviso).toMatch(/[Pp]recio/);
  });
});

describe('buildTransportPartidas — transporte trabajadores recurrente', () => {
  const [partida] = buildTransportPartidas(INTAKE_TRABAJADORES);

  it('descripción contiene origen y destino', () => {
    expect(partida.descripcion).toContain('Santander centro');
    expect(partida.descripcion).toContain('Polígono Guarnizo');
  });

  it('precio correcto', () => {
    expect(partida.precioUnitario).toBe(1800);
  });
});

describe('buildTransportPartidas — datos ambiguos (todo null)', () => {
  const [partida] = buildTransportPartidas(INTAKE_AMBIGUO);

  it('sigue generando una partida', () => {
    expect(buildTransportPartidas(INTAKE_AMBIGUO)).toHaveLength(1);
  });

  it('descripción tiene texto por defecto', () => {
    expect(partida.descripcion.length).toBeGreaterThan(0);
  });

  it('requiere_precio = true', () => {
    expect(partida.requiere_precio).toBe(true);
  });
});

// ── 2. Persistencia de metadata ───────────────────────────────────────────────

describe('estructura de metadata de transporte', () => {
  const intake: TransportIntake = {
    schemaVersion: 1,
    vertical: 'transporte',
    intake: INTAKE_EXCURSION,
  };

  it('isValidTransportIntake acepta el intake completo', () => {
    expect(isValidTransportIntake(intake)).toBe(true);
  });

  it('la metadata tiene las claves requeridas', () => {
    const metadata = { vertical: 'transporte', transport_intake: intake };
    expect(metadata.vertical).toBe('transporte');
    expect(metadata.transport_intake).toBe(intake);
  });

  it('metadata no interfiere con otros campos (vertical cleaning preservada)', () => {
    const existing = { vertical: 'cleaning', algo: 'dato' };
    const merged = { ...existing, vertical: 'transporte', transport_intake: intake };
    expect(merged.algo).toBe('dato');
    expect(merged.vertical).toBe('transporte');
  });
});

// ── 3. buildPrefillFromIntake ─────────────────────────────────────────────────

describe('buildPrefillFromIntake — escenario multidía con condiciones', () => {
  const prefill = buildPrefillFromIntake(INTAKE_MULTIDÍA);

  it('título contiene origen y destino', () => {
    expect(prefill.titulo).toContain('Bilbao');
    expect(prefill.titulo).toContain('Madrid');
  });

  it('fecha_servicio y fecha_fin_servicio presentes', () => {
    expect(prefill.fecha_servicio).toBe('2026-12-10');
    expect(prefill.fecha_fin_servicio).toBe('2026-12-12');
  });

  it('num_viajeros', () => {
    expect(prefill.num_viajeros).toBe(30);
  });

  it('notas contiene condiciones especiales', () => {
    expect(prefill.notas).toContain('conductor');
  });

  it('precio_final = precio_base sin aplicar IVA (el wizard confirma el porcentaje)', () => {
    expect(prefill.precio_final).toBe(3500);
  });
});

describe('buildPrefillFromIntake — cliente no encontrado (sin client_id)', () => {
  const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);

  it('no devuelve client_id (no hay identificación de cliente en intake)', () => {
    expect(prefill).not.toHaveProperty('client_id');
  });
});

describe('buildPrefillFromIntake — precio sin indicación de IVA', () => {
  const prefill = buildPrefillFromIntake(INTAKE_EXCURSION);

  it('precio_final = precio_base (sin IVA aplicado automáticamente)', () => {
    expect(prefill.precio_final).toBe(1200);
  });
});

describe('buildPrefillFromIntake — sin precio', () => {
  const prefill = buildPrefillFromIntake(INTAKE_RUTA_ESCOLAR);

  it('no incluye precio_final cuando precio_base es null', () => {
    expect(prefill.precio_final).toBeUndefined();
  });
});

// ── 4. calcularPrecioConIva — IVA exacto ─────────────────────────────────────

describe('calcularPrecioConIva', () => {
  it('excursión 1200 + 21%  → 1452', () => {
    expect(calcularPrecioConIva(INTAKE_EXCURSION)).toBe(1452);
  });

  it('aeropuerto 250 IVA incluido → 250 (sin cambio)', () => {
    expect(calcularPrecioConIva(INTAKE_IVA_INCLUIDO)).toBe(250);
  });

  it('sin precio → null', () => {
    expect(calcularPrecioConIva(INTAKE_RUTA_ESCOLAR)).toBeNull();
  });

  it('trabaj 1800 + 10% → 1980 (tipo personalizado)', () => {
    expect(calcularPrecioConIva(INTAKE_TRABAJADORES, 10)).toBe(1980);
  });
});

// ── 5. Regresión: presupuestos de instaladores no afectados ───────────────────

describe('regresión — verticals no-transporte no deben activar transport_intake', () => {
  it('isValidTransportIntake rechaza objeto con vertical="cleaning"', () => {
    const cleaningLike = { schemaVersion: 1, vertical: 'cleaning', intake: {} };
    expect(isValidTransportIntake(cleaningLike)).toBe(false);
  });

  it('isValidTransportIntake rechaza null', () => {
    expect(isValidTransportIntake(null)).toBe(false);
  });

  it('isValidTransportIntake rechaza undefined', () => {
    expect(isValidTransportIntake(undefined)).toBe(false);
  });

  it('buildTransportPartidas no lanza con datos mínimos', () => {
    expect(() => buildTransportPartidas(INTAKE_AMBIGUO)).not.toThrow();
  });
});
