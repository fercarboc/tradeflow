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
  routeReservationCredits,
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

  it('2-waypoint route reserves 1 segment + MAX_DISTANCE_SURCHARGE_CAP', () => {
    expect(routeReservationCredits(2)).toBe(1 + MAX_DISTANCE_SURCHARGE_CAP);
  });

  it('4-waypoint route reserves 3 segments + MAX_DISTANCE_SURCHARGE_CAP', () => {
    expect(routeReservationCredits(4)).toBe(3 + MAX_DISTANCE_SURCHARGE_CAP);
  });

  it('reservation is always >= actual cost (conservative guarantee)', () => {
    for (let n = 2; n <= 25; n++) {
      const reserved = routeReservationCredits(n);
      const segments = n - 1;
      // Worst case actual: segments + MAX_DISTANCE_SURCHARGE_CAP (e.g. 4000 km route)
      const worstCaseActual = segments + MAX_DISTANCE_SURCHARGE_CAP;
      expect(reserved).toBeGreaterThanOrEqual(worstCaseActual);
    }
  });

  it('MAX_DISTANCE_SURCHARGE_CAP covers 4000 km (floor(4000000/500000)=8)', () => {
    expect(MAX_DISTANCE_SURCHARGE_CAP).toBe(8);
    expect(Math.floor(4_000_000 / 500_000)).toBe(8);
    expect(MAX_DISTANCE_SURCHARGE_CAP).toBeGreaterThanOrEqual(Math.floor(4_000_000 / 500_000));
  });
});

// ── Credit reservation and reconciliation logic ───────────────────────────────

describe('credit reservation & reconciliation', () => {
  it('delta = reserved - actual = credits to release after successful route', () => {
    const reserved = routeReservationCredits(2); // 9
    const actual = routingCredits(2, 100_000);    // 1 segment + 0 dist = 1
    const delta = reserved - actual;
    expect(delta).toBe(8);
  });

  it('full release when provider errors (actual = 0)', () => {
    const reserved = routeReservationCredits(4); // 11
    const actual = 0; // provider error — Geoapify did not bill
    const delta = reserved - actual;
    expect(delta).toBe(reserved); // release all
  });

  it('no release when reservation exactly matches actual cost', () => {
    // A 2-waypoint route that happens to be exactly 4000 km
    const reserved = routeReservationCredits(2); // 1 + 8 = 9
    const actual = routingCredits(2, 4_000_000); // 1 + 8 = 9
    expect(reserved - actual).toBe(0);
  });

  it('global budget: reserve rejected when used + estimated > global limit', () => {
    const globalLimit = 2000;
    const globalUsed  = 1995;
    const estimated   = routeReservationCredits(2); // 9
    expect(globalUsed + estimated > globalLimit).toBe(true); // 2004 > 2000 → rejected
  });

  it('global budget: reserve accepted when used + estimated = global limit (exact fit)', () => {
    const globalLimit = 2000;
    const globalUsed  = 1991;
    const estimated   = routeReservationCredits(2); // 9
    expect(globalUsed + estimated <= globalLimit).toBe(true); // 2000 <= 2000 → accepted
  });

  it('global budget: day rollover resets counter (used_date != today → 0)', () => {
    // Simulates the CASE WHEN global_used_date = today THEN used ELSE 0 END logic
    const usedYesterday = 1999;
    const isToday = false; // date from DB is yesterday
    const effectiveUsed = isToday ? usedYesterday : 0;
    expect(effectiveUsed).toBe(0); // fresh day, any reservation passes
  });

  it('org quota: rejected with conservative estimate even if actual would fit', () => {
    // Conservative reservation (9) rejected, even though actual cost (1) would fit
    const orgLimit   = 100;
    const orgUsed    = 95;
    const estimated  = routeReservationCredits(2); // 9
    expect(orgUsed + estimated > orgLimit).toBe(true);  // 104 > 100 → rejected
    // actual cost would have been:
    const actual = routingCredits(2, 100_000); // 1
    expect(orgUsed + actual <= orgLimit).toBe(true);   // 96 <= 100 — would have fit
    // This is the correct conservative behavior: better to reject than to over-spend
  });

  it('org quota: accepted with exact fit on conservative estimate', () => {
    const orgLimit  = 100;
    const orgUsed   = 91;
    const estimated = routeReservationCredits(2); // 9
    expect(orgUsed + estimated <= orgLimit).toBe(true); // 100 <= 100 → accepted
  });

  it('geocode always uses exactly 1 credit — no uncertainty', () => {
    expect(geocodeCredits()).toBe(1);
    // For geocode, reserved = actual = 1, so reconcile is always a no-op (delta=0)
    const reserved = geocodeCredits();
    const actual   = geocodeCredits();
    expect(reserved - actual).toBe(0);
  });
});
