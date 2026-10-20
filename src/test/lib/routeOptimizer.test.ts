/**
 * routeOptimizer.test.ts
 * Pure-function tests for optimizeDailyRoute and haversineKm.
 * Verifies null-start behavior (no Null Island), priority ordering, and
 * nearest-neighbor with real GeoLocation start.
 */
import { describe, it, expect } from 'vitest';
import { optimizeDailyRoute, haversineKm } from '../../lib/routeOptimizer';
import type { TradeJob } from '../../lib/supabase';

function makeJob(overrides: Partial<TradeJob> = {}): TradeJob {
  return {
    id: Math.random().toString(36).slice(2),
    org_id: 'org1',
    titulo: 'Trabajo test',
    estado: 'pendiente',
    prioridad: 'normal',
    tipo: 'instalacion',
    fecha_inicio: '2026-10-20',
    hora_inicio: '09:00',
    duracion_horas: 1,
    latitud: null,
    longitud: null,
    direccion: null,
    localidad: null,
    cp: null,
    descripcion: null,
    orden_ruta: null,
    trade_clients: null,
    trade_job_workers: [],
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    ...overrides,
  } as TradeJob;
}

// ── Null start: no GPS origin ─────────────────────────────────────────────────

describe('optimizeDailyRoute — null start (no GPS origin)', () => {
  it('TEST-OPT-NULL-1 orders by priority when startLocation is null', () => {
    const jobs = [
      makeJob({ prioridad: 'baja',    hora_inicio: '08:00' }),
      makeJob({ prioridad: 'urgente', hora_inicio: '10:00' }),
      makeJob({ prioridad: 'normal',  hora_inicio: '09:00' }),
    ];
    const result = optimizeDailyRoute(jobs, null);
    expect(result[0].prioridad).toBe('urgente');
    expect(result[1].prioridad).toBe('normal');
    expect(result[2].prioridad).toBe('baja');
  });

  it('TEST-OPT-NULL-2 does NOT use (0,0) as reference — priority beats geographic proximity to Null Island', () => {
    // northern Spain ~4500 km from (0,0); southern Spain ~4200 km from (0,0)
    // With (0,0) as start, nearest-neighbor would pick the southern job first
    // With null start, alta should precede normal regardless of latitude
    const northernNormal = makeJob({ prioridad: 'normal', latitud: 43.3, longitud: -3.8, hora_inicio: '09:00' });
    const southernAlta   = makeJob({ prioridad: 'alta',   latitud: 36.7, longitud: -4.4, hora_inicio: '10:00' });
    const result = optimizeDailyRoute([northernNormal, southernAlta], null);
    expect(result[0].prioridad).toBe('alta');
    expect(result[1].prioridad).toBe('normal');
  });

  it('TEST-OPT-NULL-3 tiebreaks within same priority by hora_inicio ascending', () => {
    const a = makeJob({ prioridad: 'normal', hora_inicio: '14:00' });
    const b = makeJob({ prioridad: 'normal', hora_inicio: '08:00' });
    const c = makeJob({ prioridad: 'normal', hora_inicio: '11:00' });
    const result = optimizeDailyRoute([a, b, c], null);
    expect(result[0].hora_inicio).toBe('08:00');
    expect(result[1].hora_inicio).toBe('11:00');
    expect(result[2].hora_inicio).toBe('14:00');
  });

  it('TEST-OPT-NULL-4 assigns orden_ruta starting at 1', () => {
    const jobs = [makeJob(), makeJob(), makeJob()];
    const result = optimizeDailyRoute(jobs, null);
    expect(result.map(j => j.orden_ruta)).toEqual([1, 2, 3]);
  });

  it('TEST-OPT-NULL-5 returns empty array for empty input', () => {
    expect(optimizeDailyRoute([], null)).toEqual([]);
  });

  it('TEST-OPT-NULL-6 jobs with and without coords both ordered by priority (no split to end)', () => {
    const withCoords  = makeJob({ prioridad: 'baja',    latitud: 43.4, longitud: -3.8 });
    const noCoords    = makeJob({ prioridad: 'urgente', latitud: null, longitud: null  });
    const result = optimizeDailyRoute([withCoords, noCoords], null);
    // urgente should be first even though it has no coords
    expect(result[0].prioridad).toBe('urgente');
    expect(result[1].prioridad).toBe('baja');
  });
});

// ── With GeoLocation start ────────────────────────────────────────────────────

const SANTANDER = { lat: 43.46, lng: -3.81 };
const BILBAO    = { lat: 43.26, lng: -2.93 };
const MADRID    = { lat: 40.42, lng: -3.70 };
const NEAR_SANTANDER = { lat: 43.50, lng: -3.85 }; // ~6 km from Santander

describe('optimizeDailyRoute — with GeoLocation start', () => {
  it('TEST-OPT-GEO-1 urgent jobs appear before normal when start is geocoded', () => {
    const urgent = makeJob({ prioridad: 'urgente', latitud: BILBAO.lat,  longitud: BILBAO.lng  });
    const normal = makeJob({ prioridad: 'normal',  latitud: MADRID.lat,  longitud: MADRID.lng  });
    const result = optimizeDailyRoute([normal, urgent], SANTANDER);
    expect(result[0].prioridad).toBe('urgente');
  });

  it('TEST-OPT-GEO-2 nearest job visited first among same priority', () => {
    const near = makeJob({ prioridad: 'normal', latitud: NEAR_SANTANDER.lat, longitud: NEAR_SANTANDER.lng });
    const far  = makeJob({ prioridad: 'normal', latitud: MADRID.lat,         longitud: MADRID.lng         });
    const result = optimizeDailyRoute([far, near], SANTANDER);
    expect(result[0].id).toBe(near.id);
    expect(result[1].id).toBe(far.id);
  });

  it('TEST-OPT-GEO-3 jobs without coords go after all jobs with coords', () => {
    const withCoords = makeJob({ prioridad: 'normal', latitud: SANTANDER.lat, longitud: SANTANDER.lng });
    const noCoords   = makeJob({ prioridad: 'normal', latitud: null,          longitud: null           });
    const result = optimizeDailyRoute([noCoords, withCoords], SANTANDER);
    expect(result[0].id).toBe(withCoords.id);
    expect(result[1].id).toBe(noCoords.id);
  });

  it('TEST-OPT-GEO-4 assigns orden_ruta starting at 1', () => {
    const jobs = [
      makeJob({ latitud: SANTANDER.lat, longitud: SANTANDER.lng }),
      makeJob({ latitud: BILBAO.lat,    longitud: BILBAO.lng    }),
    ];
    const result = optimizeDailyRoute(jobs, SANTANDER);
    expect(result.map(j => j.orden_ruta)).toEqual([1, 2]);
  });
});

// ── haversineKm ───────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('Santander to Madrid is between 300 and 450 km', () => {
    const d = haversineKm(SANTANDER, MADRID);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(450);
  });

  it('Santander to near-Santander is less than 10 km', () => {
    const d = haversineKm(SANTANDER, NEAR_SANTANDER);
    expect(d).toBeLessThan(10);
  });

  it('same point returns 0', () => {
    expect(haversineKm(SANTANDER, SANTANDER)).toBe(0);
  });
});
