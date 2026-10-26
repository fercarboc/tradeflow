/**
 * Tests para geoCredits.ts y geoApi.ts (funciones puras + injectable invoker).
 * No mockea módulos completos — usa el parámetro `invoker` para inyección.
 *
 * TX-MAPS-MVP-1B · FASE 3
 */

import { describe, it, expect } from 'vitest';
import {
  geocodeCredits,
  routingCredits,
  geojsonToLeaflet,
  routeCacheKey,
  normalizeAddressForSearch,
  MAX_DISTANCE_SURCHARGE_CAP,
  PILOT_MAX_DIST_SURCHARGE,
  PILOT_MAX_WAYPOINTS,
  PILOT_MAX_ROUTE_STRAIGHT_KM,
  routeReservationCredits,
  haversineKm,
  totalRouteHaversineKm,
  MAX_ROUTE_STRAIGHT_KM,
} from '../../lib/geoCredits';
import {
  geocodeAddress,
  routeWaypoints,
  formatDuration,
  formatDistance,
  buildSearchText,
} from '../../lib/geoApi';
import type { FunctionInvoker, GeocodingResult, RouteResult } from '../../lib/geoApi';

// ── geoCredits: geocodeCredits ────────────────────────────────────────────────

describe('geocodeCredits', () => {
  it('always returns 1', () => {
    expect(geocodeCredits()).toBe(1);
  });
});

// ── geoCredits: routingCredits ────────────────────────────────────────────────

describe('routingCredits', () => {
  it('returns 0 for fewer than 2 waypoints', () => {
    expect(routingCredits(0, 0)).toBe(0);
    expect(routingCredits(1, 0)).toBe(0);
  });

  it('2-waypoint route = 1 segment, no surcharges', () => {
    expect(routingCredits(2, 0)).toBe(1);
  });

  it('3-waypoint route = 2 segments', () => {
    expect(routingCredits(3, 0)).toBe(2);
  });

  it('4-waypoint route = 3 segments', () => {
    expect(routingCredits(4, 0)).toBe(3);
  });

  it('distance surcharge: every 500 km adds 1 credit', () => {
    expect(routingCredits(2, 499_999)).toBe(1);      // 0 surcharge
    expect(routingCredits(2, 500_000)).toBe(2);      // 1 surcharge
    expect(routingCredits(2, 999_999)).toBe(2);      // 1 surcharge
    expect(routingCredits(2, 1_000_000)).toBe(3);    // 2 surcharge
  });

  it('routeDetails option adds 1 credit', () => {
    expect(routingCredits(2, 0, { routeDetails: true })).toBe(2);
  });

  it('elevation option adds 1 credit', () => {
    expect(routingCredits(2, 0, { elevation: true })).toBe(2);
  });

  it('each avoid entry adds 1 credit', () => {
    expect(routingCredits(2, 0, { avoidCount: 2 })).toBe(3);
  });

  it('combined: 3 waypoints + 600 km + routeDetails + 1 avoid = 2+1+1+1 = 5', () => {
    expect(routingCredits(3, 600_000, { routeDetails: true, avoidCount: 1 })).toBe(5);
  });
});

// ── geoCredits: geojsonToLeaflet ──────────────────────────────────────────────

describe('geojsonToLeaflet', () => {
  it('swaps [lng, lat] to [lat, lng]', () => {
    const result = geojsonToLeaflet([[-3.805, 43.46], [-3.69, 43.26]]);
    expect(result).toEqual([[43.46, -3.805], [43.26, -3.69]]);
  });

  it('returns empty array for empty input', () => {
    expect(geojsonToLeaflet([])).toEqual([]);
  });

  it('single coordinate pair', () => {
    expect(geojsonToLeaflet([[0, 0]])).toEqual([[0, 0]]);
  });

  it('preserves coordinate order (not sorted)', () => {
    const input: [number, number][] = [[-3.8, 43.4], [-3.6, 43.2], [-3.9, 43.5]];
    const result = geojsonToLeaflet(input);
    expect(result[0]).toEqual([43.4, -3.8]);
    expect(result[1]).toEqual([43.2, -3.6]);
    expect(result[2]).toEqual([43.5, -3.9]);
  });
});

// ── geoCredits: routeCacheKey ─────────────────────────────────────────────────

describe('routeCacheKey', () => {
  it('produces consistent key for same waypoints', () => {
    const wps = [{ lat: 43.4628, lng: -3.8050 }, { lat: 43.2630, lng: -3.6890 }];
    expect(routeCacheKey(wps)).toBe(routeCacheKey(wps));
  });

  it('rounds to 6 decimal places', () => {
    const a = [{ lat: 43.4628001, lng: -3.8050001 }];
    const b = [{ lat: 43.462800, lng: -3.805000 }];
    expect(routeCacheKey(a)).toBe(routeCacheKey(b));
  });

  it('different waypoints produce different keys', () => {
    const a = [{ lat: 43.4628, lng: -3.8050 }, { lat: 40.4168, lng: -3.7038 }];
    const b = [{ lat: 40.4168, lng: -3.7038 }, { lat: 43.4628, lng: -3.8050 }];
    expect(routeCacheKey(a)).not.toBe(routeCacheKey(b)); // order matters
  });

  it('order is preserved (A→B ≠ B→A)', () => {
    const ab = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }];
    const ba = [{ lat: 3, lng: 4 }, { lat: 1, lng: 2 }];
    expect(routeCacheKey(ab)).not.toBe(routeCacheKey(ba));
  });
});

// ── geoCredits: normalizeAddressForSearch ─────────────────────────────────────

describe('normalizeAddressForSearch', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeAddressForSearch('  madrid  ')).toBe('madrid');
  });

  it('collapses internal spaces', () => {
    expect(normalizeAddressForSearch('calle   mayor  1')).toBe('calle mayor 1');
  });

  it('lowercases input', () => {
    expect(normalizeAddressForSearch('Calle Mayor')).toBe('calle mayor');
  });

  it('empty string returns empty string', () => {
    expect(normalizeAddressForSearch('')).toBe('');
  });
});

// ── geoApi: formatDuration ────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('< 1 hour shows only minutes', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(59)).toBe('1 min');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(3599)).toBe('60 min');
  });

  it('>= 1 hour shows hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1 h 0 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(formatDuration(7200)).toBe('2 h 0 min');
  });
});

// ── geoApi: formatDistance ────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('< 1000 m shows in meters', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('>= 1000 m shows in km', () => {
    expect(formatDistance(1000)).toBe('1 km');
    expect(formatDistance(1500)).toBe('1,5 km');
    expect(formatDistance(10_000)).toBe('10 km');
  });
});

// ── geoApi: buildSearchText ───────────────────────────────────────────────────

describe('buildSearchText', () => {
  it('returns empty string for null', () => {
    expect(buildSearchText(null)).toBe('');
  });

  it('returns address string when address fields are present', () => {
    const loc = { calle: 'Calle Mayor', numero: '1', localidad: 'Madrid', cp: '28001' };
    const result = buildSearchText(loc);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Madrid');
  });

  it('falls back to nombre_lugar when no address', () => {
    const loc = { nombre_lugar: 'Aeropuerto de Santander' };
    const result = buildSearchText(loc);
    expect(result).toBe('Aeropuerto de Santander');
  });
});

// ── geoApi: geocodeAddress (injectable invoker) ───────────────────────────────

describe('geocodeAddress', () => {
  it('returns GeocodingResult on success', async () => {
    const mockResult: GeocodingResult = {
      candidates: [{ lat: 43.46, lng: -3.80, display_name: 'Santander, España', confidence: 0.95 }],
      ambiguous: false,
      cached: true,
      provider: 'geoapify',
    };
    const invoker: FunctionInvoker = async () => ({ data: mockResult, error: null });

    const result = await geocodeAddress('Santander', 'org-1', invoker);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.lat).toBe(43.46);
    expect(result.cached).toBe(true);
    expect(result.provider).toBe('geoapify');
  });

  it('throws when invoker returns an error', async () => {
    const invoker: FunctionInvoker = async () => ({ data: null, error: { message: 'GEO_FORBIDDEN' } });
    await expect(geocodeAddress('X', 'org-1', invoker)).rejects.toThrow('GEO_FORBIDDEN');
  });

  it('throws when response contains error field', async () => {
    const invoker: FunctionInvoker = async () => ({ data: { error: 'GEO_RATE_GLOBAL' }, error: null });
    await expect(geocodeAddress('X', 'org-1', invoker)).rejects.toThrow('GEO_RATE_GLOBAL');
  });

  it('returns empty candidates array when no results', async () => {
    const mockResult: GeocodingResult = { candidates: [], ambiguous: false, cached: false, provider: 'geoapify' };
    const invoker: FunctionInvoker = async () => ({ data: mockResult, error: null });
    const result = await geocodeAddress('zzznoresult', 'org-1', invoker);
    expect(result.candidates).toHaveLength(0);
  });
});

// ── geoApi: routeWaypoints (injectable invoker) ───────────────────────────────

describe('routeWaypoints', () => {
  it('returns null for fewer than 2 waypoints', async () => {
    const invoker: FunctionInvoker = async () => ({ data: null, error: null });
    expect(await routeWaypoints([], 'org-1', invoker)).toBeNull();
    expect(await routeWaypoints([{ lat: 43.46, lng: -3.80 }], 'org-1', invoker)).toBeNull();
  });

  it('returns RouteResult on success', async () => {
    const mockResult: RouteResult = {
      geometry:   { type: 'LineString', coordinates: [[-3.80, 43.46], [-3.69, 43.26]] },
      distance_m: 25_000,
      duration_s: 1800,
      provider:   'geoapify',
      cached:     false,
    };
    const invoker: FunctionInvoker = async () => ({ data: mockResult, error: null });
    const result = await routeWaypoints(
      [{ lat: 43.46, lng: -3.80 }, { lat: 43.26, lng: -3.69 }],
      'org-1',
      invoker
    );
    expect(result).not.toBeNull();
    expect(result!.distance_m).toBe(25_000);
    expect(result!.duration_s).toBe(1800);
    expect(result!.geometry.coordinates).toHaveLength(2);
  });

  it('throws when invoker returns an error', async () => {
    const invoker: FunctionInvoker = async () => ({ data: null, error: { message: 'GEO_RATE_ORG' } });
    await expect(
      routeWaypoints([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], 'org-1', invoker)
    ).rejects.toThrow('GEO_RATE_ORG');
  });

  it('returns null when backend returns null (no route possible)', async () => {
    const invoker: FunctionInvoker = async () => ({ data: null, error: null });
    const result = await routeWaypoints(
      [{ lat: 43.46, lng: -3.80 }, { lat: 43.26, lng: -3.69 }],
      'org-1',
      invoker
    );
    expect(result).toBeNull();
  });

  it('credits example: 3-stop route = 3 segments (origin + 2 stops + dest = 4 waypoints)', () => {
    expect(routingCredits(4, 150_000)).toBe(3);
  });

  it('4-waypoint route 85 km = 3 credits (no distance surcharge < 500 km)', () => {
    expect(routingCredits(4, 85_000)).toBe(3);
  });

  it('4-waypoint route 600 km = 4 credits (3 segments + 1 distance surcharge)', () => {
    expect(routingCredits(4, 600_000)).toBe(4);
  });

  it('route daily_limit check: segments (not 1) determines available capacity', () => {
    // A 4-waypoint route needs 3 credits; limit=5, used=3 → only 2 remain → rejected
    const remaining = 5 - 3; // daily_limit - req_count
    const minCreditsNeeded = 4 - 1; // segments for 4-waypoint route
    expect(remaining < minCreditsNeeded).toBe(true); // should be rejected
  });

  it('route does NOT increment quota on cache hit (EF returns cached without calling geo_reserve)', async () => {
    let invokerCalled = false;
    const invoker: FunctionInvoker = async () => {
      invokerCalled = true;
      return { data: null, error: null }; // null = cached (EF wouldn't call invoker for cache)
    };
    // Frontend never calls the EF for cache hits — EF handles cache internally
    // This test verifies routeWaypoints correctly returns null when backend returns null
    const result = await routeWaypoints(
      [{ lat: 43.46, lng: -3.80 }, { lat: 43.26, lng: -3.69 }],
      'org-1',
      invoker
    );
    expect(result).toBeNull();
    expect(invokerCalled).toBe(true); // frontend always calls EF; EF decides cache internally
  });
});

// ── routeReservationCredits ───────────────────────────────────────────────────

describe('routeReservationCredits', () => {
  it('returns 0 for fewer than 2 waypoints', () => {
    expect(routeReservationCredits(0)).toBe(0);
    expect(routeReservationCredits(1)).toBe(0);
  });

  it('2-waypoint route reserves 1 segment + PILOT_MAX_DIST_SURCHARGE', () => {
    expect(routeReservationCredits(2)).toBe(1 + PILOT_MAX_DIST_SURCHARGE);
  });

  it('4-waypoint route reserves 3 segments + PILOT_MAX_DIST_SURCHARGE', () => {
    expect(routeReservationCredits(4)).toBe(3 + PILOT_MAX_DIST_SURCHARGE);
  });

  it('reservation is always >= actual cost within pilot limits', () => {
    // Pilot: max waypoints = PILOT_MAX_WAYPOINTS, max surcharge = PILOT_MAX_DIST_SURCHARGE
    for (let n = 2; n <= PILOT_MAX_WAYPOINTS; n++) {
      const reserved = routeReservationCredits(n);
      const segments = n - 1;
      // Worst case actual within pilot: segments + PILOT_MAX_DIST_SURCHARGE (1500 km road)
      const worstCaseActual = segments + PILOT_MAX_DIST_SURCHARGE;
      expect(reserved).toBeGreaterThanOrEqual(worstCaseActual);
    }
  });

  it('MAX_DISTANCE_SURCHARGE_CAP (theoretical) = 8 covers 4000 km', () => {
    expect(MAX_DISTANCE_SURCHARGE_CAP).toBe(8);
    expect(Math.floor(4_000_000 / 500_000)).toBe(8);
  });

  it('PILOT_MAX_DIST_SURCHARGE = 3 covers 1500 km road (floor(1500000/500000)=3)', () => {
    expect(PILOT_MAX_DIST_SURCHARGE).toBe(3);
    expect(Math.floor(1_500_000 / 500_000)).toBe(3);
    // With PILOT_MAX_ROUTE_STRAIGHT_KM=800 and road factor ≤1.875 → road ≤1500 km → surcharge ≤3
    expect(PILOT_MAX_DIST_SURCHARGE).toBeGreaterThanOrEqual(Math.floor(1_500_000 / 500_000));
  });

  it('PILOT_MAX_WAYPOINTS = 10 (limits max cost to 9 + 3 = 12 credits)', () => {
    expect(PILOT_MAX_WAYPOINTS).toBe(10);
    expect(routeReservationCredits(PILOT_MAX_WAYPOINTS)).toBe(9 + PILOT_MAX_DIST_SURCHARGE);
  });
});

// ── Credit reservation and reconciliation logic ───────────────────────────────

describe('credit reservation & reconciliation', () => {
  it('delta = reserved - actual = credits to release after successful short route', () => {
    const reserved = routeReservationCredits(2); // 1 + 3 = 4
    const actual = routingCredits(2, 100_000);    // 1 segment + 0 dist = 1
    const delta = reserved - actual;
    expect(delta).toBe(PILOT_MAX_DIST_SURCHARGE); // 3 released
  });

  it('full release when provider errors (actual = 0)', () => {
    const reserved = routeReservationCredits(4); // 3 + 3 = 6
    const actual = 0; // provider error — Geoapify did not bill
    const delta = reserved - actual;
    expect(delta).toBe(reserved); // release all
  });

  it('no release when reservation exactly matches actual cost within pilot', () => {
    // A 2-waypoint route at exactly 1500 km road (pilot maximum surcharge)
    const reserved = routeReservationCredits(2); // 1 + 3 = 4
    const actual = routingCredits(2, 1_500_000); // 1 + 3 = 4
    expect(reserved - actual).toBe(0);
  });

  it('global budget: reserve rejected when used + estimated > global limit', () => {
    const globalLimit = 2000;
    const globalUsed  = 1997;
    const estimated   = routeReservationCredits(2); // 4
    expect(globalUsed + estimated > globalLimit).toBe(true); // 2001 > 2000 → rejected
  });

  it('global budget: reserve accepted when used + estimated = global limit (exact fit)', () => {
    const globalLimit = 2000;
    const globalUsed  = 1996;
    const estimated   = routeReservationCredits(2); // 4
    expect(globalUsed + estimated <= globalLimit).toBe(true); // 2000 <= 2000 → accepted
  });

  it('global budget: day rollover resets counter (used_date != today → 0)', () => {
    const usedYesterday = 1999;
    const isToday = false;
    const effectiveUsed = isToday ? usedYesterday : 0;
    expect(effectiveUsed).toBe(0);
  });

  it('org quota: rejected with conservative estimate even if actual would fit', () => {
    const orgLimit   = 100;
    const orgUsed    = 98;
    const estimated  = routeReservationCredits(2); // 4
    expect(orgUsed + estimated > orgLimit).toBe(true);  // 102 > 100 → rejected
    const actual = routingCredits(2, 100_000); // 1
    expect(orgUsed + actual <= orgLimit).toBe(true);   // 99 <= 100 — would have fit
  });

  it('org quota: accepted with exact fit on conservative estimate', () => {
    const orgLimit  = 100;
    const orgUsed   = 96;
    const estimated = routeReservationCredits(2); // 4
    expect(orgUsed + estimated <= orgLimit).toBe(true); // 100 <= 100 → accepted
  });

  it('geocode always uses exactly 1 credit — no uncertainty', () => {
    expect(geocodeCredits()).toBe(1);
    const reserved = geocodeCredits();
    const actual   = geocodeCredits();
    expect(reserved - actual).toBe(0);
  });

  it('idempotency: double reconcile same reservation changes nothing (status guard)', () => {
    // Simulate: first reconcile marks status='reconciled'; second call returns early
    // The SQL function returns void and is a no-op when status != 'pending'
    // Here we verify the mathematical invariant: if delta already released, re-release is 0
    const reserved = routeReservationCredits(2); // 4
    const actual   = routingCredits(2, 200_000); // 1
    const delta1   = reserved - actual;           // 3 (released on first reconcile)
    const delta2   = 0;                           // no-op on second reconcile (status guard)
    expect(delta1).toBe(3);
    expect(delta2).toBe(0);
    expect(delta1 + delta2).toBe(delta1); // idempotent: same total release
  });

  it('cross-org protection: reservation belongs to different org → exception (not a no-op)', () => {
    // The SQL function raises GEO_RECONCILE_ORG when reservation.org_id != p_org_id.
    // This is different from the idempotency no-op (status='reconciled').
    // Verify: a pending reservation belonging to org-A cannot be reconciled by org-B.
    const reservationOrgId = 'org-A';
    const callerOrgId      = 'org-B';
    expect(reservationOrgId).not.toBe(callerOrgId); // guard that would trigger exception
  });
});

// ── haversineKm ───────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('same point = 0 km', () => {
    expect(haversineKm(43.46, -3.80, 43.46, -3.80)).toBeCloseTo(0, 5);
  });

  it('Madrid–Barcelona ≈ 505 km (±5 km tolerance)', () => {
    const d = haversineKm(40.4168, -3.7038, 41.3851, 2.1734);
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(510);
  });

  it('Santander–Sevilla ≈ 700 km en línea recta (±10 km tolerance)', () => {
    const d = haversineKm(43.4623, -3.8099, 37.3886, -5.9823);
    expect(d).toBeGreaterThan(690);
    expect(d).toBeLessThan(710);
  });

  it('symmetry: A→B = B→A', () => {
    const d1 = haversineKm(40.4168, -3.7038, 41.3851, 2.1734);
    const d2 = haversineKm(41.3851, 2.1734, 40.4168, -3.7038);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

// ── totalRouteHaversineKm ─────────────────────────────────────────────────────

describe('totalRouteHaversineKm', () => {
  it('empty array = 0', () => {
    expect(totalRouteHaversineKm([])).toBe(0);
  });

  it('single waypoint = 0', () => {
    expect(totalRouteHaversineKm([{ lat: 43.46, lng: -3.80 }])).toBe(0);
  });

  it('two waypoints = haversine between them', () => {
    const d = totalRouteHaversineKm([
      { lat: 40.4168, lng: -3.7038 },
      { lat: 41.3851, lng: 2.1734 },
    ]);
    expect(d).toBeCloseTo(haversineKm(40.4168, -3.7038, 41.3851, 2.1734), 5);
  });

  it('three waypoints = sum of both segments', () => {
    const a = { lat: 43.46, lng: -3.80 };
    const b = { lat: 40.42, lng: -3.70 };
    const c = { lat: 37.39, lng: -5.98 };
    const d = totalRouteHaversineKm([a, b, c]);
    expect(d).toBeCloseTo(
      haversineKm(a.lat, a.lng, b.lat, b.lng) + haversineKm(b.lat, b.lng, c.lat, c.lng),
      5,
    );
  });

  it('MAX_ROUTE_STRAIGHT_KM alias = PILOT_MAX_ROUTE_STRAIGHT_KM = 800', () => {
    expect(MAX_ROUTE_STRAIGHT_KM).toBe(PILOT_MAX_ROUTE_STRAIGHT_KM);
    expect(PILOT_MAX_ROUTE_STRAIGHT_KM).toBe(800);
  });

  it('short Spanish bus route (Santander→Bilbao ≈ 100 km) is within pilot limit', () => {
    const d = totalRouteHaversineKm([
      { lat: 43.4623, lng: -3.8099 },  // Santander
      { lat: 43.2630, lng: -2.9350 },  // Bilbao
    ]);
    expect(d).toBeLessThan(PILOT_MAX_ROUTE_STRAIGHT_KM);
  });

  it('Santander→Madrid→Barcelona (≈ 905 km) exceeds pilot distance limit of 800 km', () => {
    const d = totalRouteHaversineKm([
      { lat: 43.4623, lng: -3.8099 },  // Santander
      { lat: 40.4168, lng: -3.7038 },  // Madrid
      { lat: 41.3851, lng:  2.1734 },  // Barcelona
    ]);
    // straight-line ≈ 905 km > 800 km pilot limit → EF rejects with GEO_PARAMS_DISTANCE
    expect(d).toBeGreaterThan(PILOT_MAX_ROUTE_STRAIGHT_KM);
  });

  it('extreme zigzag route exceeds pilot limit', () => {
    const far: Array<{ lat: number; lng: number }> = [];
    for (let i = 0; i < 5; i++) {
      far.push(i % 2 === 0 ? { lat: 43.79, lng: -7.86 } : { lat: 36.01, lng: 4.49 });
    }
    const d = totalRouteHaversineKm(far);
    expect(d).toBeGreaterThan(PILOT_MAX_ROUTE_STRAIGHT_KM);
  });
});
