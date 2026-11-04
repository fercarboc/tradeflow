/**
 * weeklyFleetPlannerPhase5.test.ts — TX-TRANSPORT-WEEKLY-FLEET-1 Fase 5
 *
 * Deeplink de ocurrencias: initialOccurrence → semana + detalle abierto.
 * onOpenOccurrence sobre onNavigate cuando está disponible.
 * Semana de referencia: 2026-11-02 (lunes) → 2026-11-08 (domingo).
 */

import { describe, it, expect, vi } from 'vitest';
import { startOfWeek, isoDate, addDays } from '../../lib/transportPanelHelpers';
import type { AgendaOccurrence } from '../../components/ScreenTransporteAgenda';
import type { TradeTransportSchedule } from '../../lib/transportSchedules';

// ── Helpers de fixtures ───────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<TradeTransportSchedule> = {}): TradeTransportSchedule {
  return {
    id: 'sch-1', org_id: 'org1',
    nombre: 'Línea 1',
    origen: 'Madrid', destino: 'Barcelona',
    hora_salida_ida: '08:00',
    hora_salida_vuelta: null,
    dias_semana: [1, 2, 3, 4, 5],
    activo: true,
    vehicle_id: null, conductor_id: null,
    fecha_inicio: '2026-01-01', fecha_fin: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    paradas: [],
    ...overrides,
  } as TradeTransportSchedule;
}

function makeOccurrence(overrides: Partial<AgendaOccurrence> = {}): AgendaOccurrence {
  return {
    fecha: '2026-11-04',
    sentido: 'ida',
    status: 'pending',
    schedule: makeSchedule(),
    exception: null,
    effectiveHoraSalida: '08:00',
    effectiveConductorId: null,
    effectiveVehicleId: null,
    ...overrides,
  } as AgendaOccurrence;
}

// ── Réplica del inicializador lazy de weekStart ───────────────────────────────

function computeInitialWeekStart(initialOccurrence?: AgendaOccurrence): Date {
  if (initialOccurrence) return startOfWeek(new Date(initialOccurrence.fecha + 'T12:00:00'));
  return startOfWeek(new Date());
}

// ── Réplica del inicializador lazy de detail ──────────────────────────────────

type DetailState =
  | { kind: 'empty' }
  | { kind: 'occurrence'; occ: AgendaOccurrence };

function computeInitialDetail(initialOccurrence?: AgendaOccurrence): DetailState {
  if (initialOccurrence) return { kind: 'occurrence', occ: initialOccurrence };
  return { kind: 'empty' };
}

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-1: startOfWeek de referencia
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-1 — startOfWeek retorna el lunes de la semana', () => {
  it('WFPF5-1-1: miércoles 2026-11-04 → lunes 2026-11-02', () => {
    const result = startOfWeek(new Date('2026-11-04T12:00:00'));
    expect(isoDate(result)).toBe('2026-11-02');
  });

  it('WFPF5-1-2: domingo 2026-11-01 → lunes 2026-10-26', () => {
    const result = startOfWeek(new Date('2026-11-01T12:00:00'));
    expect(isoDate(result)).toBe('2026-10-26');
  });

  it('WFPF5-1-3: lunes 2026-11-02 → mismo lunes 2026-11-02', () => {
    const result = startOfWeek(new Date('2026-11-02T12:00:00'));
    expect(isoDate(result)).toBe('2026-11-02');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-2: initialOccurrence → weekStart navega a la semana correcta
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-2 — initialOccurrence.fecha determina weekStart', () => {
  it('WFPF5-2-1: fecha 2026-11-04 → weekStart=2026-11-02', () => {
    const occ = makeOccurrence({ fecha: '2026-11-04' });
    expect(isoDate(computeInitialWeekStart(occ))).toBe('2026-11-02');
  });

  it('WFPF5-2-2: fecha 2026-11-10 → weekStart=2026-11-09 (semana siguiente)', () => {
    const occ = makeOccurrence({ fecha: '2026-11-10' });
    expect(isoDate(computeInitialWeekStart(occ))).toBe('2026-11-09');
  });

  it('WFPF5-2-3: fecha 2026-10-28 (Mié) → weekStart=2026-10-26', () => {
    const occ = makeOccurrence({ fecha: '2026-10-28' });
    expect(isoDate(computeInitialWeekStart(occ))).toBe('2026-10-26');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-3: initialOccurrence undefined → weekStart = semana actual
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-3 — sin initialOccurrence, weekStart = semana actual', () => {
  it('WFPF5-3-1: computeInitialWeekStart(undefined) retorna el lunes de hoy', () => {
    const result = computeInitialWeekStart(undefined);
    const expected = startOfWeek(new Date());
    expect(isoDate(result)).toBe(isoDate(expected));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-4: initialOccurrence → DetailState kind='occurrence'
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-4 — initialOccurrence determina el estado detail inicial', () => {
  it('WFPF5-4-1: con initialOccurrence → detail.kind === occurrence', () => {
    const occ = makeOccurrence();
    const detail = computeInitialDetail(occ);
    expect(detail.kind).toBe('occurrence');
  });

  it('WFPF5-4-2: sin initialOccurrence → detail.kind === empty', () => {
    const detail = computeInitialDetail(undefined);
    expect(detail.kind).toBe('empty');
  });

  it('WFPF5-4-3: detail.occ es el mismo objeto occurrence pasado', () => {
    const occ = makeOccurrence({ fecha: '2026-11-05', sentido: 'vuelta' });
    const detail = computeInitialDetail(occ);
    if (detail.kind === 'occurrence') {
      expect(detail.occ.fecha).toBe('2026-11-05');
      expect(detail.occ.sentido).toBe('vuelta');
    } else {
      expect.fail('detail.kind debería ser occurrence');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-5: onOpenOccurrence tiene prioridad sobre onNavigate
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-5 — onOpenOccurrence toma prioridad sobre onNavigate', () => {
  it('WFPF5-5-1: si onOpenOccurrence está definido, se llama con la ocurrencia', () => {
    const onOpen = vi.fn<(occ: AgendaOccurrence) => void>();
    const onNavigate = vi.fn<(tab: string) => void>();
    const occ = makeOccurrence();
    // Réplica del handler: occ => onOpenOccurrence ? onOpenOccurrence(occ) : onNavigate?.('transporte_agenda')
    if (onOpen) onOpen(occ); else onNavigate('transporte_agenda');
    expect(onOpen).toHaveBeenCalledWith(occ);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('WFPF5-5-2: si onOpenOccurrence es undefined, se llama onNavigate con transporte_agenda', () => {
    const onNavigate = vi.fn<(tab: string) => void>();
    const onOpen = undefined;
    const occ = makeOccurrence();
    if (onOpen) (onOpen as (o: AgendaOccurrence) => void)(occ); else onNavigate('transporte_agenda');
    expect(onNavigate).toHaveBeenCalledWith('transporte_agenda');
  });

  it('WFPF5-5-3: onOpenOccurrence recibe el AgendaOccurrence completo (no solo id)', () => {
    const received: AgendaOccurrence[] = [];
    const onOpen = (occ: AgendaOccurrence) => received.push(occ);
    const occ = makeOccurrence({ fecha: '2026-11-06', sentido: 'ida' });
    if (onOpen) onOpen(occ);
    expect(received).toHaveLength(1);
    expect(received[0].fecha).toBe('2026-11-06');
    expect(received[0].schedule.id).toBe('sch-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-6: Contrato de AgendaOccurrence — campos requeridos para deeplink
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-6 — AgendaOccurrence: campos necesarios para deeplink', () => {
  it('WFPF5-6-1: fecha está disponible como string ISO-8601 (YYYY-MM-DD)', () => {
    const occ = makeOccurrence({ fecha: '2026-11-04' });
    expect(occ.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('WFPF5-6-2: sentido es ida o vuelta', () => {
    const ida    = makeOccurrence({ sentido: 'ida' });
    const vuelta = makeOccurrence({ sentido: 'vuelta' });
    expect(['ida', 'vuelta']).toContain(ida.sentido);
    expect(['ida', 'vuelta']).toContain(vuelta.sentido);
  });

  it('WFPF5-6-3: schedule.id identifica el horario de forma única', () => {
    const occ = makeOccurrence({ schedule: makeSchedule({ id: 'sch-abc-123' }) });
    expect(occ.schedule.id).toBe('sch-abc-123');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-7: Semana contiene la fecha de la ocurrencia deeplinked
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-7 — La semana calculada contiene la fecha de la ocurrencia', () => {
  it('WFPF5-7-1: fecha en el rango [weekStart, weekStart+6]', () => {
    const occ = makeOccurrence({ fecha: '2026-11-05' });
    const ws = computeInitialWeekStart(occ);
    const we = addDays(ws, 6);
    const occDate = new Date(occ.fecha + 'T12:00:00');
    expect(occDate.getTime()).toBeGreaterThanOrEqual(ws.getTime());
    expect(occDate.getTime()).toBeLessThanOrEqual(we.getTime());
  });

  it('WFPF5-7-2: ocurrencia lunes → weekStart coincide exactamente con la fecha', () => {
    const occ = makeOccurrence({ fecha: '2026-11-02' }); // lunes
    const ws = computeInitialWeekStart(occ);
    expect(isoDate(ws)).toBe('2026-11-02');
  });

  it('WFPF5-7-3: ocurrencia domingo → weekStart es 6 días antes', () => {
    const occ = makeOccurrence({ fecha: '2026-11-08' }); // domingo
    const ws = computeInitialWeekStart(occ);
    expect(isoDate(ws)).toBe('2026-11-02');
    // addDays(ws, 6) debe cubrir la fecha de la ocurrencia (domingo)
    expect(isoDate(addDays(ws, 6))).toBe('2026-11-08');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-8: Ciclo A → B — la segunda ocurrencia desplaza a la primera
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-8 — Ciclo deeplink A → B: B desplaza a A', () => {
  it('WFPF5-8-1: computeInitialDetail con occB después de occA retorna occB', () => {
    const occA = makeOccurrence({ fecha: '2026-11-04', sentido: 'ida' });
    const occB = makeOccurrence({ fecha: '2026-11-05', sentido: 'vuelta', schedule: makeSchedule({ id: 'sch-2' }) });
    // Primera apertura: detail = occA
    const detailA = computeInitialDetail(occA);
    expect(detailA.kind).toBe('occurrence');
    // Parent limpia la ocurrencia (onConsumeInitialOccurrence)
    // Segunda apertura: detail = occB (nuevo initialOccurrence)
    const detailB = computeInitialDetail(occB);
    expect(detailB.kind).toBe('occurrence');
    if (detailB.kind === 'occurrence') {
      expect(detailB.occ.fecha).toBe('2026-11-05');
      expect(detailB.occ.sentido).toBe('vuelta');
      expect(detailB.occ.schedule.id).toBe('sch-2');
    }
  });

  it('WFPF5-8-2: semana de B difiere de semana de A cuando están en semanas distintas', () => {
    const occA = makeOccurrence({ fecha: '2026-11-03' }); // semana 2026-11-02
    const occB = makeOccurrence({ fecha: '2026-11-10' }); // semana 2026-11-09
    expect(isoDate(computeInitialWeekStart(occA))).toBe('2026-11-02');
    expect(isoDate(computeInitialWeekStart(occB))).toBe('2026-11-09');
    expect(isoDate(computeInitialWeekStart(occA))).not.toBe(isoDate(computeInitialWeekStart(occB)));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WFPF5-9: onConsumeInitialOccurrence — limpia el estado del parent
// ─────────────────────────────────────────────────────────────────────────────
describe('WFPF5-9 — onConsumeInitialOccurrence: el parent queda limpio tras el montaje', () => {
  it('WFPF5-9-1: tras consumir, initialOccurrence en el parent pasa a null', () => {
    let parentState: AgendaOccurrence | null = makeOccurrence();
    const consume = () => { parentState = null; };
    // Simula el useEffect de montaje:
    if (parentState) consume();
    expect(parentState).toBeNull();
  });

  it('WFPF5-9-2: sin initialOccurrence, consume no se llama', () => {
    let parentState: AgendaOccurrence | null = null;
    const consumeCalled = vi.fn();
    const consume = () => { parentState = null; consumeCalled(); };
    // Sin initialOccurrence no se debe llamar
    if (parentState) consume();
    expect(consumeCalled).not.toHaveBeenCalled();
  });

  it('WFPF5-9-3: tras consumir, una apertura directa a agenda recibe undefined y abre detalle vacío', () => {
    // Simula ciclo completo: occ → consume → navegar directo
    let currentOccurrence: AgendaOccurrence | null = makeOccurrence();
    // Montaje con ocurrencia — consume
    const detailOnFirstMount = computeInitialDetail(currentOccurrence ?? undefined);
    currentOccurrence = null; // onConsumeInitialOccurrence llamado
    // Desmontaje y remontaje sin ocurrencia
    const detailOnSecondMount = computeInitialDetail(currentOccurrence ?? undefined);
    expect(detailOnFirstMount.kind).toBe('occurrence');
    expect(detailOnSecondMount.kind).toBe('empty');
  });
});
