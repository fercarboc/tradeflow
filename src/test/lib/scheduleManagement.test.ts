import { describe, it, expect } from 'vitest';
import {
  buildCalendarProjection,
  getAvailableTransitions,
  applyTransition,
  fmtHora,
  filterSchedules,
  type CalendarOccurrence,
} from '../../components/ScreenTransporteRutas';
import {
  createException,
  deleteException,
  type TradeTransportSchedule,
  type TradeTransportScheduleException,
  type TradeTransportOccurrenceLink,
  type ScheduleEstado,
} from '../../lib/transportSchedules';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE: Pick<TradeTransportSchedule, 'periodo_inicio' | 'periodo_fin' | 'dias_semana' | 'vuelta_habilitada'> = {
  periodo_inicio:   '2025-01-06',  // lunes
  periodo_fin:      '2025-01-31',
  dias_semana:      [1, 2, 3, 4, 5],
  vuelta_habilitada: false,
};

function makeException(
  overrides: Partial<TradeTransportScheduleException> = {},
): TradeTransportScheduleException {
  return {
    id:          'ex-1',
    org_id:      'org-1',
    schedule_id: 'sch-1',
    fecha:       '2025-01-06',
    sentido:     'ida',
    tipo:        'no_circula',
    overrides:   {},
    motivo:      null,
    created_at:  '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeLink(
  overrides: Partial<TradeTransportOccurrenceLink> = {},
): TradeTransportOccurrenceLink {
  return {
    id:          'lk-1',
    org_id:      'org-1',
    schedule_id: 'sch-1',
    service_id:  'svc-1',
    fecha:       '2025-01-07',
    sentido:     'ida',
    created_at:  '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── SM-1: buildCalendarProjection — básico ────────────────────────────────────

describe('SM-1 buildCalendarProjection básico', () => {
  it('SM-1-A genera ocurrencias L-V dentro del período', () => {
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-10T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    // 6/ene=Lun, 7=Mar, 8=Mié, 9=Jue, 10=Vie → 5 días
    expect(result).toHaveLength(5);
    expect(result.map(o => o.fecha)).toEqual([
      '2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10',
    ]);
  });

  it('SM-1-B no genera sábados ni domingos cuando dias_semana=[1..5]', () => {
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-12T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    // 11/ene=Sáb, 12/ene=Dom → no incluidos
    expect(result.map(o => o.fecha)).not.toContain('2025-01-11');
    expect(result.map(o => o.fecha)).not.toContain('2025-01-12');
  });

  it('SM-1-C estado pending para ocurrencias sin excepción ni link', () => {
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    expect(result[0].status).toBe('pending');
    expect(result[0].service_id).toBeNull();
    expect(result[0].exception).toBeNull();
  });

  it('SM-1-D sentido ida cuando vuelta_habilitada=false', () => {
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-07T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    expect(result.every(o => o.sentido === 'ida')).toBe(true);
  });

  it('SM-1-E array vacío si rango antes del período', () => {
    const desde = new Date('2024-12-01T00:00:00');
    const hasta = new Date('2025-01-05T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    expect(result).toHaveLength(0);
  });

  it('SM-1-F array vacío si rango después del período', () => {
    const desde = new Date('2025-02-01T00:00:00');
    const hasta = new Date('2025-02-28T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    expect(result).toHaveLength(0);
  });

  it('SM-1-G respeta periodo_fin exacto', () => {
    const desde = new Date('2025-01-27T00:00:00');
    const hasta = new Date('2025-02-05T23:59:59');
    const result = buildCalendarProjection(BASE, [], [], desde, hasta);
    // 27/ene=Lun, 28=Mar, 29=Mié, 30=Jue, 31=Vie → fin el 31
    // 3/Feb, 4/Feb fuera del período
    expect(result.map(o => o.fecha)).toEqual([
      '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
    ]);
  });

  it('SM-1-H schedule sin fin (periodo_fin=null) proyecta indefinidamente', () => {
    const infinite = { ...BASE, periodo_fin: null };
    const desde = new Date('2025-06-01T00:00:00');
    const hasta = new Date('2025-06-06T23:59:59');
    const result = buildCalendarProjection(infinite, [], [], desde, hasta);
    // 2/Jun=Lun, 3=Mar, 4=Mié, 5=Jue, 6=Vie
    expect(result).toHaveLength(5);
  });
});

// ── SM-2: buildCalendarProjection — excepciones ───────────────────────────────

describe('SM-2 buildCalendarProjection con excepciones', () => {
  it('SM-2-A excepción no_circula → status no_circula', () => {
    const ex = makeException({ fecha: '2025-01-06', tipo: 'no_circula' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    expect(result[0].status).toBe('no_circula');
    expect(result[0].exception).toBe(ex);
  });

  it('SM-2-B excepción suspendido → status suspended', () => {
    const ex = makeException({ fecha: '2025-01-06', tipo: 'suspendido' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    expect(result[0].status).toBe('suspended');
  });

  it('SM-2-C excepción cambio_conductor → status cambio_conductor', () => {
    const ex = makeException({ fecha: '2025-01-06', tipo: 'cambio_conductor', overrides: { conductor_id: 'c-2' } });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    expect(result[0].status).toBe('cambio_conductor');
  });

  it('SM-2-D excepción cambio_vehiculo → status cambio_vehiculo', () => {
    const ex = makeException({ fecha: '2025-01-07', tipo: 'cambio_vehiculo' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-10T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    const row = result.find(o => o.fecha === '2025-01-07');
    expect(row?.status).toBe('cambio_vehiculo');
  });

  it('SM-2-E excepción cambio_horario → status cambio_horario', () => {
    const ex = makeException({ fecha: '2025-01-08', tipo: 'cambio_horario', overrides: { hora_salida: '09:00:00' } });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-10T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    const row = result.find(o => o.fecha === '2025-01-08');
    expect(row?.status).toBe('cambio_horario');
  });

  it('SM-2-F excepción solo afecta al sentido correcto', () => {
    const base2 = { ...BASE, vuelta_habilitada: true };
    const ex = makeException({ fecha: '2025-01-06', sentido: 'ida', tipo: 'no_circula' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(base2, [ex], [], desde, hasta);
    const ida    = result.find(o => o.sentido === 'ida');
    const vuelta = result.find(o => o.sentido === 'vuelta');
    expect(ida?.status).toBe('no_circula');
    expect(vuelta?.status).toBe('pending');
  });

  it('SM-2-G exception fuera de la fecha proyectada no afecta nada', () => {
    const ex = makeException({ fecha: '2025-02-10', tipo: 'no_circula' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-10T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    expect(result.every(o => o.status === 'pending')).toBe(true);
  });

  it('SM-2-H exception en día no circulado (sábado) no aparece en resultado', () => {
    const ex = makeException({ fecha: '2025-01-11', tipo: 'no_circula' }); // sábado
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-12T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [], desde, hasta);
    expect(result.some(o => o.fecha === '2025-01-11')).toBe(false);
  });
});

// ── SM-3: buildCalendarProjection — vuelta habilitada ────────────────────────

describe('SM-3 buildCalendarProjection vuelta habilitada', () => {
  const BASE2 = { ...BASE, vuelta_habilitada: true };

  it('SM-3-A genera ida y vuelta para cada día activo', () => {
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE2, [], [], desde, hasta);
    expect(result).toHaveLength(2);
    expect(result[0].sentido).toBe('ida');
    expect(result[1].sentido).toBe('vuelta');
    expect(result[0].fecha).toBe('2025-01-06');
    expect(result[1].fecha).toBe('2025-01-06');
  });

  it('SM-3-B exception vuelta no afecta a ida', () => {
    const ex = makeException({ fecha: '2025-01-06', sentido: 'vuelta', tipo: 'suspendido' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE2, [ex], [], desde, hasta);
    const ida    = result.find(o => o.sentido === 'ida');
    const vuelta = result.find(o => o.sentido === 'vuelta');
    expect(ida?.status).toBe('pending');
    expect(vuelta?.status).toBe('suspended');
  });

  it('SM-3-C link vuelta no afecta a ida', () => {
    const lk = makeLink({ fecha: '2025-01-07', sentido: 'vuelta' });
    const desde = new Date('2025-01-07T00:00:00');
    const hasta = new Date('2025-01-07T23:59:59');
    const result = buildCalendarProjection(BASE2, [], [lk], desde, hasta);
    const ida    = result.find(o => o.sentido === 'ida');
    const vuelta = result.find(o => o.sentido === 'vuelta');
    expect(ida?.status).toBe('pending');
    expect(vuelta?.status).toBe('materialized');
  });
});

// ── SM-4: buildCalendarProjection — occurrence_links ─────────────────────────

describe('SM-4 buildCalendarProjection con occurrence_links', () => {
  it('SM-4-A link convierte status a materialized', () => {
    const lk = makeLink({ fecha: '2025-01-07', sentido: 'ida', service_id: 'svc-abc' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-10T23:59:59');
    const result = buildCalendarProjection(BASE, [], [lk], desde, hasta);
    const row = result.find(o => o.fecha === '2025-01-07');
    expect(row?.status).toBe('materialized');
    expect(row?.service_id).toBe('svc-abc');
  });

  it('SM-4-B link gana sobre excepción (materializado aunque haya excepción)', () => {
    const lk = makeLink({ fecha: '2025-01-06', sentido: 'ida', service_id: 'svc-1' });
    const ex = makeException({ fecha: '2025-01-06', sentido: 'ida', tipo: 'cambio_conductor' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-06T23:59:59');
    const result = buildCalendarProjection(BASE, [ex], [lk], desde, hasta);
    expect(result[0].status).toBe('materialized');
    expect(result[0].service_id).toBe('svc-1');
  });

  it('SM-4-C link en fecha diferente no afecta otras fechas', () => {
    const lk = makeLink({ fecha: '2025-01-08', sentido: 'ida' });
    const desde = new Date('2025-01-06T00:00:00');
    const hasta = new Date('2025-01-10T23:59:59');
    const result = buildCalendarProjection(BASE, [], [lk], desde, hasta);
    expect(result.filter(o => o.status === 'materialized')).toHaveLength(1);
    expect(result.filter(o => o.status === 'pending')).toHaveLength(4);
  });
});

// ── SM-5: getAvailableTransitions ─────────────────────────────────────────────

describe('SM-5 getAvailableTransitions', () => {
  it('SM-5-A borrador → solo activar', () => {
    expect(getAvailableTransitions('borrador')).toEqual(['activar']);
  });

  it('SM-5-B activo → pausar + finalizar', () => {
    expect(getAvailableTransitions('activo')).toEqual(['pausar', 'finalizar']);
  });

  it('SM-5-C pausado → reanudar + finalizar', () => {
    expect(getAvailableTransitions('pausado')).toEqual(['reanudar', 'finalizar']);
  });

  it('SM-5-D finalizado → sin transiciones', () => {
    expect(getAvailableTransitions('finalizado')).toEqual([]);
  });

  it('SM-5-E no se puede eliminar físicamente un schedule finalizado (sin transición delete)', () => {
    const t = getAvailableTransitions('finalizado');
    expect(t).not.toContain('eliminar');
    expect(t).not.toContain('borrar');
  });
});

// ── SM-6: applyTransition — válidos ──────────────────────────────────────────

describe('SM-6 applyTransition válidos', () => {
  it('SM-6-A borrador + activar → activo', () => {
    expect(applyTransition('borrador', 'activar')).toBe('activo');
  });

  it('SM-6-B activo + pausar → pausado', () => {
    expect(applyTransition('activo', 'pausar')).toBe('pausado');
  });

  it('SM-6-C activo + finalizar → finalizado', () => {
    expect(applyTransition('activo', 'finalizar')).toBe('finalizado');
  });

  it('SM-6-D pausado + reanudar → activo', () => {
    expect(applyTransition('pausado', 'reanudar')).toBe('activo');
  });

  it('SM-6-E pausado + finalizar → finalizado', () => {
    expect(applyTransition('pausado', 'finalizar')).toBe('finalizado');
  });
});

// ── SM-7: applyTransition — inválidos ─────────────────────────────────────────

describe('SM-7 applyTransition inválidos', () => {
  it('SM-7-A finalizado no admite activar', () => {
    expect(() => applyTransition('finalizado', 'activar')).toThrow();
  });

  it('SM-7-B finalizado no admite pausar', () => {
    expect(() => applyTransition('finalizado', 'pausar')).toThrow();
  });

  it('SM-7-C borrador no admite pausar', () => {
    expect(() => applyTransition('borrador', 'pausar')).toThrow();
  });

  it('SM-7-D activo no admite reanudar', () => {
    expect(() => applyTransition('activo', 'reanudar')).toThrow();
  });

  it('SM-7-E el error menciona el estado y la transición', () => {
    try {
      applyTransition('finalizado', 'activar');
      expect.fail('debería lanzar');
    } catch (e) {
      expect((e as Error).message).toContain('finalizado');
      expect((e as Error).message).toContain('activar');
    }
  });
});

// ── SM-8: filterSchedules ─────────────────────────────────────────────────────

describe('SM-8 filterSchedules', () => {
  const makeSchedule = (id: string, patch: Partial<TradeTransportSchedule> = {}): TradeTransportSchedule => ({
    id,
    org_id:          'org-1',
    nombre:          `Ruta ${id}`,
    tipo_servicio:   'ruta_escolar',
    estado:          'activo',
    client_id:       null,
    periodo_inicio:  '2025-01-01',
    periodo_fin:     null,
    dias_semana:     [1, 2, 3, 4, 5],
    timezone:        'Europe/Madrid',
    hora_salida_ida: '08:00:00',
    hora_llegada_ida: null,
    origen_ida:      {},
    destino_ida:     {},
    paradas_ida:     [],
    vuelta_habilitada: false,
    hora_salida_vuelta: null,
    hora_llegada_vuelta: null,
    paradas_vuelta:  [],
    num_viajeros:    null,
    vehicle_id:      null,
    conductor_id:    null,
    precio_referencia: null,
    observaciones:   null,
    created_at:      '2025-01-01T00:00:00Z',
    updated_at:      '2025-01-01T00:00:00Z',
    ...patch,
  });

  const schedules = [
    makeSchedule('A', { nombre: 'Colegio San Juan', tipo_servicio: 'ruta_escolar', estado: 'activo' }),
    makeSchedule('B', { nombre: 'Trabajadores Fabrica', tipo_servicio: 'transporte_trabajadores', estado: 'borrador', client_id: 'c1' }),
    makeSchedule('C', { nombre: 'Lanzadera Centro', tipo_servicio: 'lanzadera', estado: 'pausado' }),
    makeSchedule('D', { nombre: 'Colegio Santa Maria', tipo_servicio: 'ruta_escolar', estado: 'finalizado' }),
  ];
  const clientNames: Record<string, string> = { c1: 'Aceros del Norte SA' };

  it('SM-8-A sin filtros devuelve todos', () => {
    const r = filterSchedules(schedules, { query: '', tipo: '', estado: '' }, clientNames);
    expect(r).toHaveLength(4);
  });

  it('SM-8-B filtro estado=activo', () => {
    const r = filterSchedules(schedules, { query: '', tipo: '', estado: 'activo' }, clientNames);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('A');
  });

  it('SM-8-C filtro tipo=ruta_escolar', () => {
    const r = filterSchedules(schedules, { query: '', tipo: 'ruta_escolar', estado: '' }, clientNames);
    expect(r.map(s => s.id)).toEqual(['A', 'D']);
  });

  it('SM-8-D filtro query por nombre (case insensitive)', () => {
    const r = filterSchedules(schedules, { query: 'colegio', tipo: '', estado: '' }, clientNames);
    expect(r.map(s => s.id)).toEqual(['A', 'D']);
  });

  it('SM-8-E filtro query por nombre de cliente', () => {
    const r = filterSchedules(schedules, { query: 'aceros', tipo: '', estado: '' }, clientNames);
    expect(r.map(s => s.id)).toEqual(['B']);
  });

  it('SM-8-F filtros combinados (tipo + estado)', () => {
    const r = filterSchedules(schedules, { query: '', tipo: 'ruta_escolar', estado: 'finalizado' }, clientNames);
    expect(r.map(s => s.id)).toEqual(['D']);
  });

  it('SM-8-G query vacía no filtra nada', () => {
    const r = filterSchedules(schedules, { query: '   ', tipo: '', estado: '' }, clientNames);
    expect(r).toHaveLength(4);
  });

  it('SM-8-H query que no coincide devuelve vacío', () => {
    const r = filterSchedules(schedules, { query: 'xyz_imposible', tipo: '', estado: '' }, clientNames);
    expect(r).toHaveLength(0);
  });
});

// ── SM-9: fmtHora ─────────────────────────────────────────────────────────────

describe('SM-9 fmtHora', () => {
  it('SM-9-A HH:MM:SS → HH:MM', () => {
    expect(fmtHora('08:30:00')).toBe('08:30');
  });

  it('SM-9-B null → —', () => {
    expect(fmtHora(null)).toBe('—');
  });

  it('SM-9-C undefined → —', () => {
    expect(fmtHora(undefined)).toBe('—');
  });

  it('SM-9-D cadena vacía → —', () => {
    expect(fmtHora('')).toBe('—');
  });
});

// ── SM-10: createException / deleteException exports ─────────────────────────

describe('SM-10 createException y deleteException exports', () => {
  it('SM-10-A createException es una función exportada', () => {
    expect(typeof createException).toBe('function');
  });

  it('SM-10-B deleteException es una función exportada', () => {
    expect(typeof deleteException).toBe('function');
  });
});
