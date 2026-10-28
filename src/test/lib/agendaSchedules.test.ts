import { describe, it, expect } from 'vitest';
import {
  buildAgendaOccurrences,
  getOccurrencesForDay,
  detectConflicts,
} from '../../components/ScreenTransporteAgenda';
import type { AgendaOccurrence } from '../../components/ScreenTransporteAgenda';
import type { TradeTransportSchedule, TradeTransportScheduleException, TradeTransportOccurrenceLink } from '../../lib/transportSchedules';
import type { TradeTransportService } from '../../lib/transportServices';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<TradeTransportSchedule> = {}): TradeTransportSchedule {
  return {
    id: 'sched-1',
    org_id: 'org-1',
    nombre: 'Ruta test',
    tipo_servicio: 'regular',
    estado: 'activo',
    client_id: null,
    periodo_inicio: '2026-11-01',
    periodo_fin: null,
    dias_semana: [1, 3, 5],          // lun, mié, vie
    timezone: 'Europe/Madrid',
    hora_salida_ida: '08:00:00',
    hora_llegada_ida: null,
    origen_ida: {},
    destino_ida: {},
    paradas_ida: [],
    vuelta_habilitada: false,
    hora_salida_vuelta: null,
    hora_llegada_vuelta: null,
    paradas_vuelta: [],
    num_viajeros: null,
    vehicle_id: 'veh-1',
    conductor_id: 'cond-1',
    precio_referencia: null,
    observaciones: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function makeException(overrides: Partial<TradeTransportScheduleException> = {}): TradeTransportScheduleException {
  return {
    id: 'ex-1',
    org_id: 'org-1',
    schedule_id: 'sched-1',
    fecha: '2026-11-03',
    sentido: 'unico',
    tipo: 'no_circula',
    overrides: {},
    motivo: null,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function makeLink(overrides: Partial<TradeTransportOccurrenceLink> = {}): TradeTransportOccurrenceLink {
  return {
    id: 'lk-1',
    org_id: 'org-1',
    schedule_id: 'sched-1',
    service_id: 'svc-materialized',
    fecha: '2026-11-05',
    sentido: 'unico',
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

const DESDE = new Date('2026-11-01T00:00:00');
const HASTA = new Date('2026-11-07T23:59:59');

// ── AS-1: buildAgendaOccurrences básico ───────────────────────────────────────

describe('AS-1 buildAgendaOccurrences basic', () => {
  it('generates pending occurrences for active schedule days', () => {
    const sched = makeSchedule();
    const result = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);

    // Nov 2-7: Mon=3, Wed=5, Fri=7
    const fechas = result.map(o => o.fecha);
    expect(fechas).toContain('2026-11-02');  // Monday
    expect(fechas).toContain('2026-11-04');  // Wednesday
    expect(fechas).toContain('2026-11-06');  // Friday
    expect(result.every(o => o.status === 'pending')).toBe(true);
    expect(result.every(o => o.schedule.id === 'sched-1')).toBe(true);
  });

  it('only generates unico sentido when vuelta_habilitada=false', () => {
    const sched = makeSchedule({ vuelta_habilitada: false });
    const result = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);
    expect(result.every(o => o.sentido === 'unico')).toBe(true);
  });

  it('generates both sentidos when vuelta_habilitada=true', () => {
    const sched = makeSchedule({ vuelta_habilitada: true, hora_salida_vuelta: '18:00:00' });
    const result = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);
    const sentidos = new Set(result.map(o => o.sentido));
    expect(sentidos.has('ida')).toBe(true);
    expect(sentidos.has('vuelta')).toBe(true);
  });

  it('returns empty for empty schedules', () => {
    expect(buildAgendaOccurrences([], [], [], DESDE, HASTA)).toEqual([]);
  });

  it('results are sorted by fecha then sentido', () => {
    const sched = makeSchedule({ vuelta_habilitada: true, hora_salida_vuelta: '18:00:00' });
    const result = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]!;
      const curr = result[i]!;
      const cmp = prev.fecha.localeCompare(curr.fecha);
      expect(cmp).toBeLessThanOrEqual(0);
      if (cmp === 0) {
        const sentidoOrder = (s: string) => (s === 'ida' ? 0 : 1);
        expect(sentidoOrder(prev.sentido)).toBeLessThanOrEqual(sentidoOrder(curr.sentido));
      }
    }
  });
});

// ── AS-2: excepciones ─────────────────────────────────────────────────────────

describe('AS-2 exception handling', () => {
  it('no_circula exception sets status=no_circula', () => {
    const sched = makeSchedule();
    // Nov 3 = Monday
    const ex = makeException({ fecha: '2026-11-02', tipo: 'no_circula' });
    const result = buildAgendaOccurrences([sched], [ex], [], DESDE, HASTA);
    const occ = result.find(o => o.fecha === '2026-11-02' && o.sentido === 'unico');
    expect(occ).toBeDefined();
    expect(occ!.status).toBe('no_circula');
    expect(occ!.exception).not.toBeNull();
  });

  it('suspendido exception sets status=suspended', () => {
    const sched = makeSchedule();
    const ex = makeException({ fecha: '2026-11-02', tipo: 'suspendido' });
    const result = buildAgendaOccurrences([sched], [ex], [], DESDE, HASTA);
    const occ = result.find(o => o.fecha === '2026-11-02' && o.sentido === 'unico');
    expect(occ!.status).toBe('suspended');
  });

  it('cambio_horario exception sets status and applies hora_salida override', () => {
    const sched = makeSchedule();
    const ex = makeException({
      fecha: '2026-11-02',
      tipo: 'cambio_horario',
      overrides: { hora_salida: '10:00:00' },
    });
    const result = buildAgendaOccurrences([sched], [ex], [], DESDE, HASTA);
    const occ = result.find(o => o.fecha === '2026-11-02' && o.sentido === 'unico');
    expect(occ!.status).toBe('cambio_horario');
    expect(occ!.effectiveHoraSalida).toBe('10:00:00');
  });

  it('no exception uses schedule hora_salida_ida', () => {
    const sched = makeSchedule({ hora_salida_ida: '07:30:00' });
    const result = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);
    expect(result.every(o => o.effectiveHoraSalida === '07:30:00')).toBe(true);
  });

  it('cambio_conductor exception applies conductor override', () => {
    const sched = makeSchedule({ conductor_id: 'cond-orig' });
    const ex = makeException({
      fecha: '2026-11-02',
      tipo: 'cambio_conductor',
      overrides: { conductor_id: 'cond-new' },
    });
    const result = buildAgendaOccurrences([sched], [ex], [], DESDE, HASTA);
    const occ = result.find(o => o.fecha === '2026-11-02');
    expect(occ!.effectiveConductorId).toBe('cond-new');
  });
});

// ── AS-3: links (materializadas) ──────────────────────────────────────────────

describe('AS-3 occurrence links exclusion', () => {
  it('excludes occurrences that already have a link (materialized)', () => {
    const sched = makeSchedule();
    const link = makeLink({ fecha: '2026-11-06', sentido: 'unico' }); // Friday
    const result = buildAgendaOccurrences([sched], [], [link], DESDE, HASTA);
    const found = result.find(o => o.fecha === '2026-11-06' && o.sentido === 'unico');
    expect(found).toBeUndefined();
  });

  it('keeps other occurrences when one is linked', () => {
    const sched = makeSchedule();
    const link = makeLink({ fecha: '2026-11-06', sentido: 'unico' });
    const result = buildAgendaOccurrences([sched], [], [link], DESDE, HASTA);
    // Monday and Wednesday remain
    expect(result.find(o => o.fecha === '2026-11-02')).toBeDefined();
    expect(result.find(o => o.fecha === '2026-11-04')).toBeDefined();
    expect(result.find(o => o.fecha === '2026-11-06')).toBeUndefined();
  });

  it('link for vuelta does not exclude ida', () => {
    const sched = makeSchedule({ vuelta_habilitada: true });
    const link = makeLink({ fecha: '2026-11-02', sentido: 'vuelta' });
    const result = buildAgendaOccurrences([sched], [], [link], DESDE, HASTA);
    const idaOcc = result.find(o => o.fecha === '2026-11-02' && o.sentido === 'ida');
    expect(idaOcc).toBeDefined();
    const vueltaOcc = result.find(o => o.fecha === '2026-11-02' && o.sentido === 'vuelta');
    expect(vueltaOcc).toBeUndefined();
  });
});

// ── AS-4: getOccurrencesForDay ────────────────────────────────────────────────

describe('AS-4 getOccurrencesForDay', () => {
  it('returns only occurrences for the given day', () => {
    const sched = makeSchedule();
    const all = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);
    const monday = new Date('2026-11-02T12:00:00');
    const dayOccs = getOccurrencesForDay(all, monday);
    expect(dayOccs.every(o => o.fecha === '2026-11-02')).toBe(true);
    expect(dayOccs.length).toBeGreaterThan(0);
  });

  it('returns empty for a day with no occurrences', () => {
    const sched = makeSchedule({ dias_semana: [3] }); // only Wednesday
    const all = buildAgendaOccurrences([sched], [], [], DESDE, HASTA);
    const monday = new Date('2026-11-02T12:00:00'); // Monday
    expect(getOccurrencesForDay(all, monday)).toHaveLength(0);
  });

  it('returns empty for empty occurrences array', () => {
    const monday = new Date('2026-11-02T12:00:00');
    expect(getOccurrencesForDay([], monday)).toHaveLength(0);
  });
});

// ── AS-5: detectConflicts ─────────────────────────────────────────────────────

describe('AS-5 detectConflicts', () => {
  const occ: AgendaOccurrence = {
    fecha: '2026-11-02',
    sentido: 'ida',
    status: 'pending',
    schedule: makeSchedule(),
    exception: null,
    effectiveHoraSalida: '08:00:00',
    effectiveConductorId: 'cond-1',
    effectiveVehicleId: 'veh-1',
  };

  function makeSvc(overrides: Partial<TradeTransportService> = {}): TradeTransportService {
    return {
      id: 'svc-1',
      org_id: 'org-1',
      titulo: 'Test svc',
      tipo_servicio: 'regular',
      estado: 'confirmado',
      fecha_inicio: '2026-11-02T09:00:00',
      fecha_fin: '2026-11-02T11:00:00',
      vehicle_id: null,
      conductor_id: null,
      client_id: null,
      quote_id: null,
      origen: null,
      destino: null,
      origen_detalle: null,
      destino_detalle: null,
      paradas: [],
      num_viajeros: null,
      instrucciones_conductor: null,
      observaciones: null,
      precio_acordado: null,
      contacto_principal: null,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
      ...overrides,
    } as TradeTransportService;
  }

  it('detects vehicle conflict on same day', () => {
    const svc = makeSvc({ vehicle_id: 'veh-1' });
    const conflicts = detectConflicts(occ, [svc]);
    expect(conflicts).toHaveLength(1);
  });

  it('detects conductor conflict on same day', () => {
    const svc = makeSvc({ conductor_id: 'cond-1' });
    const conflicts = detectConflicts(occ, [svc]);
    expect(conflicts).toHaveLength(1);
  });

  it('no conflict for different vehicle and conductor', () => {
    const svc = makeSvc({ vehicle_id: 'veh-other', conductor_id: 'cond-other' });
    const conflicts = detectConflicts(occ, [svc]);
    expect(conflicts).toHaveLength(0);
  });

  it('cancelled services are excluded from conflicts', () => {
    const svc = makeSvc({ vehicle_id: 'veh-1', estado: 'cancelado' });
    const conflicts = detectConflicts(occ, [svc]);
    expect(conflicts).toHaveLength(0);
  });

  it('no conflict for different day', () => {
    const svc = makeSvc({ vehicle_id: 'veh-1', fecha_inicio: '2026-11-03T09:00:00' });
    const conflicts = detectConflicts(occ, [svc]);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty when no services', () => {
    expect(detectConflicts(occ, [])).toHaveLength(0);
  });
});

// ── AS-6: multitenant isolation ───────────────────────────────────────────────

describe('AS-6 schedule scope', () => {
  it('handles multiple schedules in the same range', () => {
    const sched1 = makeSchedule({ id: 'sched-1', dias_semana: [1] }); // Mondays
    const sched2 = makeSchedule({ id: 'sched-2', nombre: 'Ruta B', dias_semana: [3] }); // Wednesdays
    const result = buildAgendaOccurrences([sched1, sched2], [], [], DESDE, HASTA);
    const sched1Occs = result.filter(o => o.schedule.id === 'sched-1');
    const sched2Occs = result.filter(o => o.schedule.id === 'sched-2');
    expect(sched1Occs.every(o => o.fecha.endsWith('-02'))).toBe(true); // Nov 2 (Mon)
    expect(sched2Occs.every(o => o.fecha.endsWith('-04'))).toBe(true); // Nov 4 (Wed)
  });

  it('exception for one schedule does not affect another', () => {
    const sched1 = makeSchedule({ id: 'sched-1', dias_semana: [1] });
    const sched2 = makeSchedule({ id: 'sched-2', nombre: 'Ruta B', dias_semana: [1] });
    const ex = makeException({ schedule_id: 'sched-1', fecha: '2026-11-02', tipo: 'no_circula' });
    const result = buildAgendaOccurrences([sched1, sched2], [ex], [], DESDE, HASTA);
    const occ1 = result.find(o => o.schedule.id === 'sched-1' && o.fecha === '2026-11-02');
    const occ2 = result.find(o => o.schedule.id === 'sched-2' && o.fecha === '2026-11-02');
    expect(occ1!.status).toBe('no_circula');
    expect(occ2!.status).toBe('pending');
  });
});
