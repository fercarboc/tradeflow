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
  type TradeTransportStopFavorite,
  type ProjectionStatus,
  type ProjectionRow,
} from '../../lib/transportSchedules';
import { isDuplicateStop } from '../../components/StopFavoriteSelector';

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
  it('TS-1-A: SCHEDULE_EXCEPTION_TIPO_LABELS tiene exactamente 7 entradas', () => {
    expect(Object.keys(SCHEDULE_EXCEPTION_TIPO_LABELS)).toHaveLength(7);
  });

  it('TS-1-B: todos los tipos de excepción tienen etiqueta no vacía', () => {
    const tipos: ScheduleExceptionTipo[] = [
      'no_circula', 'suspendido', 'cambio_horario',
      'cambio_conductor', 'cambio_vehiculo', 'cambio_itinerario',
      'modificado',
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

  it('TS-5-E: los tipos legacy no permiten cambiar conductor_id y vehicle_id simultáneamente (cerrado con tipo modificado en F1-gaps)', () => {
    // Los tipos originales siguen siendo restrictivos. El tipo 'modificado' (E-GAP cerrado)
    // es el único que acepta la combinación — se verifica en TS-6-D.
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

// ════════════════════════════════════════════════════════════════════════════
// TS-6: Tipo 'modificado' — E-GAP cerrado
// ════════════════════════════════════════════════════════════════════════════

describe('TS-6: Tipo modificado (E-GAP cerrado)', () => {
  it('TS-6-A: modificado aparece en SCHEDULE_EXCEPTION_TIPO_LABELS', () => {
    expect('modificado' in SCHEDULE_EXCEPTION_TIPO_LABELS).toBe(true);
  });

  it('TS-6-B: modificado tiene etiqueta no vacía', () => {
    expect(SCHEDULE_EXCEPTION_TIPO_LABELS['modificado']).toBeTruthy();
    expect(SCHEDULE_EXCEPTION_TIPO_LABELS['modificado'].length).toBeGreaterThan(0);
  });

  it('TS-6-C: modificado está en OVERRIDES_ALLOWED con al menos 7 claves', () => {
    const allowed = SCHEDULE_EXCEPTION_OVERRIDES_ALLOWED['modificado'];
    expect(allowed).toBeDefined();
    expect(allowed.length).toBeGreaterThanOrEqual(7);
    expect(allowed).toContain('conductor_id');
    expect(allowed).toContain('vehicle_id');
    expect(allowed).toContain('hora_salida');
    expect(allowed).toContain('hora_llegada');
    expect(allowed).toContain('paradas');
    expect(allowed).toContain('origen');
    expect(allowed).toContain('destino');
  });

  it('TS-6-D: modificado acepta conductor_id + vehicle_id combinados → null (E-GAP cerrado)', () => {
    const result = validateExceptionOverrides('modificado', {
      conductor_id: 'wrk-002',
      vehicle_id:   'veh-002',
    });
    expect(result).toBeNull();
  });

  it('TS-6-E: modificado acepta hora_salida + hora_llegada + conductor_id + vehicle_id → null', () => {
    const result = validateExceptionOverrides('modificado', {
      conductor_id: 'wrk-002',
      vehicle_id:   'veh-002',
      hora_salida:  '08:00',
      hora_llegada: '09:30',
    });
    expect(result).toBeNull();
  });

  it('TS-6-F: modificado acepta todos los campos permitidos combinados → null', () => {
    const result = validateExceptionOverrides('modificado', {
      conductor_id: 'wrk-002',
      vehicle_id:   'veh-002',
      hora_salida:  '08:00',
      hora_llegada: '09:30',
      paradas:      [{ nombre: 'Parada extra' }],
      origen:       { nombre_lugar: 'Origen nuevo' },
      destino:      { nombre_lugar: 'Destino nuevo' },
    });
    expect(result).toBeNull();
  });

  it('TS-6-G: modificado rechaza org_id (clave prohibida)', () => {
    const result = validateExceptionOverrides('modificado', {
      org_id: 'malicious-org',
      conductor_id: 'wrk-002',
    });
    expect(result).not.toBeNull();
    expect(result).toMatch(/org_id/);
  });

  it('TS-6-H: modificado rechaza schedule_id (clave prohibida)', () => {
    const result = validateExceptionOverrides('modificado', {
      schedule_id: 'sch-malicious',
    });
    expect(result).not.toBeNull();
    expect(result).toMatch(/schedule_id/);
  });

  it('TS-6-I: modificado rechaza clave desconocida → error con nombre de clave', () => {
    const result = validateExceptionOverrides('modificado', {
      conductor_id: 'wrk-002',
      campo_raro:   'valor',
    });
    expect(result).not.toBeNull();
    expect(result).toMatch(/campo_raro/);
  });

  it('TS-6-J: modificado con overrides vacío {} → válido (sin cambios explícitos)', () => {
    const result = validateExceptionOverrides('modificado', {});
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TS-7: Tipos de F2 — ProjectionStatus y ProjectionRow
// ════════════════════════════════════════════════════════════════════════════

describe('TS-7: Tipos F2 ProjectionRow', () => {
  it('TS-7-A: ProjectionStatus acepta los 4 valores válidos en TypeScript', () => {
    const statuses: ProjectionStatus[] = ['pending', 'materialized', 'suspended', 'no_circula'];
    expect(statuses).toHaveLength(4);
  });

  it('TS-7-B: ProjectionRow con status pending tiene service_id null', () => {
    const row: ProjectionRow = {
      fecha:             '2026-10-28',
      sentido:           'unico',
      status:            'pending',
      service_id:        null,
      exception_tipo:    null,
      exception_motivo:  null,
      hora_salida:       '07:30:00',
      hora_llegada:      '08:15:00',
      conductor_id:      'wrk-001',
      vehicle_id:        'veh-001',
      origen:            { nombre_lugar: 'Origen' },
      destino:           { nombre_lugar: 'Destino' },
    };
    expect(row.service_id).toBeNull();
    expect(row.status).toBe('pending');
  });

  it('TS-7-C: ProjectionRow con status materialized puede tener service_id', () => {
    const row: ProjectionRow = {
      fecha:             '2026-10-28',
      sentido:           'ida',
      status:            'materialized',
      service_id:        'srv-abc',
      exception_tipo:    null,
      exception_motivo:  null,
      hora_salida:       '07:30:00',
      hora_llegada:      null,
      conductor_id:      null,
      vehicle_id:        null,
      origen:            {},
      destino:           {},
    };
    expect(row.service_id).toBe('srv-abc');
    expect(row.status).toBe('materialized');
  });

  it('TS-7-D: ProjectionRow con excepción suspendido tiene exception_tipo', () => {
    const row: ProjectionRow = {
      fecha:             '2026-10-28',
      sentido:           'vuelta',
      status:            'suspended',
      service_id:        null,
      exception_tipo:    'suspendido',
      exception_motivo:  'Festivo local',
      hora_salida:       '16:00:00',
      hora_llegada:      null,
      conductor_id:      null,
      vehicle_id:        null,
      origen:            {},
      destino:           {},
    };
    expect(row.exception_tipo).toBe('suspendido');
    expect(row.exception_motivo).toBe('Festivo local');
    expect(row.status).toBe('suspended');
  });

  it('TS-7-E: ProjectionRow con status no_circula tiene exception_tipo', () => {
    const row: ProjectionRow = {
      fecha:             '2026-10-29',
      sentido:           'unico',
      status:            'no_circula',
      service_id:        null,
      exception_tipo:    'no_circula',
      exception_motivo:  null,
      hora_salida:       '07:30:00',
      hora_llegada:      null,
      conductor_id:      null,
      vehicle_id:        null,
      origen:            {},
      destino:           {},
    };
    expect(row.status).toBe('no_circula');
    expect(row.exception_tipo).toBe('no_circula');
  });

  it('TS-7-F: ProjectionRow acepta exception_tipo de cualquier ScheduleExceptionTipo', () => {
    const tipos: ScheduleExceptionTipo[] = [
      'no_circula', 'suspendido', 'cambio_horario',
      'cambio_conductor', 'cambio_vehiculo', 'cambio_itinerario', 'modificado',
    ];
    tipos.forEach(tipo => {
      const row: ProjectionRow = {
        fecha:             '2026-10-28',
        sentido:           'unico',
        status:            'pending',
        service_id:        null,
        exception_tipo:    tipo,
        exception_motivo:  null,
        hora_salida:       '07:30:00',
        hora_llegada:      null,
        conductor_id:      null,
        vehicle_id:        null,
        origen:            {},
        destino:           {},
      };
      expect(row.exception_tipo).toBe(tipo);
    });
  });

  it('TS-7-G: ProjectionRow soporta todos los sentidos posibles', () => {
    const sentidos: Array<'ida' | 'vuelta' | 'unico'> = ['ida', 'vuelta', 'unico'];
    sentidos.forEach(s => {
      const row: ProjectionRow = {
        fecha:             '2026-10-28',
        sentido:           s,
        status:            'pending',
        service_id:        null,
        exception_tipo:    null,
        exception_motivo:  null,
        hora_salida:       '07:30:00',
        hora_llegada:      null,
        conductor_id:      null,
        vehicle_id:        null,
        origen:            {},
        destino:           {},
      };
      expect(row.sentido).toBe(s);
    });
  });

  it('TS-7-H: fecha tiene formato ISO YYYY-MM-DD', () => {
    const row: ProjectionRow = {
      fecha:             '2026-10-28',
      sentido:           'unico',
      status:            'pending',
      service_id:        null,
      exception_tipo:    null,
      exception_motivo:  null,
      hora_salida:       '07:30:00',
      hora_llegada:      null,
      conductor_id:      null,
      vehicle_id:        null,
      origen:            {},
      destino:           {},
    };
    expect(row.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('TS-7-I: ProjectionRow con modificado tiene campos efectivos actualizados', () => {
    const row: ProjectionRow = {
      fecha:             '2026-10-28',
      sentido:           'ida',
      status:            'pending',
      service_id:        null,
      exception_tipo:    'modificado',
      exception_motivo:  'Cambio de vehículo y horario',
      hora_salida:       '08:00:00',    // override aplicado
      hora_llegada:      '09:00:00',    // override aplicado
      conductor_id:      'wrk-002',     // override aplicado
      vehicle_id:        'veh-002',     // override aplicado
      origen:            { nombre_lugar: 'Nueva parada origen' },
      destino:           { nombre_lugar: 'IES Norte' },
    };
    expect(row.exception_tipo).toBe('modificado');
    expect(row.conductor_id).toBe('wrk-002');
    expect(row.vehicle_id).toBe('veh-002');
    expect(row.hora_salida).toBe('08:00:00');
  });

  it('TS-7-J: la suma de statuses cubre el dominio completo (4 valores distintos)', () => {
    const allStatuses = new Set<ProjectionStatus>([
      'pending', 'materialized', 'suspended', 'no_circula',
    ]);
    expect(allStatuses.size).toBe(4);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TS-8: Paradas favoritas — tipos, CRUD helpers y deduplicación
// ════════════════════════════════════════════════════════════════════════════

function makeFavorite(
  overrides: Partial<TradeTransportStopFavorite> = {},
): TradeTransportStopFavorite {
  return {
    id:         'fav-001',
    org_id:     'org-001',
    nombre:     'IES Norte',
    tipo_lugar: 'colegio',
    location:   { localidad: 'Santander', calle: 'Calle Mayor', numero: '1' },
    activo:     true,
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

describe('TS-8: Paradas favoritas', () => {
  it('TS-8-A: TradeTransportStopFavorite tiene los campos requeridos', () => {
    const fav = makeFavorite();
    expect(fav.id).toBeDefined();
    expect(fav.org_id).toBeDefined();
    expect(fav.nombre).toBeDefined();
    expect(fav.location).toBeDefined();
    expect(typeof fav.activo).toBe('boolean');
  });

  it('TS-8-B: TradeTransportStopFavorite acepta tipo_lugar null', () => {
    const fav = makeFavorite({ tipo_lugar: null });
    expect(fav.tipo_lugar).toBeNull();
  });

  it('TS-8-C: TradeTransportStopFavorite activo=false indica parada desactivada', () => {
    const fav = makeFavorite({ activo: false });
    expect(fav.activo).toBe(false);
  });

  it('TS-8-D: isDuplicateStop retorna true cuando nombre Y localidad coinciden', () => {
    const favs = [makeFavorite()];
    expect(isDuplicateStop(favs, 'IES Norte', 'Santander')).toBe(true);
  });

  it('TS-8-E: isDuplicateStop es insensible a mayúsculas y acentos', () => {
    const favs = [makeFavorite()];
    expect(isDuplicateStop(favs, 'ies norte', 'santander')).toBe(true);
    expect(isDuplicateStop(favs, 'IÉS Nórte', 'Sántander')).toBe(true);
  });

  it('TS-8-F: isDuplicateStop retorna false si solo coincide el nombre', () => {
    const favs = [makeFavorite()];
    expect(isDuplicateStop(favs, 'IES Norte', 'Madrid')).toBe(false);
  });

  it('TS-8-G: isDuplicateStop retorna false si solo coincide la localidad', () => {
    const favs = [makeFavorite()];
    expect(isDuplicateStop(favs, 'CEIP Sur', 'Santander')).toBe(false);
  });

  it('TS-8-H: isDuplicateStop retorna false con lista vacía', () => {
    expect(isDuplicateStop([], 'IES Norte', 'Santander')).toBe(false);
  });

  it('TS-8-I: isDuplicateStop retorna false cuando favorita no tiene localidad y query sí', () => {
    const fav = makeFavorite({ location: {} });
    expect(isDuplicateStop([fav], 'IES Norte', 'Santander')).toBe(false);
  });

  it('TS-8-J: isDuplicateStop con localidad vacía en query y favorita sin localidad retorna true', () => {
    const fav = makeFavorite({ location: {} });
    expect(isDuplicateStop([fav], 'IES Norte', '')).toBe(true);
  });

  it('TS-8-K: location JSONB es Record<string, unknown> compatible con TransportLocation', () => {
    const fav = makeFavorite({
      location: {
        nombre_lugar: 'IES Norte',
        calle:        'Calle Mayor',
        numero:       '1',
        cp:           '39001',
        localidad:    'Santander',
        lat:          43.4628,
        lng:          -3.8050,
        geo_source:   'confirmed',
      },
    });
    expect((fav.location as Record<string, unknown>).lat).toBe(43.4628);
    expect((fav.location as Record<string, unknown>).geo_source).toBe('confirmed');
  });
});
