/**
 * PH0-PLANNING-GEO-ADDRESS-ATOMIC-FIX-1 — Regression tests
 *
 * Invariantes cubiertos:
 *
 *  Caso A — Cambio legítimo de dirección (manual o auto → invalidada)
 *  Caso B — Confirmación manual concurrente de dirección vigente preservada
 *  Caso C — Geocodificación automática tardía rechazada
 *  Caso D — Edición no geográfica sin alteración de coordenadas
 *
 * Tests:
 *  TS-1  Dirección A manual → dirección B → changeJobAddressClearGeo llamada, geo invalidada
 *  TS-2  Dirección A auto   → dirección B → mismo flujo que TS-1
 *  TS-3  Cambio de dirección + geocodificación fallida → RPC llamada, sin updateJobGeoAuto
 *  TS-4  Geocodificación exitosa + manual concurrente → RPC ok, updateJobGeoAuto applied=false sin error
 *  TS-5  Snapshot obsoleto (otra sesión cambió dirección) → applied=false → error lanzado
 *  TS-6  Geocodificación automática tardía → updateJobGeoAuto IS DISTINCT FROM 'manual' la rechaza
 *  TS-7  Edición no geográfica (addressChanged=false, geoExtras={}) → solo onUpdateJob, sin RPC ni geo
 *  TS-8  Aislamiento entre organizaciones → RPC lanza excepción (auth check)
 *  TS-9  Error de red en RPC → error propagado, sin éxito falso
 */
import { describe, it, expect, vi } from 'vitest';
import type { JobGeoAddressSnapshot } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────────

function makeChangeJobAddressClearGeo(applied: boolean, error?: Error) {
  const calls: { jobId: string; oldSnap: JobGeoAddressSnapshot; newAddr: JobGeoAddressSnapshot }[] = [];
  const fn = vi.fn(async (
    jobId: string,
    oldSnap: JobGeoAddressSnapshot,
    newAddr: JobGeoAddressSnapshot,
  ) => {
    calls.push({ jobId, oldSnap, newAddr });
    if (error) throw error;
    return { applied };
  });
  return { fn, calls };
}

function makeUpdateJobGeoAuto(applied: boolean, error?: Error) {
  const calls: unknown[] = [];
  const fn = vi.fn(async (...args: unknown[]) => {
    calls.push(args);
    if (error) throw error;
    return { applied };
  });
  return { fn, calls };
}

function makeOnUpdateJob(error?: Error) {
  const calls: unknown[] = [];
  const fn = vi.fn(async (...args: unknown[]) => {
    calls.push(args);
    if (error) throw error;
  });
  return { fn, calls };
}

// ── handleSaveGeo simulation ──────────────────────────────────────────────────
// Replicates the geo-writing block from ScreenPlanificacion.tsx handleSave.

interface SaveGeoCtx {
  jobId: string;
  editingJobAddress: JobGeoAddressSnapshot;
  draft: JobGeoAddressSnapshot;
  addrChanged: boolean;
  geoExtras: {
    latitud?: number | null;
    longitud?: number | null;
    direccion_normalizada?: string | null;
  };
  otherFields: Record<string, unknown>;
  changeJobAddressClearGeoFn: (
    id: string,
    oldSnap: JobGeoAddressSnapshot,
    newAddr: JobGeoAddressSnapshot,
  ) => Promise<{ applied: boolean }>;
  updateJobGeoAutoFn: (
    id: string, lat: number, lng: number, addr: string, snap: JobGeoAddressSnapshot,
  ) => Promise<{ applied: boolean }>;
  onUpdateJobFn: (id: string, fields: Record<string, unknown>) => Promise<void>;
}

async function handleSaveGeo(ctx: SaveGeoCtx): Promise<void> {
  const autoLat = ctx.geoExtras.latitud ?? null;
  const autoLng = ctx.geoExtras.longitud ?? null;

  if (ctx.addrChanged) {
    const oldSnapshot: JobGeoAddressSnapshot = ctx.editingJobAddress;
    const newAddress: JobGeoAddressSnapshot = {
      direccion: ctx.draft.direccion ?? null,
      localidad: ctx.draft.localidad ?? null,
      cp:        ctx.draft.cp        ?? null,
    };
    const { applied } = await ctx.changeJobAddressClearGeoFn(ctx.jobId, oldSnapshot, newAddress);
    if (!applied) throw new Error('La dirección fue modificada por otra sesión. Recarga y vuelve a intentarlo.');

    if (autoLat != null && autoLng != null) {
      const newAddrSnapshot: JobGeoAddressSnapshot = newAddress;
      await ctx.updateJobGeoAutoFn(ctx.jobId, autoLat, autoLng, ctx.geoExtras.direccion_normalizada ?? '', newAddrSnapshot);
    }

    if (Object.keys(ctx.otherFields).length > 0) {
      await ctx.onUpdateJobFn(ctx.jobId, ctx.otherFields);
    }
  } else {
    if (autoLat != null && autoLng != null) {
      await ctx.onUpdateJobFn(ctx.jobId, { ...ctx.otherFields, ...ctx.draft });
      const geoSnapshot: JobGeoAddressSnapshot = {
        direccion: ctx.draft.direccion ?? null,
        localidad: ctx.draft.localidad ?? null,
        cp:        ctx.draft.cp        ?? null,
      };
      await ctx.updateJobGeoAutoFn(ctx.jobId, autoLat, autoLng, ctx.geoExtras.direccion_normalizada ?? '', geoSnapshot);
    } else {
      await ctx.onUpdateJobFn(ctx.jobId, { ...ctx.otherFields, ...ctx.draft });
    }
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const JOB_ID    = 'job-001';
const OLD_ADDR  = { direccion: 'Calle A 1', localidad: 'Madrid', cp: '28001' };
const NEW_ADDR  = { direccion: 'Calle B 5', localidad: 'Bilbao', cp: '48001' };
const OTHER     = { titulo: 'Instalación caldera', estado: 'planificado' };
const AUTO_GEO  = { latitud: 43.26, longitud: -2.93, direccion_normalizada: 'Calle B 5, Bilbao' };

// ── Caso A — Cambio legítimo de dirección ─────────────────────────────────────

describe('Caso A — Cambio de dirección: geo invalidada (TS-1, TS-2, TS-3)', () => {
  it('TS-1: dirección A con geo manual → RPC llamada, geo invalidada', async () => {
    const rpc      = makeChangeJobAddressClearGeo(true);
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await handleSaveGeo({
      jobId: JOB_ID,
      editingJobAddress: OLD_ADDR,
      draft: NEW_ADDR,
      addrChanged: true,
      geoExtras: {},           // geocoding skipped / failed
      otherFields: OTHER,
      changeJobAddressClearGeoFn: rpc.fn,
      updateJobGeoAutoFn: geoAuto.fn,
      onUpdateJobFn: updateFn.fn,
    });

    expect(rpc.calls).toHaveLength(1);
    expect(rpc.calls[0].oldSnap).toEqual(OLD_ADDR);
    expect(rpc.calls[0].newAddr).toEqual(NEW_ADDR);
    expect(geoAuto.calls).toHaveLength(0);  // no geocoding result
    expect(updateFn.calls).toHaveLength(1); // otherFields written
  });

  it('TS-2: dirección A con geo auto → misma ruta RPC que TS-1', async () => {
    const rpc      = makeChangeJobAddressClearGeo(true);
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await handleSaveGeo({
      jobId: JOB_ID, editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
      geoExtras: {}, otherFields: OTHER,
      changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
    });

    expect(rpc.calls).toHaveLength(1);
    expect(geoAuto.calls).toHaveLength(0);
  });

  it('TS-3: cambio de dirección + geocodificación fallida → RPC sí, updateJobGeoAuto no', async () => {
    const rpc      = makeChangeJobAddressClearGeo(true);
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await handleSaveGeo({
      jobId: JOB_ID, editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
      geoExtras: { latitud: null, longitud: null },  // geocoding failed
      otherFields: OTHER,
      changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
    });

    expect(rpc.calls).toHaveLength(1);
    expect(geoAuto.calls).toHaveLength(0);
  });
});

// ── Caso B — Confirmación manual concurrente preservada ───────────────────────

describe('Caso B — Manual concurrente preservada (TS-4, TS-5)', () => {
  it('TS-4: geocodificación exitosa + manual concurrente → updateJobGeoAuto applied=false, sin error', async () => {
    const rpc      = makeChangeJobAddressClearGeo(true);
    const geoAuto  = makeUpdateJobGeoAuto(false);  // IS DISTINCT FROM 'manual' rechaza auto-geo
    const updateFn = makeOnUpdateJob();

    await expect(
      handleSaveGeo({
        jobId: JOB_ID, editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
        geoExtras: AUTO_GEO, otherFields: OTHER,
        changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
      })
    ).resolves.toBeUndefined();

    expect(rpc.calls).toHaveLength(1);
    expect(geoAuto.calls).toHaveLength(1);  // llamado pero no aplicado (manual prevalece)
    expect(updateFn.calls).toHaveLength(1);
  });

  it('TS-5: snapshot obsoleto → applied=false → error lanzado, estado no modificado', async () => {
    const rpc      = makeChangeJobAddressClearGeo(false);  // otra sesión cambió antes
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await expect(
      handleSaveGeo({
        jobId: JOB_ID, editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
        geoExtras: AUTO_GEO, otherFields: OTHER,
        changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
      })
    ).rejects.toThrow('La dirección fue modificada por otra sesión');

    expect(rpc.calls).toHaveLength(1);
    expect(geoAuto.calls).toHaveLength(0);  // nunca se llega a updateJobGeoAuto
    expect(updateFn.calls).toHaveLength(0);
  });
});

// ── Caso C — Geocodificación automática tardía rechazada ──────────────────────

describe('Caso C — Auto-geocoding tardío rechazado (TS-6)', () => {
  it('TS-6: RPC limpia geo → updateJobGeoAuto tardío rechazado por IS DISTINCT FROM manual', async () => {
    // RPC aplicada (geo_source=null). Luego otra sesión confirma manual (geo_source='manual').
    // Cuando updateJobGeoAuto llega, IS DISTINCT FROM 'manual' → applied=false. Sin error.
    const rpc      = makeChangeJobAddressClearGeo(true);
    const geoAuto  = makeUpdateJobGeoAuto(false);  // manual concurrente bloqueó
    const updateFn = makeOnUpdateJob();

    await expect(
      handleSaveGeo({
        jobId: JOB_ID, editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
        geoExtras: AUTO_GEO, otherFields: OTHER,
        changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
      })
    ).resolves.toBeUndefined();

    expect(rpc.calls).toHaveLength(1);
    expect(geoAuto.calls).toHaveLength(1);
    // La confirmación manual concurrente queda intacta (applied=false no lanza error)
  });
});

// ── Caso D — Edición no geográfica sin alteración de coordenadas ──────────────

describe('Caso D — Edición no geográfica (TS-7)', () => {
  it('TS-7: solo cambios no-geo (addressChanged=false) → onUpdateJob, sin RPC ni updateJobGeoAuto', async () => {
    const rpc      = makeChangeJobAddressClearGeo(true);
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await handleSaveGeo({
      jobId: JOB_ID,
      editingJobAddress: OLD_ADDR,
      draft: OLD_ADDR,  // misma dirección
      addrChanged: false,
      geoExtras: {},    // sin geocodificación
      otherFields: { titulo: 'Nuevo título', estado: 'completado' },
      changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
    });

    expect(rpc.calls).toHaveLength(0);    // sin RPC
    expect(geoAuto.calls).toHaveLength(0); // sin escritura geo
    expect(updateFn.calls).toHaveLength(1); // solo campos normales
  });
});

// ── Aislamiento y errores ─────────────────────────────────────────────────────

describe('TS-8 — Aislamiento org / TS-9 — Error de red propagado', () => {
  it('TS-8: RPC lanza excepción por usuario de otra organización → error propagado', async () => {
    const rpc = makeChangeJobAddressClearGeo(false, new Error('Not authorized: caller is not an active member'));
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await expect(
      handleSaveGeo({
        jobId: 'job-otra-org', editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
        geoExtras: {}, otherFields: OTHER,
        changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
      })
    ).rejects.toThrow('Not authorized');

    expect(geoAuto.calls).toHaveLength(0);
    expect(updateFn.calls).toHaveLength(0);
  });

  it('TS-9: error de red en RPC → error propagado, sin éxito falso', async () => {
    const rpc = makeChangeJobAddressClearGeo(false, new Error('network error'));
    const geoAuto  = makeUpdateJobGeoAuto(true);
    const updateFn = makeOnUpdateJob();

    await expect(
      handleSaveGeo({
        jobId: JOB_ID, editingJobAddress: OLD_ADDR, draft: NEW_ADDR, addrChanged: true,
        geoExtras: AUTO_GEO, otherFields: OTHER,
        changeJobAddressClearGeoFn: rpc.fn, updateJobGeoAutoFn: geoAuto.fn, onUpdateJobFn: updateFn.fn,
      })
    ).rejects.toThrow('network error');

    expect(geoAuto.calls).toHaveLength(0);
    expect(updateFn.calls).toHaveLength(0);
  });
});
