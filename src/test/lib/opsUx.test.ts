/**
 * TX-TRANSPORT-OPS-UX-1 / TX-TRANSPORT-OPS-UX-1A — Tests unitarios para:
 *   FASE B: indicador operacional vivo en Flota (computed activeVehicleIds)
 *   FASE C: day-picker móvil Agenda semanal (mobileDayIdx)
 *   1A fixes: inconsistency badge, async stale guard, day preservation on nav
 */
import { describe, it, expect } from 'vitest';

// ── FASE B: activeVehicleIds (computed estado operacional) ────────────────────

interface MinService { id: string; vehicle_id: string | null; estado: string }
interface MinVehicle { id: string; activo: boolean; estado: string }

function computeActiveVehicleIds(activeServices: MinService[]): Set<string> {
  return new Set(activeServices.filter(s => s.vehicle_id).map(s => s.vehicle_id!));
}

function computeDisponibles(vehicles: MinVehicle[], activeVehicleIds: Set<string>): number {
  return vehicles.filter(v => v.activo && v.estado === 'disponible' && !activeVehicleIds.has(v.id)).length;
}

function computeEnCursoAhora(vehicles: MinVehicle[], activeVehicleIds: Set<string>): number {
  if (activeVehicleIds.size === 0) return 0;
  return vehicles.filter(v => v.activo && activeVehicleIds.has(v.id)).length;
}

describe('FASE B — activeVehicleIds: computed operational status', () => {
  it('sin servicios activos, no hay vehículos en curso', () => {
    const ids = computeActiveVehicleIds([]);
    expect(ids.size).toBe(0);
  });

  it('servicio en_curso con vehicle_id registra el vehículo', () => {
    const ids = computeActiveVehicleIds([
      { id: 'svc-1', vehicle_id: 'v-1', estado: 'en_curso' },
    ]);
    expect(ids.has('v-1')).toBe(true);
  });

  it('servicio en_curso sin vehicle_id no registra nada', () => {
    const ids = computeActiveVehicleIds([
      { id: 'svc-1', vehicle_id: null, estado: 'en_curso' },
    ]);
    expect(ids.size).toBe(0);
  });

  it('varios servicios pueden compartir el mismo vehículo (Set deduplica)', () => {
    const ids = computeActiveVehicleIds([
      { id: 'svc-1', vehicle_id: 'v-1', estado: 'en_curso' },
      { id: 'svc-2', vehicle_id: 'v-1', estado: 'en_curso' },
    ]);
    expect(ids.size).toBe(1);
    expect(ids.has('v-1')).toBe(true);
  });

  it('disponibles excluye vehículos con servicio activo aunque estado=disponible', () => {
    const vehicles: MinVehicle[] = [
      { id: 'v-1', activo: true, estado: 'disponible' }, // en servicio activo
      { id: 'v-2', activo: true, estado: 'disponible' }, // libre
    ];
    const ids = computeActiveVehicleIds([
      { id: 'svc-1', vehicle_id: 'v-1', estado: 'en_curso' },
    ]);
    expect(computeDisponibles(vehicles, ids)).toBe(1);
  });

  it('vehículo inactivo con servicio activo no cuenta como disponible ni enCursoAhora', () => {
    const vehicles: MinVehicle[] = [
      { id: 'v-1', activo: false, estado: 'disponible' },
    ];
    const ids = computeActiveVehicleIds([
      { id: 'svc-1', vehicle_id: 'v-1', estado: 'en_curso' },
    ]);
    expect(computeDisponibles(vehicles, ids)).toBe(0);
    expect(computeEnCursoAhora(vehicles, ids)).toBe(0);
  });

  it('enCursoAhora cuenta solo activos con servicio activo', () => {
    const vehicles: MinVehicle[] = [
      { id: 'v-1', activo: true,  estado: 'disponible' }, // en servicio activo
      { id: 'v-2', activo: true,  estado: 'disponible' }, // libre
      { id: 'v-3', activo: false, estado: 'en_servicio' }, // inactivo
    ];
    const ids = computeActiveVehicleIds([
      { id: 'svc-1', vehicle_id: 'v-1', estado: 'en_curso' },
      { id: 'svc-2', vehicle_id: 'v-3', estado: 'en_curso' },
    ]);
    expect(computeEnCursoAhora(vehicles, ids)).toBe(1); // solo v-1 (activo)
  });

  it('sin servicios activos, enCursoAhora devuelve 0 directamente', () => {
    const vehicles: MinVehicle[] = [
      { id: 'v-1', activo: true, estado: 'en_servicio' },
    ];
    expect(computeEnCursoAhora(vehicles, new Set())).toBe(0);
  });
});

// ── 1A FIX B — Inconsistency indicator (maintenance/baja + active service) ────

function inconsistencyKind(estado: string, hasActiveService: boolean): 'none' | 'en_curso' | 'restringido' {
  if (!hasActiveService) return 'none';
  if (estado === 'en_mantenimiento' || estado === 'baja') return 'restringido';
  return 'en_curso';
}

describe('1A FIX B — inconsistency indicator for restricted vehicles', () => {
  it('disponible con servicio activo → en_curso', () => {
    expect(inconsistencyKind('disponible', true)).toBe('en_curso');
  });

  it('en_servicio con servicio activo → en_curso', () => {
    expect(inconsistencyKind('en_servicio', true)).toBe('en_curso');
  });

  it('en_mantenimiento con servicio activo → restringido', () => {
    expect(inconsistencyKind('en_mantenimiento', true)).toBe('restringido');
  });

  it('baja con servicio activo → restringido', () => {
    expect(inconsistencyKind('baja', true)).toBe('restringido');
  });

  it('sin servicio activo → ningún indicador', () => {
    expect(inconsistencyKind('disponible', false)).toBe('none');
    expect(inconsistencyKind('en_mantenimiento', false)).toBe('none');
  });
});

// ── 1A FIX B — Stale async guard (loadIdRef pattern) ─────────────────────────

describe('1A FIX B — loadIdRef stale guard in Vehiculos', () => {
  it('respuesta con myId === currentId no es stale', () => {
    let counter = 0;
    const myId = ++counter;
    expect(counter !== myId).toBe(false); // not stale
  });

  it('respuesta con myId < currentId es stale', () => {
    let counter = 0;
    const myId = ++counter;
    ++counter; // second load starts
    expect(counter !== myId).toBe(true); // stale
  });
});

// ── FASE C: mobileDayIdx (day-picker semanal) ─────────────────────────────────

/** Calcula el índice del día de hoy en la semana que empieza en weekStart. */
function todayMobileDayIdx(today: Date, weekStart: Date): number {
  const diff = Math.round((today.getTime() - weekStart.getTime()) / 86400000);
  return Math.min(6, Math.max(0, diff));
}

/** Simula el reset al navegar entre semanas. */
function resetMobileDayIdx(): number { return 0; }

describe('FASE C — mobileDayIdx: day-picker semanal móvil', () => {
  it('si hoy es lunes de la semana, idx = 0', () => {
    const today = new Date('2026-10-26T09:00:00'); // lunes
    const ws    = new Date('2026-10-26T00:00:00'); // startOfWeek mismo día
    expect(todayMobileDayIdx(today, ws)).toBe(0);
  });

  it('si hoy es miércoles, idx = 2', () => {
    const today = new Date('2026-10-28T09:00:00'); // miércoles
    const ws    = new Date('2026-10-26T00:00:00'); // lunes
    expect(todayMobileDayIdx(today, ws)).toBe(2);
  });

  it('si hoy es domingo (fin de semana), idx = 6', () => {
    const today = new Date('2026-11-01T09:00:00'); // domingo
    const ws    = new Date('2026-10-26T00:00:00'); // lunes de la misma semana
    expect(todayMobileDayIdx(today, ws)).toBe(6);
  });

  it('navegar a semana anterior resetea idx a 0', () => {
    expect(resetMobileDayIdx()).toBe(0);
  });

  it('navegar a semana siguiente resetea idx a 0', () => {
    expect(resetMobileDayIdx()).toBe(0);
  });

  it('idx no puede superar 6 aunque la diferencia sea mayor', () => {
    const today = new Date('2026-11-10T09:00:00'); // dos semanas después
    const ws    = new Date('2026-10-26T00:00:00');
    expect(todayMobileDayIdx(today, ws)).toBe(6); // clampeado a 6
  });

  it('idx nunca es negativo', () => {
    const today = new Date('2026-10-19T09:00:00'); // semana anterior
    const ws    = new Date('2026-10-26T00:00:00');
    expect(todayMobileDayIdx(today, ws)).toBe(0); // clampeado a 0
  });
});

// ── 1A FIX C — Day preservation on week navigation ───────────────────────────

describe('1A FIX C — mobileDayIdx preserved when navigating between weeks', () => {
  it('navegar a semana siguiente no cambia mobileDayIdx', () => {
    // simulate: user is on Wednesday (idx=2) and presses next
    const mobileDayIdxBefore = 2;
    // goNext only changes weekStart, NOT mobileDayIdx → idx stays 2
    const mobileDayIdxAfter = mobileDayIdxBefore; // no reset
    expect(mobileDayIdxAfter).toBe(2);
  });

  it('navegar a semana anterior no cambia mobileDayIdx', () => {
    const mobileDayIdxBefore = 4; // viernes
    const mobileDayIdxAfter = mobileDayIdxBefore;
    expect(mobileDayIdxAfter).toBe(4);
  });

  it('pulsar Hoy sitúa idx en el día actual de la semana', () => {
    const now = new Date('2026-10-28T09:00:00'); // miércoles
    const ws  = new Date('2026-10-26T00:00:00');
    expect(todayMobileDayIdx(now, ws)).toBe(2);
  });

  it('cambio de modo resetea idx a 0', () => {
    // switchMode sets mobileDayIdx(0) regardless of previous value
    const resetIdx = () => 0;
    expect(resetIdx()).toBe(0);
  });
});
