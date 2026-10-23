/**
 * GEO-AUTO-1 — Geocodificación automática al crear trabajos
 *
 * Cubre las funciones puras de geocoder.ts y simula el flujo de background
 * geocoding que se dispara en ScreenPlanificacion tras onCreateJob.
 *
 * Tests de funciones puras:
 *   GAC-P1  hasSufficientAddress — solo dirección
 *   GAC-P2  hasSufficientAddress — solo localidad
 *   GAC-P3  hasSufficientAddress — solo cp
 *   GAC-P4  hasSufficientAddress — insuficiente (vacío)
 *   GAC-P5  validateGeoResult — país correcto, localidad coincide
 *   GAC-P6  validateGeoResult — país incorrecto → rechaza
 *   GAC-P7  validateGeoResult — localidad contradictoria → rechaza
 *   GAC-P8  validateGeoResult — sin metadatos → rechaza (validación conservadora)
 *   GAC-P9  validateGeoResult — localidad parcial (Bilbao ⊂ 'Bilbao, Bizkaia') → acepta
 *   GAC-P10 validateGeoResult — cp contradictorio → rechaza (Rule 4)
 *   GAC-P11 validateGeoResult — locality y postal_code ausentes → rechaza (Rule 2)
 *   GAC-P12 validateGeoResult — calle + ROOFTOP → acepta (Rule 5 no dispara)
 *   GAC-P13 validateGeoResult — calle + GEOMETRIC_CENTER → rechaza (Rule 5)
 *   GAC-P14 validateGeoResult — calle + Nominatim sin route → rechaza (Rule 5 Nominatim path)
 *   GAC-P15 validateGeoResult — Google ROOFTOP + calle + portal coincidente → acepta
 *   GAC-P16 validateGeoResult — Google ROOFTOP + portal distinto → rechaza (Rule 6)
 *   GAC-P17 validateGeoResult — Google RANGE_INTERPOLATED → rechaza (Rule 5: solo ROOFTOP)
 *   GAC-P18 validateGeoResult — Google APPROXIMATE → rechaza (Rule 5)
 *   GAC-P19 validateGeoResult — Nominatim con route + portal coincidente → acepta
 *   GAC-P20 validateGeoResult — pueblo + CP sin portal (sin direccion) → acepta (Rules 1-4 solo)
 *   GAC-P21 validateGeoResult — barrio rural sin route, con direccion → rechaza (Rule 5)
 *   GAC-P22 validateGeoResult — calle coincidente, CP contradictorio → rechaza (Rule 4)
 *
 * Tests del flujo de creación (simulación):
 *   GAC-1   Alta con dirección completa → geocodificación lanzada, updateJobGeoAuto llamado
 *   GAC-2   Alta con dirección insuficiente → geocodeAddress NO llamado
 *   GAC-3   Alta guardada aunque geocodeAddress devuelva null
 *   GAC-4   Respuesta territorialmente coherente → updateJobGeoAuto llamado
 *   GAC-5   Respuesta contradictoria → validateGeoResult rechaza, sin updateJobGeoAuto
 *   GAC-6   Resultado tardío (dirección cambió en DB) → updateJobGeoAuto applied=false, sin error
 *   GAC-7   Confirmación manual concurrente → updateJobGeoAuto applied=false (geo_source='manual')
 *   GAC-8   Trabajo eliminado mientras responde el proveedor → applied=false, sin error
 *   GAC-9   Error del proveedor → catch, sin excepción propagada
 *   GAC-10  No LiveMode → geocodificación NO lanzada
 *   GAC-11  Reintento posterior → hasSufficientAddress permite nuevo intento
 *   GAC-12  No regresión del flujo de edición: geo vars importadas sin conflicto
 *   GAC-13  applied=true → onJobGeoAutoFn llamado (local state), exactamente una escritura DB
 *   GAC-14  no regresión: escritura única y protección manual tras PRECISION-GUARD-FIX
 *   GAC-ORG-1 cambio de organización durante IIFE → updateJobGeoAuto applied=false (DB protección), sin callback
 */
import { describe, it, expect, vi } from 'vitest';
import { hasSufficientAddress, validateGeoResult, type GeocodeResult } from '../../lib/geocoder';
import type { JobGeoAddressSnapshot } from '../../lib/supabase';

// ── Funciones puras ───────────────────────────────────────────────────────────

describe('hasSufficientAddress', () => {
  it('GAC-P1: solo dirección → suficiente', () => {
    expect(hasSufficientAddress({ direccion: 'Calle Mayor 1' })).toBe(true);
  });

  it('GAC-P2: solo localidad → suficiente', () => {
    expect(hasSufficientAddress({ localidad: 'Santander' })).toBe(true);
  });

  it('GAC-P3: solo cp → suficiente', () => {
    expect(hasSufficientAddress({ cp: '39001' })).toBe(true);
  });

  it('GAC-P4: todo vacío → insuficiente', () => {
    expect(hasSufficientAddress({ direccion: '', localidad: null, cp: undefined })).toBe(false);
    expect(hasSufficientAddress({})).toBe(false);
  });
});

describe('validateGeoResult', () => {
  const makeResult = (overrides: Partial<GeocodeResult> = {}): GeocodeResult => ({
    latitud: 43.46, longitud: -3.81, formatted_address: 'Calle Mayor 1, Santander, España',
    provider: 'nominatim', country_code: 'es', locality: 'Santander',
    ...overrides,
  });

  it('GAC-P5: país ES, localidad coincide → acepta', () => {
    expect(validateGeoResult(makeResult(), { localidad: 'Santander', cp: '39001' })).toBe(true);
  });

  it('GAC-P6: country_code !== ES → rechaza', () => {
    expect(validateGeoResult(makeResult({ country_code: 'fr' }), { localidad: 'Santander' })).toBe(false);
  });

  it('GAC-P7: localidad completamente distinta → rechaza', () => {
    expect(validateGeoResult(
      makeResult({ locality: 'Barcelona' }),
      { localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P8: sin metadatos → rechaza (validación conservadora — no evidencia positiva)', () => {
    const r: GeocodeResult = { latitud: 43.46, longitud: -3.81, formatted_address: 'X' };
    expect(validateGeoResult(r, { localidad: 'Santander' })).toBe(false);
  });

  it('GAC-P9: localidad parcial (Bilbao ⊂ "Bilbao, Bizkaia") → acepta', () => {
    expect(validateGeoResult(
      makeResult({ locality: 'Bilbao, Bizkaia', country_code: 'es' }),
      { localidad: 'Bilbao' },
    )).toBe(true);
  });

  it('GAC-P10: cp contradictorio → rechaza (Rule 4)', () => {
    // result.postal_code presente pero distinto del params.cp
    expect(validateGeoResult(
      makeResult({ postal_code: '48001' }),  // Bilbao, no Santander
      { localidad: 'Santander', cp: '39001' },
    )).toBe(false);
  });

  it('GAC-P11: locality y postal_code ambos ausentes → rechaza (Rule 2)', () => {
    expect(validateGeoResult(
      makeResult({ locality: undefined, postal_code: undefined }),
      { localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P12: calle + ROOFTOP → acepta (precisión domicilio confirmada, Rule 5 no dispara)', () => {
    expect(validateGeoResult(
      makeResult({ location_type: 'ROOFTOP' }),
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(true);
  });

  it('GAC-P13: calle + GEOMETRIC_CENTER → rechaza (proveedor devolvió centro de localidad, Rule 5)', () => {
    expect(validateGeoResult(
      makeResult({ location_type: 'GEOMETRIC_CENTER' }),
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P14: calle + Nominatim sin route → rechaza (Rule 5 Nominatim path: calle no identificada)', () => {
    const nominatimNoRoute: GeocodeResult = {
      latitud: 43.46, longitud: -3.81,
      formatted_address: 'Santander, Cantabria, España',
      provider: 'nominatim', country_code: 'es', locality: 'Santander',
      // no location_type, no route → Nominatim solo identificó localidad, no la calle
    };
    expect(validateGeoResult(
      nominatimNoRoute,
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P15: Google ROOFTOP + calle + portal coincidente → acepta', () => {
    expect(validateGeoResult(
      makeResult({ location_type: 'ROOFTOP', route: 'Calle Mayor', house_number: '1' }),
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(true);
  });

  it('GAC-P16: Google ROOFTOP + portal distinto → rechaza (Rule 6: proveedor devolvió portal vecino)', () => {
    expect(validateGeoResult(
      makeResult({ location_type: 'ROOFTOP', route: 'Calle Mayor', house_number: '3' }),
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P17: Google RANGE_INTERPOLATED → rechaza (Rule 5: solo ROOFTOP es precisión suficiente)', () => {
    expect(validateGeoResult(
      makeResult({ location_type: 'RANGE_INTERPOLATED', route: 'Calle Mayor' }),
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P18: Google APPROXIMATE → rechaza (Rule 5: area aproximada, no domicilio)', () => {
    expect(validateGeoResult(
      makeResult({ location_type: 'APPROXIMATE' }),
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(false);
  });

  it('GAC-P19: Nominatim con route + portal coincidente → acepta', () => {
    const nominatimPrecise: GeocodeResult = {
      latitud: 43.46, longitud: -3.81,
      formatted_address: 'Calle Mayor 1, Santander, España',
      provider: 'nominatim', country_code: 'es', locality: 'Santander',
      route: 'Calle Mayor', house_number: '1',
    };
    expect(validateGeoResult(
      nominatimPrecise,
      { direccion: 'Calle Mayor 1', localidad: 'Santander' },
    )).toBe(true);
  });

  it('GAC-P20: pueblo + CP sin portal (sin direccion) → acepta (Rules 1-4 únicamente)', () => {
    // Sin direccion: Rules 5 y 6 no aplican. Solo se verifica país + ancla territorial.
    expect(validateGeoResult(
      makeResult({ postal_code: '39001' }),
      { localidad: 'Santander', cp: '39001' },  // sin direccion
    )).toBe(true);
  });

  it('GAC-P21: barrio rural sin route con direccion → rechaza (Rule 5 Nominatim path)', () => {
    // Resultado ambiguo: Nominatim identificó localidad pero no la vía
    const ambiguous: GeocodeResult = {
      latitud: 43.2, longitud: -3.9,
      formatted_address: 'Barrio La Lomba, Cantabria, España',
      provider: 'nominatim', country_code: 'es', locality: 'La Lomba',
      // no route → no se identificó la vía solicitada
    };
    expect(validateGeoResult(
      ambiguous,
      { direccion: 'Barrio La Lomba 3', localidad: 'La Lomba' },
    )).toBe(false);
  });

  it('GAC-P22: Nominatim calle identificada pero CP contradictorio → rechaza (Rule 4)', () => {
    expect(validateGeoResult(
      makeResult({ route: 'Calle Mayor', house_number: '1', postal_code: '48001' }),  // Bilbao CP
      { direccion: 'Calle Mayor 1', localidad: 'Santander', cp: '39001' },
    )).toBe(false);
  });
});

// ── Simulación del flujo de background geocoding ──────────────────────────────
// Replica el comportamiento del IIFE en ScreenPlanificacion.handleSave (rama de creación).

interface CreateGeoCtx {
  jobId: string;
  savedJob: { direccion?: string | null; localidad?: string | null; cp?: string | null; orgId?: string };
  isLiveMode: boolean;
  geocodeFn: () => Promise<GeocodeResult | null>;
  updateJobGeoAutoFn: (
    id: string, lat: number, lng: number, addr: string, snap: JobGeoAddressSnapshot,
  ) => Promise<{ applied: boolean }>;
  onJobGeoAutoFn: (id: string, lat: number, lng: number, normAddress: string) => void;
}

async function runBackgroundGeo(ctx: CreateGeoCtx): Promise<void> {
  if (!ctx.isLiveMode) return;
  if (!hasSufficientAddress({ direccion: ctx.savedJob.direccion, localidad: ctx.savedJob.localidad, cp: ctx.savedJob.cp })) return;
  const addrSnapshot: JobGeoAddressSnapshot = {
    direccion: ctx.savedJob.direccion ?? null,
    localidad: ctx.savedJob.localidad ?? null,
    cp:        ctx.savedJob.cp        ?? null,
  };
  try {
    const geo = await ctx.geocodeFn();
    if (!geo || !validateGeoResult(geo, { direccion: ctx.savedJob.direccion, localidad: ctx.savedJob.localidad, cp: ctx.savedJob.cp })) return;
    const { applied } = await ctx.updateJobGeoAutoFn(ctx.jobId, geo.latitud, geo.longitud, geo.formatted_address, addrSnapshot);
    // Local state only — DB was already written by updateJobGeoAutoFn (single write).
    if (applied) ctx.onJobGeoAutoFn(ctx.jobId, geo.latitud, geo.longitud, geo.formatted_address);
  } catch (err) {
    console.error('[GEO-AUTO] Background geocoding failed for new job:', err);
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const JOB_ID = 'job-new-001';
const GEO_OK: GeocodeResult = {
  latitud: 43.46, longitud: -3.81,
  formatted_address: 'Calle Mayor 1, Santander, España',
  provider: 'nominatim', country_code: 'es', locality: 'Santander',
  route: 'Calle Mayor', house_number: '1',
};
const ADDR = { direccion: 'Calle Mayor 1', localidad: 'Santander', cp: '39001' };

function makeGeoAuto(applied: boolean) {
  const calls: unknown[] = [];
  return {
    fn: vi.fn(async (...args: unknown[]) => { calls.push(args); return { applied }; }),
    calls,
  };
}
function makeJobGeoAutoCallback() {
  const calls: unknown[] = [];
  return {
    fn: vi.fn((...args: unknown[]) => { calls.push(args); }),
    calls,
  };
}

// ── Tests de flujo ────────────────────────────────────────────────────────────

describe('Flujo background geocoding — creación de trabajo', () => {
  it('GAC-1: dirección completa → updateJobGeoAuto llamado, onJobGeoAutoFn llamado', async () => {
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geoAuto.calls).toHaveLength(1);   // una escritura DB
    expect(geoAutoFn.calls).toHaveLength(1); // un callback local
  });

  it('GAC-2: dirección insuficiente → geocodeAddress NO llamado', async () => {
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    const geocodeFn = vi.fn(async () => GEO_OK);
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: { direccion: '', localidad: null, cp: undefined },
      isLiveMode: true, geocodeFn,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geocodeFn).not.toHaveBeenCalled();
    expect(geoAuto.calls).toHaveLength(0);
  });

  it('GAC-3: geocodeAddress devuelve null → trabajo guardado, sin excepción', async () => {
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await expect(runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => null,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    })).resolves.toBeUndefined();
    expect(geoAuto.calls).toHaveLength(0);
  });

  it('GAC-4: respuesta coherente → updateJobGeoAuto llamado con coords correctas', async () => {
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    const [id, lat, lng] = geoAuto.calls[0] as [string, number, number];
    expect(id).toBe(JOB_ID);
    expect(lat).toBeCloseTo(43.46);
    expect(lng).toBeCloseTo(-3.81);
  });

  it('GAC-5: localidad contradictoria → validateGeoResult rechaza, sin updateJobGeoAuto', async () => {
    const contradictory: GeocodeResult = { ...GEO_OK, locality: 'Barcelona', country_code: 'es' };
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => contradictory,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geoAuto.calls).toHaveLength(0);
    expect(geoAutoFn.calls).toHaveLength(0);
  });

  it('GAC-6: resultado tardío (dirección cambió en DB) → applied=false, callback NO llamado', async () => {
    const geoAuto   = makeGeoAuto(false);  // snapshot mismatch → applied=false
    const geoAutoFn = makeJobGeoAutoCallback();
    await expect(runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    })).resolves.toBeUndefined();
    expect(geoAuto.calls).toHaveLength(1);    // DB write attempted
    expect(geoAutoFn.calls).toHaveLength(0);  // React state NOT updated
  });

  it('GAC-7: confirmación manual concurrente → applied=false, callback NO llamado', async () => {
    const geoAuto   = makeGeoAuto(false);  // geo_source='manual' bloquea auto
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geoAuto.calls).toHaveLength(1);
    expect(geoAutoFn.calls).toHaveLength(0);
  });

  it('GAC-8: trabajo eliminado → applied=false (0 filas), callback NO llamado, sin error', async () => {
    const geoAuto   = makeGeoAuto(false);  // job deleted → 0 rows affected
    const geoAutoFn = makeJobGeoAutoCallback();
    await expect(runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    })).resolves.toBeUndefined();
    expect(geoAuto.calls).toHaveLength(1);
    expect(geoAutoFn.calls).toHaveLength(0);
  });

  it('GAC-9: error del proveedor → catch silencioso, sin excepción propagada', async () => {
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await expect(runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => { throw new Error('Nominatim timeout'); },
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    })).resolves.toBeUndefined();
    expect(geoAuto.calls).toHaveLength(0);
  });

  it('GAC-10: isLiveMode=false → geocodificación NO lanzada', async () => {
    const geocodeFn = vi.fn(async () => GEO_OK);
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: false,
      geocodeFn, updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geocodeFn).not.toHaveBeenCalled();
    expect(geoAuto.calls).toHaveLength(0);
  });

  it('GAC-11: trabajo sin coords y dirección suficiente → hasSufficientAddress permite reintento', () => {
    const jobWithNoCoords = { ...ADDR, latitud: null, longitud: null, geo_source: null };
    expect(hasSufficientAddress({ direccion: jobWithNoCoords.direccion, localidad: jobWithNoCoords.localidad, cp: jobWithNoCoords.cp })).toBe(true);
  });

  it('GAC-13: applied=true → exactamente una escritura DB y un callback local (sin segunda escritura)', async () => {
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    // Invariante: exactamente una escritura geográfica protegida, más un callback local.
    expect(geoAuto.calls).toHaveLength(1);   // una sola escritura DB
    expect(geoAutoFn.calls).toHaveLength(1); // callback local llamado
    // geoAutoFn es local (sin acceso a updateJobGeoAutoFn) → no puede producir segunda escritura
    const [cbJobId, cbLat, cbLng, cbAddr] = geoAutoFn.calls[0] as [string, number, number, string];
    expect(cbJobId).toBe(JOB_ID);
    expect(cbLat).toBeCloseTo(43.46);
    expect(cbLng).toBeCloseTo(-3.81);
    expect(cbAddr).toBe(GEO_OK.formatted_address);
  });

  it('GAC-14: no regresión PRECISION-GUARD-FIX — escritura única y protección manual intactas', async () => {
    // GEO_OK ahora incluye route+house_number; la validación sigue aceptando resultados precisos.
    const geoAuto   = makeGeoAuto(true);
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geoAuto.calls).toHaveLength(1);   // exactamente una escritura DB
    expect(geoAutoFn.calls).toHaveLength(1); // un callback local
    // Confirmación manual (applied=false) sigue bloqueando el callback
    const geoAutoBlocked   = makeGeoAuto(false);
    const geoAutoFnBlocked = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: JOB_ID, savedJob: ADDR, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAutoBlocked.fn, onJobGeoAutoFn: geoAutoFnBlocked.fn,
    });
    expect(geoAutoFnBlocked.calls).toHaveLength(0); // protección manual intacta
  });

  it('GAC-ORG-1: cambio de org durante IIFE → updateJobGeoAuto applied=false (RLS/snapshot guard), sin callback local', async () => {
    // Simula: job-new-001 fue creado en org A. Durante el IIFE el usuario cambió a org B.
    // updateJobGeoAuto rechaza el write (snapshot mismatch o RLS) → applied=false.
    // El callback onJobGeoAutoFn NO es llamado → el estado de org B no se contamina.
    const geoAuto   = makeGeoAuto(false); // org change → DB write rejected
    const geoAutoFn = makeJobGeoAutoCallback();
    await runBackgroundGeo({
      jobId: 'old-org-job-001', savedJob: { ...ADDR, orgId: 'org-A' }, isLiveMode: true,
      geocodeFn: async () => GEO_OK,
      updateJobGeoAutoFn: geoAuto.fn, onJobGeoAutoFn: geoAutoFn.fn,
    });
    expect(geoAuto.calls).toHaveLength(1);    // DB write intentado, rechazado por DB
    expect(geoAutoFn.calls).toHaveLength(0);  // callback local NO llamado → org B no afectado
  });
});

// ── No regresión ──────────────────────────────────────────────────────────────

describe('GAC-12: no regresión — geocoder exports compatibles', () => {
  it('hasSufficientAddress y validateGeoResult importadas sin conflicto', () => {
    expect(typeof hasSufficientAddress).toBe('function');
    expect(typeof validateGeoResult).toBe('function');
  });
});
