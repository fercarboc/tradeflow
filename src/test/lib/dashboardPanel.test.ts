/**
 * TX-DASHBOARD-UX-1 — Tests para helpers del Panel de Transporte rediseñado.
 * Cubre: getProximasSalidas, getSinItinerario, sin duplicación, filtros de estado.
 */

import { describe, it, expect } from 'vitest';
import {
  getProximasSalidas,
  getSinItinerario,
  computeKpis,
} from '../../lib/transportPanelHelpers';
import type { ServiceLike } from '../../lib/transportPanelHelpers';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-10-27T10:00:00');

function svc(overrides: Partial<ServiceLike> & { id: string }): ServiceLike {
  return {
    estado:       'confirmado',
    fecha_inicio: '2026-10-27T14:00:00',
    fecha_fin:    '2026-10-27T20:00:00',
    vehicle_id:   null,
    conductor_id: null,
    origen:       'Granada',
    destino:      'Sierra Nevada',
    ...overrides,
  };
}

// ── getProximasSalidas ─────────────────────────────────────────────────────────

describe('getProximasSalidas', () => {
  it('DASH-1 — retorna servicios futuros no iniciados', () => {
    const services = [
      svc({ id: 's1', estado: 'confirmado', fecha_inicio: '2026-10-27T12:00:00' }),
      svc({ id: 's2', estado: 'borrador',   fecha_inicio: '2026-10-27T16:00:00' }),
    ];
    const result = getProximasSalidas(services, NOW);
    expect(result.map(s => s.id)).toEqual(['s1', 's2']);
  });

  it('DASH-2 — excluye servicios cancelados', () => {
    const services = [
      svc({ id: 's1', estado: 'cancelado',  fecha_inicio: '2026-10-27T12:00:00' }),
      svc({ id: 's2', estado: 'confirmado', fecha_inicio: '2026-10-27T15:00:00' }),
    ];
    const result = getProximasSalidas(services, NOW);
    expect(result.map(s => s.id)).toEqual(['s2']);
  });

  it('DASH-3 — excluye servicios completados', () => {
    const services = [
      svc({ id: 's1', estado: 'completado', fecha_inicio: '2026-10-27T11:00:00' }),
      svc({ id: 's2', estado: 'confirmado', fecha_inicio: '2026-10-27T15:00:00' }),
    ];
    const result = getProximasSalidas(services, NOW);
    expect(result.map(s => s.id)).toEqual(['s2']);
  });

  it('DASH-4 — excluye servicios en_curso', () => {
    const services = [
      svc({ id: 's1', estado: 'en_curso',   fecha_inicio: '2026-10-27T09:00:00' }),
      svc({ id: 's2', estado: 'confirmado', fecha_inicio: '2026-10-27T15:00:00' }),
    ];
    const result = getProximasSalidas(services, NOW);
    expect(result.map(s => s.id)).toEqual(['s2']);
  });

  it('DASH-5 — excluye servicios con fecha_inicio <= now', () => {
    const services = [
      svc({ id: 's1', estado: 'confirmado', fecha_inicio: '2026-10-27T09:00:00' }),
      svc({ id: 's2', estado: 'confirmado', fecha_inicio: '2026-10-27T10:00:00' }),
    ];
    // both are <= NOW (10:00)
    const result = getProximasSalidas(services, NOW);
    expect(result).toHaveLength(0);
  });

  it('DASH-6 — devuelve lista vacía si no hay salidas futuras', () => {
    expect(getProximasSalidas([], NOW)).toHaveLength(0);
  });

  it('DASH-7 — ordena por fecha_inicio ascendente (más cercano primero)', () => {
    const services = [
      svc({ id: 's3', estado: 'confirmado', fecha_inicio: '2026-10-27T18:00:00' }),
      svc({ id: 's1', estado: 'confirmado', fecha_inicio: '2026-10-27T11:00:00' }),
      svc({ id: 's2', estado: 'confirmado', fecha_inicio: '2026-10-27T14:00:00' }),
    ];
    const result = getProximasSalidas(services, NOW);
    expect(result.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('DASH-8 — incluye borradores como salidas pendientes', () => {
    const services = [
      svc({ id: 's1', estado: 'borrador', fecha_inicio: '2026-10-27T12:00:00' }),
    ];
    const result = getProximasSalidas(services, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });
});

// ── getSinItinerario ───────────────────────────────────────────────────────────

describe('getSinItinerario', () => {
  it('DASH-9 — detecta servicio sin origen', () => {
    const services = [
      svc({ id: 's1', origen: null,      destino: 'Madrid' }),
      svc({ id: 's2', origen: 'Bilbao',  destino: 'Madrid' }),
    ];
    const result = getSinItinerario(services);
    expect(result.map(s => s.id)).toEqual(['s1']);
  });

  it('DASH-10 — detecta servicio sin destino', () => {
    const services = [
      svc({ id: 's1', origen: 'Madrid', destino: null }),
      svc({ id: 's2', origen: 'Madrid', destino: 'Bilbao' }),
    ];
    const result = getSinItinerario(services);
    expect(result.map(s => s.id)).toEqual(['s1']);
  });

  it('DASH-11 — detecta servicio sin origen NI destino', () => {
    const s = svc({ id: 's1', origen: null, destino: null });
    const result = getSinItinerario([s]);
    expect(result).toHaveLength(1);
  });

  it('DASH-12 — retorna vacío si todos tienen itinerario', () => {
    const services = [
      svc({ id: 's1', origen: 'Granada', destino: 'Sierra Nevada' }),
      svc({ id: 's2', origen: 'Madrid',  destino: 'Bilbao'        }),
    ];
    expect(getSinItinerario(services)).toHaveLength(0);
  });

  it('DASH-13 — excluye cancelados del listado de pendientes', () => {
    const services = [
      svc({ id: 's1', estado: 'cancelado', origen: null, destino: null }),
      svc({ id: 's2', estado: 'confirmado', origen: null, destino: 'Madrid' }),
    ];
    const result = getSinItinerario(services);
    expect(result.map(s => s.id)).toEqual(['s2']);
  });

  it('DASH-14 — excluye completados del listado de pendientes', () => {
    const services = [
      svc({ id: 's1', estado: 'completado', origen: null, destino: 'Madrid' }),
      svc({ id: 's2', estado: 'confirmado', origen: null, destino: 'Madrid' }),
    ];
    const result = getSinItinerario(services);
    expect(result.map(s => s.id)).toEqual(['s2']);
  });

  it('DASH-15 — retorna vacío con lista vacía', () => {
    expect(getSinItinerario([])).toHaveLength(0);
  });
});

// ── Sin duplicación entre secciones ───────────────────────────────────────────

describe('sin duplicación entre secciones del panel', () => {
  const services: ServiceLike[] = [
    svc({ id: 'ec',   estado: 'en_curso',   fecha_inicio: '2026-10-27T08:00:00', origen: 'A', destino: 'B' }),
    svc({ id: 'fut',  estado: 'confirmado', fecha_inicio: '2026-10-27T14:00:00', origen: 'A', destino: 'B' }),
    svc({ id: 'noR',  estado: 'confirmado', fecha_inicio: '2026-10-27T16:00:00', origen: null, destino: null }),
    svc({ id: 'canc', estado: 'cancelado',  fecha_inicio: '2026-10-27T09:00:00', origen: 'A', destino: 'B' }),
  ];

  it('DASH-16 — un servicio en_curso no aparece en próximas salidas', () => {
    const proximas = getProximasSalidas(services, NOW);
    expect(proximas.some(s => s.id === 'ec')).toBe(false);
  });

  it('DASH-17 — un servicio cancelado no aparece en ninguna sección del panel', () => {
    const proximas = getProximasSalidas(services, NOW);
    const sinItin  = getSinItinerario(services);
    expect(proximas.some(s => s.id === 'canc')).toBe(false);
    expect(sinItin.some(s =>  s.id === 'canc')).toBe(false);
  });

  it('DASH-18 — servicio sin itinerario puede aparecer en sinItinerario y en proximas si es futuro', () => {
    const proximas = getProximasSalidas(services, NOW);
    const sinItin  = getSinItinerario(services);
    // 'noR' is future AND has no route — it can appear in both lists
    expect(proximas.some(s => s.id === 'noR')).toBe(true);
    expect(sinItin.some(s =>  s.id === 'noR')).toBe(true);
  });

  it('DASH-19 — computeKpis no duplica vehicleIds aunque el mismo vehiculo tenga dos servicios', () => {
    const multi: ServiceLike[] = [
      svc({ id: 'a', vehicle_id: 'v1', fecha_inicio: '2026-10-27T08:00:00', fecha_fin: '2026-10-27T10:00:00' }),
      svc({ id: 'b', vehicle_id: 'v1', fecha_inicio: '2026-10-27T14:00:00', fecha_fin: '2026-10-27T16:00:00' }),
    ];
    const kpis = computeKpis(multi);
    expect(kpis.assignedVehicleIds.size).toBe(1);
    expect(kpis.totalActiveServices).toBe(2);
  });
});

// ── KPI — reglas de cálculo ────────────────────────────────────────────────────

describe('KPI — reglas de cálculo documentadas', () => {
  it('DASH-20 — totalActiveServices excluye cancelados', () => {
    const s = [
      svc({ id: 's1', estado: 'confirmado' }),
      svc({ id: 's2', estado: 'cancelado'  }),
      svc({ id: 's3', estado: 'en_curso'   }),
    ];
    expect(computeKpis(s).totalActiveServices).toBe(2);
  });

  it('DASH-21 — serviciosEnCurso solo cuenta en_curso', () => {
    const s = [
      svc({ id: 's1', estado: 'en_curso'   }),
      svc({ id: 's2', estado: 'en_curso'   }),
      svc({ id: 's3', estado: 'confirmado' }),
    ];
    expect(computeKpis(s).serviciosEnCurso).toBe(2);
  });

  it('DASH-22 — serviciosConfirmados solo cuenta confirmado', () => {
    const s = [
      svc({ id: 's1', estado: 'confirmado' }),
      svc({ id: 's2', estado: 'borrador'   }),
      svc({ id: 's3', estado: 'en_curso'   }),
    ];
    expect(computeKpis(s).serviciosConfirmados).toBe(1);
  });

  it('DASH-23 — assignedConductorIds no incluye null', () => {
    const s = [
      svc({ id: 's1', conductor_id: null }),
      svc({ id: 's2', conductor_id: 'c1' }),
    ];
    const kpis = computeKpis(s);
    expect(kpis.assignedConductorIds.has('c1')).toBe(true);
    expect(kpis.assignedConductorIds.size).toBe(1);
  });
});
