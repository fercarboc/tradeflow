import { describe, it, expect } from 'vitest';
import {
  SCHEDULE_EXCEPTION_TIPO_LABELS,
  SCHEDULE_ESTADO_LABELS,
  DIA_SEMANA_LABELS,
  SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED,
  SCHEDULE_EXCEPTION_OVERRIDES_FORBIDDEN,
  getExpectedOccurrences,
  validateExceptionOverrides,
  type ScheduleExceptionTipo,
  type ScheduleEstado,
  type DiaSemanaISO,
  type TradeTransportSchedule,
} from '../../lib/transportSchedules';

// ── Fixture de plantilla base ────────────────────────────────────────────────

function makeSchedule(
  overrides: Partial<TradeTransportSchedule> = {},
): TradeTransportSchedule {
  return {
    id:                  'sch-001',
    org_id:              'org-001',
    nombre:              'Ruta escolar IES Norte',
    tipo_servicio:       'ruta_escolar',
    estado:              'activo',
    client_id:           null,
    periodo_inicio:      '2026-09-01',
    periodo_fin:         '2027-06-30',
    dias_semana:         [1, 2, 3, 4, 5],    // lunes–viernes
    timezone:            'Europe/Madrid',
    hora_salida_ida:     '07:30:00',
    hora_llegada_ida:    '08:15:00',
    origen_ida:          { nombre_lugar: 'Parada central' },
    destino_ida:         { nombre_lugar: 'IES Norte' },
    paradas_ida:         [],
    vuelta_habilitada:   false,
    hora_salida_vuelta:  null,
    hora_llegada_vuelta: null,
    paradas_vuelta:      [],
    num_viajeros:        48,
    vehicle_id:          'veh-001',
    conductor_id:        'wrk-001',
    precio_referencia:   1500,
    observaciones:       null,
    created_at:          '2026-09-01T00:00:00Z',
    updated_at:          '2026-09-01T00:00:00Z',
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TS-1: Catálogos y etiquetas
// ════════════════════════════════════════════════════════════════════════════

describe('TS-1: Catálogos', () => {
  it('TS-1-A: SCHEDULE_EXCEPTION_TIPO_LABELS tiene exactamente 6 entradas', () => {
    expect(Object.keys(SCHEDULE_EXCEPTION_TIPO_LABELS)).toHaveLength(6);
  });

  it('TS-1-B: todos los tipos de excepción tienen etiqueta no vacía', () => {
    const tipos: ScheduleExceptionTipo[] = [
      'no_circula', 'suspendido', 'cambio_horario',
      'cambio_conductor', 'cambio_vehiculo', 'cambio_itinerario',
    ];
    tipos.forEach(t => {
      expect(SCHEDULE_EXCEPTION_TIPO_LABELS[t]).toBeTruthy();
    });
  });

  it('TS-1-C: SCHEDULE_ESTADO_LABELS tiene los 4 estados', () => {
    const estados: ScheduleEstado[] = ['borrador', 'activo', 'pausado', 'finalizado'];
    estados.forEach(e => {
      expect(SCHEDULE_ESTADO_LABELS[e]).toBeTruthy();
    });
  });

  it('TS-1-D: DIA_SEMANA_LABELS tiene los 7 días ISO (1-7)', () => {
    for (let d = 1; d <= 7; d++) {
      expect(DIA_SEMANA_LABELS[d as DiaSemanaISO]).toBeTruthy();
    }
  });

  it('TS-1-E: lunes es día 1, domingo es día 7 (ISO-8601)', () => {
    expect(DIA_SEMANA_LABELS[1]).toMatch(/lunes/i);
    expect(DIA_SEMANA_LABELS[7]).toMatch(/domingo/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TS-2: Constantes de overrides
// ════════════════════════════════════════════════════════════════════════════

describe('TS-2: Overrides permitidos y prohibidos', () => {
  it('TS-2-A: no_circula y suspendido no admiten ninguna clave', () => {
    expect(SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['no_circula']).toHaveLength(0);
    expect(SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['suspendido']).toHaveLength(0);
  });

  it('TS-2-B: cambio_conductor admite solo conductor_id', () => {
    expect(SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['cambio_conductor']).toEqual(['conductor_id']);
  });

  it('TS-2-C: cambio_vehiculo admite solo vehicle_id', () => {
    expect(SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['cambio_vehiculo']).toEqual(['vehicle_id']);
  });

  it('TS-2-D: cambio_horario admite hora_salida y hora_llegada', () => {
    const allowed = SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['cambio_horario'];
    expect(allowed).toContain('hora_salida');
    expect(allowed).toContain('hora_llegada');
    expect(allowed).toHaveLength(2);
  });

  it('TS-2-E: cambio_itinerario admite hasta 5 claves incluyendo paradas', () => {
    const allowed = SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['cambio_itinerario'];
    expect(allowed).toContain('paradas');
    expect(allowed.length).toBeGreaterThanOrEqual(3);
  });

  it('TS-2-F: org_id está en la lista de claves prohibidas', () => {
    expect(SCHEDULE_EXCEPTION_OVERRIDES_FORBIDDEN).toContain('org_id');
  });

  it('TS-2-G: id, schedule_id, tipo y created_at también están prohibidos', () => {
    const forbidden = SCHEDULE_EXCEPTION_OVERRIDES_FORBIDDEN as readonly string[];
    ['id', 'schedule_id', 'tipo', 'created_at'].forEach(k => {
      expect(forbidden).toContain(k);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TS-3: validateExceptionOverrides
// ════════════════════════════════════════════════════════════════════════════

describe('TS-3: validateExceptionOverrides', () => {
  it('TS-3-A: no_circula con {} → válido', () => {
    expect(validateExceptionOverrides('no_circula', {})).toBeNull();
  });

  it('TS-3-B: suspendido con {} → válido', () => {
    expect(validateExceptionOverrides('suspendido', {})).toBeNull();
  });

  it('TS-3-C: no_circula con clave extra → error', () => {
    const result = validateExceptionOverrides('no_circula', { hora_salida: '09:00' });
    expect(result).not.toBeNull();
    expect(result).toMatch(/no admite overrides/i);
  });

  it('TS-3-D: overrides con org_id → error de clave prohibida', () => {
    const result = validateExceptionOverrides('cambio_horario', {
      org_id: 'malicious-org',
      hora_salida: '09:00',
    });
    expect(result).not.toBeNull();
    expect(result).toMatch(/org_id/);
  });

  it('TS-3-E: cambio_conductor con conductor_id válido → null', () => {
    expect(
      validateExceptionOverrides('cambio_conductor', { conductor_id: 'wrk-002' }),
    ).toBeNull();
  });

  it('TS-3-F: cambio_conductor con vehicle_id → error de clave no permitida', () => {
    const result = validateExceptionOverrides('cambio_conductor', { vehicle_id: 'veh-002' });
    expect(result).not.toBeNull();
    expect(result).toMatch(/vehicle_id/);
  });

  it('TS-3-G: cambio_vehiculo con vehicle_id → null', () => {
    expect(
      validateExceptionOverrides('cambio_vehiculo', { vehicle_id: 'veh-002' }),
    ).toBeNull();
  });

  it('TS-3-H: cambio_horario con hora_salida y hora_llegada → null', () => {
    expect(
      validateExceptionOverrides('cambio_horario', {
        hora_salida:  '09:30',
        hora_llegada: '10:15',
      }),
    ).toBeNull();
  });

  it('TS-3-I: cambio_horario con clave extra (conductor_id) → error', () => {
    const result = validateExceptionOverrides('cambio_horario', {
      hora_salida:  '09:30',
      conductor_id: 'wrk-002',
    });
    expect(result).not.toBeNull();
  });

  it('TS-3-J: cambio_itinerario con paradas → null', () => {
    expect(
      validateExceptionOverrides('cambio_itinerario', {
        paradas: [{ nombre: 'Parada extra' }],
      }),
    ).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TS-4: getExpectedOccurrences
// ════════════════════════════════════════════════════════════════════════════

describe('TS-4: getExpectedOccurrences', () => {
  const SCH_LUNES_A_VIERNES = makeSchedule();

  it('TS-4-A: semana completa lun-vie da 5 ocurrencias', () => {
    // 2026-10-26 (lunes) – 2026-10-30 (viernes)
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-10-26'),
      new Date('2026-10-30'),
    );
    expect(result).toHaveLength(5);
  });

  it('TS-4-B: fin de semana (sáb-dom) para plantilla lun-vie → 0 ocurrencias', () => {
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-10-31'),  // sábado
      new Date('2026-11-01'),  // domingo
    );
    expect(result).toHaveLength(0);
  });

  it('TS-4-C: rango anterior al periodo_inicio → vacío', () => {
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-08-01'),
      new Date('2026-08-31'),
    );
    expect(result).toHaveLength(0);
  });

  it('TS-4-D: rango posterior al periodo_fin → vacío', () => {
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2027-07-01'),
      new Date('2027-07-31'),
    );
    expect(result).toHaveLength(0);
  });

  it('TS-4-E: plantilla solo sábados da 1 ocurrencia en una semana', () => {
    const sch = makeSchedule({ dias_semana: [6] as DiaSemanaISO[] });
    const result = getExpectedOccurrences(
      sch,
      new Date('2026-10-26'),  // lunes
      new Date('2026-11-01'),  // domingo
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('2026-10-31');  // sábado
  });

  it('TS-4-F: plantilla solo domingos da 1 ocurrencia en una semana', () => {
    const sch = makeSchedule({ dias_semana: [7] as DiaSemanaISO[] });
    const result = getExpectedOccurrences(
      sch,
      new Date('2026-10-26'),
      new Date('2026-11-01'),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('2026-11-01');  // domingo
  });

  it('TS-4-G: las fechas retornadas tienen formato YYYY-MM-DD', () => {
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-10-26'),
      new Date('2026-10-28'),
    );
    result.forEach(f => {
      expect(f).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('TS-4-H: periodo_fin null significa vigencia abierta', () => {
    const sch = makeSchedule({ periodo_fin: null, dias_semana: [1] as DiaSemanaISO[] });
    // Rango amplio: 3 lunes en noviembre 2027
    const result = getExpectedOccurrences(
      sch,
      new Date('2027-11-01'),
      new Date('2027-11-21'),
    );
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('TS-4-I: rango de un solo día que coincide con día de circulación da 1 resultado', () => {
    // 2026-10-26 = lunes
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-10-26'),
      new Date('2026-10-26'),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('2026-10-26');
  });

  it('TS-4-J: rango de un solo día que NO coincide da 0 resultados', () => {
    // 2026-10-31 = sábado, plantilla solo lun-vie
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-10-31'),
      new Date('2026-10-31'),
    );
    expect(result).toHaveLength(0);
  });

  it('TS-4-K: resultados están ordenados cronológicamente', () => {
    const result = getExpectedOccurrences(
      SCH_LUNES_A_VIERNES,
      new Date('2026-10-26'),
      new Date('2026-11-06'),
    );
    for (let i = 1; i < result.length; i++) {
      expect(result[i] > result[i - 1]).toBe(true);
    }
  });

  it('TS-4-L: plantilla todos los días da 7 resultados en una semana exacta', () => {
    const sch = makeSchedule({
      dias_semana: [1, 2, 3, 4, 5, 6, 7] as DiaSemanaISO[],
    });
    const result = getExpectedOccurrences(
      sch,
      new Date('2026-10-26'),  // lunes
      new Date('2026-11-01'),  // domingo
    );
    expect(result).toHaveLength(7);
  });

  it('TS-4-M: getExpectedOccurrences no modifica las fechas de entrada', () => {
    const desde = new Date('2026-10-26');
    const hasta = new Date('2026-10-30');
    const desdeOrig = desde.getTime();
    const hastaOrig = hasta.getTime();
    getExpectedOccurrences(SCH_LUNES_A_VIERNES, desde, hasta);
    expect(desde.getTime()).toBe(desdeOrig);
    expect(hasta.getTime()).toBe(hastaOrig);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TS-5: Invariantes de seguridad multitenant
// ════════════════════════════════════════════════════════════════════════════

describe('TS-5: Invariantes de seguridad de la migración', () => {
  it('TS-5-A: overrides prohibidos incluyen al menos org_id e id', () => {
    const forbidden = SCHEDULE_EXCEPTION_OVERRIDES_FORBIDDEN as readonly string[];
    expect(forbidden).toContain('org_id');
    expect(forbidden).toContain('id');
  });

  it('TS-5-B: no_circula y suspendido rechazan cualquier override', () => {
    const types: ScheduleExceptionTipo[] = ['no_circula', 'suspendido'];
    types.forEach(t => {
      const result = validateExceptionOverrides(t, { motivo: 'test' });
      expect(result).not.toBeNull();
    });
  });

  it('TS-5-C: cambio_conductor no permite cambiar vehicle_id', () => {
    const result = validateExceptionOverrides('cambio_conductor', {
      conductor_id: 'wrk-002',
      vehicle_id:   'veh-002',
    });
    expect(result).not.toBeNull();
    expect(result).toMatch(/vehicle_id/);
  });

  it('TS-5-D: cambio_vehiculo no permite cambiar conductor_id', () => {
    const result = validateExceptionOverrides('cambio_vehiculo', {
      vehicle_id:   'veh-002',
      conductor_id: 'wrk-002',
    });
    expect(result).not.toBeNull();
  });

  it('TS-5-E: no existe tipo que permita cambiar conductor_id y vehicle_id simultáneamente (limitación documentada para F2)', () => {
    // E-GAP documentado: cambio_conductor solo acepta conductor_id,
    // cambio_vehiculo solo acepta vehicle_id, cambio_itinerario no acepta ninguno.
    // Para cambiar ambos recursos se requiere actualizar la excepción en dos pasos.
    const tipos: ScheduleExceptionTipo[] = ['cambio_conductor', 'cambio_vehiculo', 'cambio_itinerario', 'cambio_horario'];
    const combinado = { conductor_id: 'wrk-002', vehicle_id: 'veh-002' };
    tipos.forEach(tipo => {
      const result = validateExceptionOverrides(tipo, combinado);
      expect(result).not.toBeNull();
    });
  });

  it('TS-5-F: cambio_itinerario no acepta conductor_id ni vehicle_id', () => {
    expect(validateExceptionOverrides('cambio_itinerario', { conductor_id: 'wrk-002' })).not.toBeNull();
    expect(validateExceptionOverrides('cambio_itinerario', { vehicle_id:   'veh-002' })).not.toBeNull();
  });
});
