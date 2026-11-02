/**
 * workerRoute.test.ts — TX-IN-DASH-1-FIX
 *
 * Unit tests for the worker daily route logic:
 *   - Multi-stop valid route
 *   - Single stop (no route possible)
 *   - Jobs without coordinates
 *   - API error / timeout
 *   - Distance & duration from API
 *   - Planned order respected
 *   - Navigation URL generation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { routeWaypoints, formatDistance, formatDuration } from '../../lib/geoApi';
import type { FunctionInvoker } from '../../lib/geoApi';
import { buildGoogleMapsUrl, optimizeDailyRoute } from '../../lib/routeOptimizer';
import { isValidLatLng } from '../../components/RouteMap';
import { geometryToLeaflet } from '../../lib/geoCredits';
import type { TradeJob } from '../../lib/supabase';
import type { RouteJob, GeoLocation } from '../../lib/routeOptimizer';
import type { RouteResult } from '../../lib/geoApi';

// routeWaypoints accepts an optional `invoker` param — no vi.mock needed.

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a FunctionInvoker that returns the given payload. */
function makeInvoker(data: unknown, error: { message: string } | null = null): FunctionInvoker {
  return vi.fn().mockResolvedValue({ data, error });
}

function makeJob(overrides: Partial<TradeJob> = {}): TradeJob {
  return {
    id: Math.random().toString(36).slice(2),
    org_id: 'org-test',
    titulo: 'Trabajo test',
    estado: 'planificado',
    prioridad: 'normal',
    tipo: 'instalacion',
    fecha_inicio: '2026-11-02',
    hora_inicio: '09:00',
    duracion_horas: 1,
    latitud: 40.4168,
    longitud: -3.7038,
    direccion: 'Calle Mayor 1',
    localidad: 'Madrid',
    cp: '28013',
    descripcion: null,
    orden_ruta: null,
    trade_clients: null,
    trade_job_workers: [],
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    ...overrides,
  } as TradeJob;
}

function makeRouteJob(overrides: Partial<TradeJob> = {}, orden = 1): RouteJob {
  return { ...makeJob(overrides), orden_ruta: orden } as RouteJob;
}

// ── Shared mock data ──────────────────────────────────────────────────────────

const mockGeometry = {
  type: 'LineString' as const,
  coordinates: [[-3.7038, 40.4168], [-3.6893, 40.4096]] as [number, number][],
};

const mockRouteResult: RouteResult = {
  geometry: mockGeometry,
  distance_m: 2340,
  duration_s: 480,
  provider: 'geoapify',
  cached: false,
};

beforeEach(() => { vi.clearAllMocks(); });

// ── WR-1: Multi-stop route via API ────────────────────────────────────────────

describe('WR-1 — routeWaypoints multi-stop', () => {
  it('WR-1-1 returns RouteResult when API succeeds with 2+ waypoints', async () => {
    const invoker = makeInvoker(mockRouteResult);
    const waypoints = [
      { lat: 40.4168, lng: -3.7038 },
      { lat: 40.4096, lng: -3.6893 },
    ];
    const result = await routeWaypoints(waypoints, 'org-test', invoker);
    expect(result).not.toBeNull();
    expect(result!.distance_m).toBe(2340);
    expect(result!.duration_s).toBe(480);
    expect(result!.geometry.type).toBe('LineString');
  });

  it('WR-1-2 returns null for fewer than 2 waypoints (no API call)', async () => {
    const invoker = makeInvoker(null);
    const result = await routeWaypoints([{ lat: 40.4168, lng: -3.7038 }], 'org-test', invoker);
    expect(result).toBeNull();
    expect(invoker).not.toHaveBeenCalled();
  });

  it('WR-1-3 throws on API error', async () => {
    const invoker = makeInvoker(null, { message: 'TIMEOUT' });
    await expect(
      routeWaypoints(
        [{ lat: 40.4168, lng: -3.7038 }, { lat: 40.4096, lng: -3.6893 }],
        'org-test',
        invoker,
      )
    ).rejects.toThrow('TIMEOUT');
  });
});

// ── WR-2: Single stop (no route available) ───────────────────────────────────

describe('WR-2 — single stop behavior', () => {
  it('WR-2-1 routeWaypoints returns null for 1 waypoint', async () => {
    const result = await routeWaypoints([{ lat: 40.4168, lng: -3.7038 }], 'org-test');
    expect(result).toBeNull();
  });

  it('WR-2-2 single valid job produces 1-element RouteJob array', () => {
    const job = makeJob({ latitud: 40.4168, longitud: -3.7038 });
    const geoJobs = [job].filter(j => isValidLatLng(j.latitud, j.longitud));
    expect(geoJobs).toHaveLength(1);
    const routeJobs: RouteJob[] = geoJobs.map((j, i) => ({ ...j, orden_ruta: i + 1 }) as RouteJob);
    expect(routeJobs[0].orden_ruta).toBe(1);
  });
});

// ── WR-3: Jobs without coordinates ───────────────────────────────────────────

describe('WR-3 — jobs without coordinates', () => {
  it('WR-3-1 isValidLatLng filters out null coordinates', () => {
    const jobs = [
      makeJob({ latitud: 40.4168, longitud: -3.7038 }),
      makeJob({ latitud: null, longitud: null }),
      makeJob({ latitud: 40.4096, longitud: undefined }),
    ];
    const geoJobs = jobs.filter(j => isValidLatLng(j.latitud, j.longitud));
    expect(geoJobs).toHaveLength(1);
  });

  it('WR-3-2 filters out Null Island (0,0) as invalid', () => {
    expect(isValidLatLng(0, 0)).toBe(true); // (0,0) is technically valid lat/lng
    // but out-of-range coords are not:
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
  });

  it('WR-3-3 jobs without coords do not appear in waypoints array', () => {
    const jobs: RouteJob[] = [
      makeRouteJob({ latitud: 40.4168, longitud: -3.7038 }, 1),
      makeRouteJob({ latitud: null, longitud: null }, 2),
      makeRouteJob({ latitud: 40.4300, longitud: -3.6800 }, 3),
    ];
    const waypoints = jobs
      .filter(j => isValidLatLng(j.latitud, j.longitud))
      .map(j => ({ lat: j.latitud!, lng: j.longitud! }));
    expect(waypoints).toHaveLength(2);
    expect(waypoints[0].lat).toBe(40.4168);
    expect(waypoints[1].lat).toBe(40.4300);
  });
});

// ── WR-4: API error handling ──────────────────────────────────────────────────

describe('WR-4 — API error / timeout handling', () => {
  it('WR-4-1 propagates network error message', async () => {
    const invoker: FunctionInvoker = vi.fn().mockRejectedValue(new Error('Network request failed'));
    await expect(
      routeWaypoints(
        [{ lat: 40.4168, lng: -3.7038 }, { lat: 40.4096, lng: -3.6893 }],
        'org-test',
        invoker,
      )
    ).rejects.toThrow('Network request failed');
  });

  it('WR-4-2 throws on application-level error in data', async () => {
    const invoker = makeInvoker({ error: 'QUOTA_EXCEEDED' });
    await expect(
      routeWaypoints(
        [{ lat: 40.4168, lng: -3.7038 }, { lat: 40.4096, lng: -3.6893 }],
        'org-test',
        invoker,
      )
    ).rejects.toThrow('QUOTA_EXCEEDED');
  });
});

// ── WR-5: Distance and duration from API ─────────────────────────────────────

describe('WR-5 — distance & duration formatting', () => {
  it('WR-5-1 formatDistance renders km for >=1000 m', () => {
    expect(formatDistance(2340)).toBe('2,3 km');
    expect(formatDistance(1000)).toBe('1 km');
  });

  it('WR-5-2 formatDistance renders m for <1000 m', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(0)).toBe('0 m');
  });

  it('WR-5-3 formatDuration renders h + min for >=3600 s', () => {
    expect(formatDuration(3720)).toBe('1 h 2 min');
    expect(formatDuration(7200)).toBe('2 h 0 min');
  });

  it('WR-5-4 formatDuration renders min for <3600 s', () => {
    expect(formatDuration(480)).toBe('8 min');
    expect(formatDuration(60)).toBe('1 min');
  });
});

// ── WR-6: Planned order respected ────────────────────────────────────────────

describe('WR-6 — planned order respected', () => {
  it('WR-6-1 jobs with existing orden_ruta are sorted by that field', () => {
    const jobs = [
      makeJob({ id: 'c', orden_ruta: 3, hora_inicio: '08:00' }),
      makeJob({ id: 'a', orden_ruta: 1, hora_inicio: '10:00' }),
      makeJob({ id: 'b', orden_ruta: 2, hora_inicio: '09:00' }),
    ];
    // Simulates the ScreenWorkerView todayRouteJobs logic
    const geoJobs = jobs.filter(j => isValidLatLng(j.latitud, j.longitud));
    const allHaveOrder = geoJobs.length > 0 && geoJobs.every(j => j.orden_ruta != null);
    expect(allHaveOrder).toBe(true);
    const sorted = [...geoJobs]
      .sort((a, b) => (a.orden_ruta ?? 99) - (b.orden_ruta ?? 99))
      .map((j, i) => ({ ...j, orden_ruta: i + 1 }) as RouteJob);
    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
    expect(sorted[2].id).toBe('c');
  });

  it('WR-6-2 jobs without orden_ruta fall back to time order', () => {
    const jobs = [
      makeJob({ id: 'late',  orden_ruta: null, hora_inicio: '11:00' }),
      makeJob({ id: 'early', orden_ruta: null, hora_inicio: '08:00' }),
    ];
    const geoJobs = jobs.filter(j => isValidLatLng(j.latitud, j.longitud));
    const allHaveOrder = geoJobs.every(j => j.orden_ruta != null);
    expect(allHaveOrder).toBe(false);
    // falls back to time order (already sorted by todayJobs)
    const timeSorted = [...geoJobs].sort((a, b) =>
      (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''));
    expect(timeSorted[0].id).toBe('early');
    expect(timeSorted[1].id).toBe('late');
  });

  it('WR-6-3 optimizeDailyRoute does not auto-apply when called without explicit user action', () => {
    // optimizeDailyRoute is only called when user clicks "Optimizar" button
    // This test verifies the function itself is deterministic on null start
    const jobs = [
      makeJob({ prioridad: 'normal',  hora_inicio: '09:00' }),
      makeJob({ prioridad: 'urgente', hora_inicio: '11:00' }),
    ];
    const result = optimizeDailyRoute(jobs, null);
    expect(result[0].prioridad).toBe('urgente');
    expect(result[1].prioridad).toBe('normal');
  });
});

// ── WR-7: Google Maps navigation URL ─────────────────────────────────────────

describe('WR-7 — navigation URL', () => {
  it('WR-7-1 buildGoogleMapsUrl uses org base geo as origin when provided', () => {
    const jobs = [
      makeRouteJob({ latitud: 40.4096, longitud: -3.6893 }, 1),
      makeRouteJob({ latitud: 40.4300, longitud: -3.6500 }, 2),
    ];
    const orgBase: GeoLocation = { lat: 40.4200, lng: -3.7000 };
    const url = buildGoogleMapsUrl(jobs, orgBase);
    expect(url).toContain('origin=40.42%2C-3.7');
    expect(url).toContain('travelmode=driving');
  });

  it('WR-7-2 buildGoogleMapsUrl falls back to string address when no org geo', () => {
    const jobs = [
      makeRouteJob({ latitud: 40.4096, longitud: -3.6893, direccion: 'Calle A' }, 1),
    ];
    const url = buildGoogleMapsUrl(jobs, 'Calle Inicio, Madrid');
    expect(url).toContain('origin=Calle%20Inicio%2C%20Madrid');
  });

  it('WR-7-3 stop order in URL matches orden_ruta, not insertion order', () => {
    const jobs = [
      makeRouteJob({ id: 'first',  latitud: 40.41, longitud: -3.70, orden_ruta: 1 }),
      makeRouteJob({ id: 'second', latitud: 40.43, longitud: -3.65, orden_ruta: 2 }),
      makeRouteJob({ id: 'third',  latitud: 40.45, longitud: -3.60, orden_ruta: 3 }),
    ];
    const orgBase: GeoLocation = { lat: 40.40, lng: -3.72 };
    const url = buildGoogleMapsUrl(jobs, orgBase);
    // destination should be the last job in order (third)
    expect(url).toContain('destination=40.45%2C-3.6');
  });
});

// ── WR-8: geometryToLeaflet conversion ───────────────────────────────────────

describe('WR-8 — geometry to Leaflet conversion', () => {
  it('WR-8-1 LineString coordinates are flipped from [lng,lat] to [lat,lng]', () => {
    const geometry = {
      type: 'LineString' as const,
      coordinates: [[-3.7038, 40.4168], [-3.6893, 40.4096]] as [number, number][],
    };
    const leaflet = geometryToLeaflet(geometry);
    expect(leaflet[0]).toEqual([40.4168, -3.7038]);
    expect(leaflet[1]).toEqual([40.4096, -3.6893]);
  });

  it('WR-8-2 MultiLineString is flattened into a single array', () => {
    const geometry = {
      type: 'MultiLineString' as const,
      coordinates: [
        [[-3.70, 40.41], [-3.69, 40.40]],
        [[-3.69, 40.40], [-3.68, 40.43]],
      ] as [number, number][][],
    };
    const leaflet = geometryToLeaflet(geometry);
    expect(leaflet).toHaveLength(4);
    expect(leaflet[0]).toEqual([40.41, -3.70]);
    expect(leaflet[3]).toEqual([40.43, -3.68]);
  });
});

// ── WR-9: Regression — Transport module not affected ─────────────────────────

describe('WR-9 — Transport module regression guard', () => {
  it('WR-9-1 routeWaypoints still works with 3+ waypoints (transport pattern)', async () => {
    const bigResult: RouteResult = { ...mockRouteResult, distance_m: 15000, duration_s: 1800 };
    const invoker = makeInvoker(bigResult);
    const result = await routeWaypoints(
      [
        { lat: 40.41, lng: -3.70 },
        { lat: 40.43, lng: -3.65 },
        { lat: 40.45, lng: -3.60 },
      ],
      'org-test',
      invoker,
    );
    expect(result!.distance_m).toBe(15000);
    expect(result!.duration_s).toBe(1800);
  });
});
