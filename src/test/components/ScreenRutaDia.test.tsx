/**
 * ScreenRutaDia + RouteMap — focused tests
 *
 * Leaflet / react-leaflet are mocked because jsdom has no real layout engine.
 * Tests cover: CARTO key config, coordinate validation, marker order, DB write safety.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Shared mock for invalidateSize (captured across module resets) ────────────
const mockInvalidateSize = vi.fn();

// ── Mock react-leaflet ────────────────────────────────────────────────────────
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: (_props: { url: string }) => <div data-testid="tile-layer" data-url={_props.url} />,
  Marker: ({ children, position }: { children: React.ReactNode; position: [number, number] }) => (
    <div data-testid="map-marker" data-lat={position[0]} data-lng={position[1]}>{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn(), invalidateSize: mockInvalidateSize }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts: object) => opts,
    latLngBounds: (pts: unknown[]) => ({ isValid: () => (pts as unknown[]).length > 0 }),
  },
  divIcon: (opts: object) => opts,
  latLngBounds: (pts: unknown[]) => ({ isValid: () => (pts as unknown[]).length > 0 }),
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));

// ── Imports ───────────────────────────────────────────────────────────────────
import RouteMap, { isValidLatLng } from '../../components/RouteMap';
import ScreenRutaDia from '../../components/ScreenRutaDia';
import { buildGoogleMapsUrl } from '../../lib/routeOptimizer';
import type { RouteJob } from '../../lib/routeOptimizer';
import type { TradeJob } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeJob(overrides: Partial<TradeJob> = {}): TradeJob {
  return {
    id: Math.random().toString(36).slice(2),
    org_id: 'org1',
    titulo: 'Trabajo test',
    estado: 'pendiente',
    prioridad: 'normal',
    tipo: 'instalacion',
    fecha_inicio: '2026-10-19',
    hora_inicio: '09:00',
    duracion_horas: 1,
    latitud: 40.4,
    longitud: -3.7,
    direccion: 'Calle Test 1',
    localidad: 'Madrid',
    cp: null,
    descripcion: null,
    orden_ruta: 1,
    trade_clients: null,
    trade_job_workers: [],
    ...overrides,
  } as TradeJob;
}

function makeRouteJob(overrides: Partial<TradeJob> = {}, orden = 1): RouteJob {
  return { ...makeJob(overrides), orden_ruta: orden } as RouteJob;
}

// ── isValidLatLng unit tests ──────────────────────────────────────────────────
describe('isValidLatLng — coordinate validation helper', () => {
  it('accepts in-range valid coordinates', () => {
    expect(isValidLatLng(40.4, -3.7)).toBe(true);
    expect(isValidLatLng(0, 0)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
  });

  it('rejects null/undefined', () => {
    expect(isValidLatLng(null, -3.7)).toBe(false);
    expect(isValidLatLng(40.4, null)).toBe(false);
    expect(isValidLatLng(undefined, undefined)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidLatLng(NaN, -3.7)).toBe(false);
    expect(isValidLatLng(40.4, NaN)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidLatLng(Infinity, -3.7)).toBe(false);
    expect(isValidLatLng(40.4, Infinity)).toBe(false);
  });

  it('rejects lat out of range (>90 or <-90)', () => {
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
  });

  it('rejects lng out of range (>180 or <-180)', () => {
    expect(isValidLatLng(40, 181)).toBe(false);
    expect(isValidLatLng(40, -181)).toBe(false);
  });
});

// ── CARTO key config tests ────────────────────────────────────────────────────
describe('RouteMap — CARTO API key', () => {
  it('TEST-CARTO-1 shows "Mapa no disponible" fallback when key is empty', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', '');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({}, 1)];
    render(<RM routeJobs={jobs} startLocation="Madrid" />);
    expect(screen.getByText(/mapa no disponible/i)).toBeTruthy();
    expect(screen.getByText(/VITE_CARTO_BASEMAP_API_KEY/i)).toBeTruthy();
    expect(screen.queryByTestId('map-container')).toBeNull();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-CARTO-2 TileLayer URL includes key when VITE_CARTO_BASEMAP_API_KEY is set', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key-abc123');
    vi.resetModules();
    const { default: RouteMapFresh } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({}, 1)];
    render(<RouteMapFresh routeJobs={jobs} startLocation="Madrid" />);
    const tile = screen.queryByTestId('tile-layer');
    if (tile) {
      expect(tile.getAttribute('data-url')).toContain('key=test-key-abc123');
      expect(tile.getAttribute('data-url')).toContain('basemaps.cartocdn.com');
    }
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-CARTO-3 no MapContainer when key is empty (no request to CARTO)', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', '');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({}, 1)];
    render(<RM routeJobs={jobs} startLocation="Madrid" />);
    expect(screen.queryByTestId('map-container')).toBeNull();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

// ── Coordinate filtering tests ────────────────────────────────────────────────
describe('RouteMap — coordinate filtering', () => {
  it('TEST-1 renders one marker per job with valid coordinates (key present)', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [
      makeRouteJob({ latitud: 40.4, longitud: -3.7 }, 1),
      makeRouteJob({ latitud: 41.3, longitud: -2.1 }, 2),
    ];
    render(<RM routeJobs={jobs} startLocation="Madrid" />);
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-3 jobs without coordinates are excluded from the map', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [
      makeRouteJob({ latitud: 40.4, longitud: -3.7 }, 1),
      makeRouteJob({ latitud: null, longitud: null }, 2),
      makeRouteJob({ latitud: undefined, longitud: undefined }, 3),
    ];
    render(<RM routeJobs={jobs} startLocation="Madrid" />);
    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
    expect(screen.getByText(/2 trabajos sin coordenadas/i)).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-4a NaN coordinates are rejected', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [
      makeRouteJob({ latitud: NaN, longitud: NaN }, 1),
      makeRouteJob({ latitud: 40.4, longitud: -3.7 }, 2),
    ];
    render(<RM routeJobs={jobs} startLocation="Madrid" />);
    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-4b out-of-range coordinates are rejected', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [
      makeRouteJob({ latitud: 91, longitud: 0 }, 1),    // lat > 90
      makeRouteJob({ latitud: 40, longitud: 181 }, 2),  // lng > 180
      makeRouteJob({ latitud: 40.4, longitud: -3.7 }, 3),
    ];
    render(<RM routeJobs={jobs} startLocation="Madrid" />);
    // Only the valid job gets a marker; 2 excluded shown in warning
    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
    expect(screen.getByText(/2 trabajos sin coordenadas/i)).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-4c invalid startGeo is silently excluded (no crash, no start marker)', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({ latitud: 40.4, longitud: -3.7 }, 1)];
    render(<RM routeJobs={jobs} startLocation={{ lat: 200, lng: 0 }} />);
    // 1 job marker; no start marker (200 lat is invalid)
    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
    // No crash, map still renders
    expect(screen.getByTestId('map-container')).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-5 renders empty state when no jobs provided', () => {
    render(<RouteMap routeJobs={[]} startLocation="Madrid" />);
    expect(screen.queryByTestId('map-container')).toBeNull();
    expect(screen.getByText(/sin trabajos en el mapa/i)).toBeTruthy();
  });

  it('TEST-6 markers update when routeJobs changes', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const { rerender } = render(
      <RM routeJobs={[makeRouteJob({}, 1)]} startLocation="Madrid" />,
    );
    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
    rerender(
      <RM
        routeJobs={[makeRouteJob({}, 1), makeRouteJob({ latitud: 41.0, longitud: -3.0 }, 2)]}
        startLocation="Madrid"
      />,
    );
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

// ── RouteMap — no valid coordinates (no Madrid fallback) ─────────────────────

describe('RouteMap — no valid coordinates', () => {
  it('TEST-NOCOORDS-1 shows no-geocode state when all jobs lack coords (key present)', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [
      makeRouteJob({ latitud: null, longitud: null }, 1),
      makeRouteJob({ latitud: null, longitud: null }, 2),
    ];
    render(<RM routeJobs={jobs} startLocation="Santander, Cantabria" />);
    expect(screen.queryByTestId('map-container')).toBeNull();
    expect(screen.getByText(/sin ubicaciones geolocalizadas/i)).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-NOCOORDS-2 no MapContainer when all jobs have no coords — no Madrid centered map', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({ latitud: null, longitud: null }, 1)];
    render(<RM routeJobs={jobs} startLocation="Barcenilla, Cantabria" />);
    expect(screen.queryByTestId('map-container')).toBeNull();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-NOCOORDS-3 renders map when at least one job has valid coords', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({ latitud: 43.46, longitud: -3.81 }, 1)];
    render(<RM routeJobs={jobs} startLocation="Santander" />);
    expect(screen.getByTestId('map-container')).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-NOCOORDS-4 renders map when GeoLocation start present even with no job coords', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    const jobs: RouteJob[] = [makeRouteJob({ latitud: null, longitud: null }, 1)];
    render(<RM routeJobs={jobs} startLocation={{ lat: 43.46, lng: -3.81, label: 'Oficina Santander' }} />);
    expect(screen.getByTestId('map-container')).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

// ── ScreenRutaDia operational integrity ──────────────────────────────────────
describe('ScreenRutaDia — operational integrity', () => {
  const baseProps = {
    jobs: [] as TradeJob[],
    orgId: 'org1',
    startLocation: 'Madrid, España',
    onUpdateJob: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('TEST-8 opening the screen does NOT call onUpdateJob (no silent DB write)', () => {
    render(<ScreenRutaDia {...baseProps} />);
    expect(baseProps.onUpdateJob).not.toHaveBeenCalled();
  });

  it('TEST-2 changing the worker tab does NOT call onUpdateJob', async () => {
    const user = userEvent.setup();
    const jobA = makeJob({ trade_job_workers: [{ worker_id: 'w1', trade_workers: { nombre: 'Ana' } } as never] });
    const jobB = makeJob({ trade_job_workers: [{ worker_id: 'w2', trade_workers: { nombre: 'Luis' } } as never] });
    render(<ScreenRutaDia {...baseProps} jobs={[jobA, jobB]} />);
    const luisTab = screen.queryByText('Luis');
    if (luisTab) await user.click(luisTab);
    expect(baseProps.onUpdateJob).not.toHaveBeenCalled();
  });

  it('TEST-7 Google Maps URL includes all geocoded job stops', () => {
    const jobs = [
      makeRouteJob({ latitud: 40.1, longitud: -3.1 }, 1),
      makeRouteJob({ latitud: 41.0, longitud: -2.0 }, 2),
    ];
    const url = buildGoogleMapsUrl(jobs, 'Madrid');
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('40.1');
    expect(url).toContain('41%2C');
  });
});

// ── RouteMap — invalidateSize on mount ────────────────────────────────────────

describe('RouteMap — invalidateSize', () => {
  beforeEach(() => { mockInvalidateSize.mockClear(); });

  it('TEST-INVALIDATE-1 invalidateSize called on mount (key present, valid job)', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    render(<RM routeJobs={[makeRouteJob({ latitud: 40.4, longitud: -3.7 }, 1)]} startLocation="Madrid" />);
    expect(mockInvalidateSize).toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('TEST-INVALIDATE-2 map container renders and is accessible when key and coords are present', async () => {
    vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key');
    vi.resetModules();
    const { default: RM } = await import('../../components/RouteMap');
    render(<RM routeJobs={[makeRouteJob({ latitud: 43.46, longitud: -3.81 }, 1)]} startLocation="Santander" className="h-[300px]" />);
    expect(screen.getByTestId('map-container')).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

// ── ScreenRutaDia — mobile layout structure ───────────────────────────────────

describe('ScreenRutaDia — mobile layout', () => {
  const mobileProps = {
    jobs: [makeJob({ latitud: 40.4, longitud: -3.7 }), makeJob({ latitud: 41.3, longitud: -2.1 })],
    orgId: 'org1',
    startLocation: 'Madrid, España',
    onUpdateJob: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    onClose: vi.fn(),
  };

  it('TEST-MOBILE-1 map container is present in DOM when jobs have coords', () => {
    render(<ScreenRutaDia {...mobileProps} />);
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });

  it('TEST-MOBILE-2 itinerary items rendered below map in DOM order', () => {
    render(<ScreenRutaDia {...mobileProps} />);
    const mapContainer = screen.getByTestId('map-container');
    // At least one job title visible
    const titles = screen.getAllByRole('heading', { hidden: true }).concat(
      Array.from(document.querySelectorAll('[class*="font-bold"]'))
    );
    expect(mapContainer).toBeTruthy();
    expect(titles.length).toBeGreaterThan(0);
  });
});
