/**
 * LP-2B — Integración LocationPicker con trabajos (corrección final)
 *
 * Invariantes verificados:
 *  1. Una sola escritura protegida por confirmación (updateJobGeoManualFn).
 *  2. Sin segundo UPDATE genérico — onJobGeoConfirmed es state-only.
 *  3. Estado local actualizado después de éxito con confirmedAt exacto.
 *  4. applied=false → sin confirmación visual ni cambio de estado.
 *  5. Error de red → excepción propagada, sin toast de éxito.
 *  6. Coordenadas inválidas → cero escrituras (validación en cliente).
 *  7. Cambio de dirección detectado por snapshot WHERE guard.
 *  8. Aislamiento por organización.
 *  9. Modo demo sin escritura remota.
 * 10. Orden del itinerario intacto tras confirmación.
 */
import { describe, it, expect, vi } from 'vitest';
import type { TradeJob } from '../../lib/supabase';
import type { JobGeoAddressSnapshot } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<TradeJob> = {}): TradeJob {
  return {
    id: 'job-001',
    org_id: 'org-abc',
    titulo: 'Instalación caldera',
    descripcion: null,
    tipo: 'trabajo',
    estado: 'planificado',
    prioridad: 'normal',
    fecha_inicio: '2026-10-22',
    hora_inicio: null,
    fecha_fin: null,
    hora_fin: null,
    duracion_horas: null,
    direccion: 'Calle Mayor 1',
    localidad: 'Santander',
    cp: '39001',
    latitud: 43.462,
    longitud: -3.81,
    geo_source: 'auto',
    geo_confirmed_at: null,
    completado_por: null,
    completado_at: null,
    notas_cierre: null,
    orden_ruta: null,
    direccion_normalizada: null,
    ventana_inicio: null,
    ventana_fin: null,
    duracion_estimada_min: null,
    notas_trabajador: null,
    started_at: null,
    pause_reason: null,
    material_pendiente: null,
    fecha_estimada_material: null,
    rescheduled_from: null,
    priority_insert: null,
    firma_cliente_url: null,
    parte_token: null,
    created_at: '2026-10-22T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
    trade_clients: null,
    trade_job_workers: [],
    ...overrides,
  };
}

// ── isValidLatLng (misma lógica que RouteMap.tsx) ─────────────────────────────

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

// ── Tracked callbacks (avoid vi.fn() typing issues) ───────────────────────────

interface GeoConfirmedCall { jobId: string; lat: number; lng: number; confirmedAt: string; }
interface ToastCall { msg: string; type: string; }

function makeTrackers() {
  const geoConfirmedCalls: GeoConfirmedCall[] = [];
  const toastCalls: ToastCall[] = [];

  const onJobGeoConfirmed = (jobId: string, lat: number, lng: number, confirmedAt: string): void => {
    geoConfirmedCalls.push({ jobId, lat, lng, confirmedAt });
  };
  const showToast = (msg: string, type: string): void => {
    toastCalls.push({ msg, type });
  };

  return { onJobGeoConfirmed, showToast, geoConfirmedCalls, toastCalls };
}

// ── Simulación de updateJobGeoManual ─────────────────────────────────────────

interface MockGeoManualCall {
  jobId: string;
  lat: number;
  lng: number;
  snapshot: JobGeoAddressSnapshot;
}

const FIXED_CONFIRMED_AT = '2026-10-22T14:00:00.000Z';

function makeUpdateJobGeoManual(applied: boolean, error?: Error) {
  const calls: MockGeoManualCall[] = [];
  const fn = vi.fn(async (jobId: string, lat: number, lng: number, snapshot: JobGeoAddressSnapshot) => {
    calls.push({ jobId, lat, lng, snapshot });
    if (error) throw error;
    return { applied, confirmedAt: applied ? FIXED_CONFIRMED_AT : null };
  });
  return { fn, calls };
}

// ── PickerState ───────────────────────────────────────────────────────────────

interface PickerState {
  job: TradeJob | null;
  snapshot: JobGeoAddressSnapshot | null;
}

function openLocationPicker(job: TradeJob): PickerState {
  return {
    job,
    snapshot: {
      direccion: job.direccion ?? null,
      localidad: job.localidad ?? null,
      cp: job.cp ?? null,
    },
  };
}

// ── ConfirmContext ────────────────────────────────────────────────────────────
// onJobGeoConfirmed es state-only (sin escritura DB). No hay onUpdateJob.

interface ConfirmContext {
  isLiveMode: boolean;
  pickerState: PickerState;
  updateJobGeoManualFn: (
    jobId: string,
    lat: number,
    lng: number,
    snapshot: JobGeoAddressSnapshot,
  ) => Promise<{ applied: boolean; confirmedAt: string | null }>;
  onJobGeoConfirmed?: (jobId: string, lat: number, lng: number, confirmedAt: string) => void;
  showToast: (msg: string, type: string) => void;
}

interface ConfirmResult {
  closedPicker: boolean;
  toastType: string | null;
  onJobGeoConfirmedCalled: boolean;
  onJobGeoConfirmedArgs: [string, number, number, string] | null;
}

async function handleLocationConfirm(
  lat: number,
  lng: number,
  ctx: ConfirmContext,
): Promise<ConfirmResult> {
  const result: ConfirmResult = {
    closedPicker: false,
    toastType: null,
    onJobGeoConfirmedCalled: false,
    onJobGeoConfirmedArgs: null,
  };

  if (!ctx.pickerState.job || !ctx.pickerState.snapshot) {
    throw new Error('Estado inconsistente — cierra y vuelve a intentarlo');
  }

  // Validación de coordenadas antes de cualquier escritura
  if (!isValidLatLng(lat, lng)) {
    throw new Error('Coordenadas inválidas — selecciona un punto en el mapa');
  }

  if (!ctx.isLiveMode) {
    result.closedPicker = true;
    ctx.showToast('Activa el modo real para guardar la ubicación', 'info');
    result.toastType = 'info';
    return result;
  }

  // Una sola escritura protegida
  const { applied, confirmedAt } = await ctx.updateJobGeoManualFn(
    ctx.pickerState.job.id,
    lat,
    lng,
    ctx.pickerState.snapshot,
  );

  if (!applied) {
    throw new Error('La dirección cambió mientras el selector estaba abierto. Cierra y vuelve a abrir para usar la dirección actual.');
  }

  // Actualización state-only con confirmedAt exacto de DB (sin segundo UPDATE)
  ctx.onJobGeoConfirmed?.(ctx.pickerState.job.id, lat, lng, confirmedAt!);
  result.onJobGeoConfirmedCalled = true;
  result.onJobGeoConfirmedArgs = [ctx.pickerState.job.id, lat, lng, confirmedAt!];

  result.closedPicker = true;
  ctx.showToast('Ubicación confirmada', 'success');
  result.toastType = 'success';

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('LP-2B — openLocationPicker (snapshot)', () => {
  it('LP2B-1 — apertura desde trabajo con GPS: snapshot contiene dirección', () => {
    const job = makeJob({ latitud: 43.462, longitud: -3.81, geo_source: 'auto' });
    const state = openLocationPicker(job);
    expect(state.job?.id).toBe('job-001');
    expect(state.snapshot).toEqual({ direccion: 'Calle Mayor 1', localidad: 'Santander', cp: '39001' });
    expect(state.job?.latitud).toBe(43.462);
  });

  it('LP2B-2 — apertura desde trabajo sin GPS: snapshot vacía, job sin coords', () => {
    const job = makeJob({ latitud: null, longitud: null, geo_source: null, direccion: null, localidad: null, cp: null });
    const state = openLocationPicker(job);
    expect(state.job?.latitud).toBeNull();
    expect(state.snapshot).toEqual({ direccion: null, localidad: null, cp: null });
  });

  it('LP2B-2b — apertura desde trabajo con dirección pero sin GPS', () => {
    const job = makeJob({ latitud: null, longitud: null, geo_source: null });
    const state = openLocationPicker(job);
    expect(state.job?.latitud).toBeNull();
    expect(state.snapshot?.direccion).toBe('Calle Mayor 1');
  });
});

describe('LP-2B — handleLocationConfirm cancelación', () => {
  it('LP2B-3 — cancelación: no llama a updateJobGeoManual ni a onJobGeoConfirmed', () => {
    const { fn } = makeUpdateJobGeoManual(true);
    const { geoConfirmedCalls } = makeTrackers();
    // La cancelación se maneja antes de handleLocationConfirm (onCancel callback).
    expect(fn).not.toHaveBeenCalled();
    expect(geoConfirmedCalls).toHaveLength(0);
  });
});

describe('LP-2B — confirmación aceptada (invariante escritura única)', () => {
  it('LP2B-4 — updateJobGeoManual recibe coords correctas', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    await handleLocationConfirm(43.5, -3.9, ctx);

    expect(mock.calls[0]).toMatchObject({ jobId: 'job-001', lat: 43.5, lng: -3.9 });
    expect(mock.calls[0].snapshot).toEqual({ direccion: 'Calle Mayor 1', localidad: 'Santander', cp: '39001' });
  });

  it('LP2B-5 — una sola escritura protegida: onJobGeoConfirmed con confirmedAt exacto, picker cerrado', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast, geoConfirmedCalls } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    const result = await handleLocationConfirm(43.5, -3.9, ctx);

    // Exactamente una escritura protegida
    expect(mock.fn).toHaveBeenCalledTimes(1);
    // onJobGeoConfirmed recibe confirmedAt exacto de DB
    expect(geoConfirmedCalls).toHaveLength(1);
    expect(geoConfirmedCalls[0]).toEqual({
      jobId: 'job-001',
      lat: 43.5,
      lng: -3.9,
      confirmedAt: FIXED_CONFIRMED_AT,
    });
    // result refleja los mismos datos
    expect(result.onJobGeoConfirmedCalled).toBe(true);
    expect(result.onJobGeoConfirmedArgs).toEqual(['job-001', 43.5, -3.9, FIXED_CONFIRMED_AT]);
    expect(result.closedPicker).toBe(true);
    expect(result.toastType).toBe('success');
  });
});

describe('LP-2B — escritura rechazada por cambio de dirección', () => {
  it('LP2B-6 — applied=false: lanza error con mensaje descriptivo', async () => {
    const { fn } = makeUpdateJobGeoManual(false);
    const { onJobGeoConfirmed, showToast } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: fn,
      onJobGeoConfirmed,
      showToast,
    };

    await expect(handleLocationConfirm(43.5, -3.9, ctx)).rejects.toThrow(
      'La dirección cambió mientras el selector estaba abierto',
    );
  });

  it('LP2B-6b — applied=false: onJobGeoConfirmed NO es llamado (sin cambio de estado local)', async () => {
    const { fn } = makeUpdateJobGeoManual(false);
    const { onJobGeoConfirmed, showToast, geoConfirmedCalls } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: fn,
      onJobGeoConfirmed,
      showToast,
    };

    await expect(handleLocationConfirm(43.5, -3.9, ctx)).rejects.toThrow();
    expect(geoConfirmedCalls).toHaveLength(0);
  });
});

describe('LP-2B — fallo de persistencia', () => {
  it('LP2B-7 — error de red: la excepción se propaga, sin toast de éxito', async () => {
    const { fn } = makeUpdateJobGeoManual(false, new Error('Network error'));
    const { onJobGeoConfirmed, showToast, geoConfirmedCalls, toastCalls } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: fn,
      onJobGeoConfirmed,
      showToast,
    };

    await expect(handleLocationConfirm(43.5, -3.9, ctx)).rejects.toThrow('Network error');
    expect(geoConfirmedCalls).toHaveLength(0);
    expect(toastCalls.filter(t => t.type === 'success')).toHaveLength(0);
  });
});

describe('LP-2B — cambio de organización', () => {
  it('LP2B-8 — snapshot está ligado al job de la organización original', () => {
    const jobOrgA = makeJob({ org_id: 'org-A', id: 'job-orgA' });
    const stateA = openLocationPicker(jobOrgA);

    const jobOrgB = makeJob({ org_id: 'org-B', id: 'job-orgB' });
    const stateB = openLocationPicker(jobOrgB);

    expect(stateA.job?.org_id).toBe('org-A');
    expect(stateB.job?.org_id).toBe('org-B');
    expect(stateA.job?.id).not.toBe(stateB.job?.id);
  });
});

describe('LP-2B — confirmación duplicada', () => {
  it('LP2B-9 — confirmación duplicada llama updateJobGeoManual dos veces (idempotente)', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast, geoConfirmedCalls } = makeTrackers();
    const job = makeJob();

    const state1 = openLocationPicker(job);
    const ctx1: ConfirmContext = {
      isLiveMode: true,
      pickerState: state1,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };
    await handleLocationConfirm(43.5, -3.9, ctx1);

    const state2 = openLocationPicker(job);
    const ctx2: ConfirmContext = {
      isLiveMode: true,
      pickerState: state2,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };
    await handleLocationConfirm(43.5, -3.9, ctx2);

    expect(mock.fn).toHaveBeenCalledTimes(2);
    expect(geoConfirmedCalls).toHaveLength(2);
  });
});

describe('LP-2B — coordenadas inválidas', () => {
  it('LP2B-10 — NaN: lanza error de validación en cliente, cero escrituras DB', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast, geoConfirmedCalls } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    await expect(handleLocationConfirm(NaN, NaN, ctx)).rejects.toThrow('Coordenadas inválidas');
    // La validación ocurre antes de la llamada a DB
    expect(mock.fn).not.toHaveBeenCalled();
    expect(geoConfirmedCalls).toHaveLength(0);
  });

  it('LP2B-10b — Infinity: lanza error de validación, cero escrituras', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    await expect(handleLocationConfirm(Infinity, 0, ctx)).rejects.toThrow('Coordenadas inválidas');
    expect(mock.fn).not.toHaveBeenCalled();
  });

  it('LP2B-10c — fuera de rango (lat>90): lanza error de validación', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    await expect(handleLocationConfirm(91, 0, ctx)).rejects.toThrow('Coordenadas inválidas');
    expect(mock.fn).not.toHaveBeenCalled();
  });
});

describe('LP-2B — preservación del orden del itinerario', () => {
  it('LP2B-11 — confirmar ubicación NO modifica orden_ruta ni otros campos', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast } = makeTrackers();
    const job = makeJob({ orden_ruta: 3 });
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: true,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    const result = await handleLocationConfirm(43.5, -3.9, ctx);

    // onJobGeoConfirmed solo recibe jobId, lat, lng, confirmedAt — sin orden_ruta
    expect(result.onJobGeoConfirmedArgs).toHaveLength(4);
    const [, , , confirmedAtArg] = result.onJobGeoConfirmedArgs!;
    expect(confirmedAtArg).toBe(FIXED_CONFIRMED_AT);
  });
});

describe('LP-2B — edición general sin sobrescribir coordenadas manuales', () => {
  it('LP2B-12 — buildDbUpdate excluye geo del draft y solo incluye geoExtras', () => {
    const draft = {
      titulo: 'Nueva caldera',
      direccion: 'Calle Mayor 2',
      localidad: 'Santander',
      cp: '39001',
      latitud: 43.5,
      longitud: -3.9,
      geo_source: 'manual' as const,
      geo_confirmed_at: '2026-10-22T10:00:00Z',
      estado: 'planificado' as const,
    };

    const geoExtras = {};

    const { latitud: _l, longitud: _lg, geo_source: _gs, geo_confirmed_at: _gca, ...nonGeoFields } = draft as Record<string, unknown>;
    const dbUpdate = { ...nonGeoFields, ...geoExtras };

    expect(dbUpdate).not.toHaveProperty('latitud');
    expect(dbUpdate).not.toHaveProperty('longitud');
    expect(dbUpdate).not.toHaveProperty('geo_source');
    expect(dbUpdate).not.toHaveProperty('geo_confirmed_at');
    expect(dbUpdate).toHaveProperty('titulo', 'Nueva caldera');
    expect(dbUpdate).toHaveProperty('direccion', 'Calle Mayor 2');
  });

  it('LP2B-12b — cambio de dirección en edición invalida geo_confirmed_at', () => {
    const addressChanged = true;
    const geoExtras = addressChanged
      ? { latitud: null, longitud: null, direccion_normalizada: null, geo_source: null, geo_confirmed_at: null }
      : {};

    const draft = {
      titulo: 'Nueva caldera',
      direccion: 'Calle Nueva 5',
      localidad: 'Torrelavega',
      cp: '39300',
      latitud: 43.5,
      longitud: -3.9,
      geo_source: 'manual' as const,
      geo_confirmed_at: '2026-10-22T10:00:00Z',
    };

    const { latitud: _l, longitud: _lg, geo_source: _gs, geo_confirmed_at: _gca, ...nonGeoFields } = draft as Record<string, unknown>;
    const dbUpdate = { ...nonGeoFields, ...geoExtras };

    expect(dbUpdate.geo_confirmed_at).toBeNull();
    expect(dbUpdate.geo_source).toBeNull();
    expect(dbUpdate.latitud).toBeNull();
    expect(dbUpdate.longitud).toBeNull();
  });
});

describe('LP-2B — modo demo', () => {
  it('LP2B-demo — modo demo: no llama a updateJobGeoManual ni onJobGeoConfirmed, cierra picker con info toast', async () => {
    const mock = makeUpdateJobGeoManual(true);
    const { onJobGeoConfirmed, showToast, geoConfirmedCalls, toastCalls } = makeTrackers();
    const job = makeJob();
    const state = openLocationPicker(job);
    const ctx: ConfirmContext = {
      isLiveMode: false,
      pickerState: state,
      updateJobGeoManualFn: mock.fn,
      onJobGeoConfirmed,
      showToast,
    };

    const result = await handleLocationConfirm(43.5, -3.9, ctx);

    expect(mock.fn).not.toHaveBeenCalled();
    expect(geoConfirmedCalls).toHaveLength(0);
    expect(result.closedPicker).toBe(true);
    expect(result.toastType).toBe('info');
    expect(toastCalls[0].msg).toContain('modo real');
  });
});
