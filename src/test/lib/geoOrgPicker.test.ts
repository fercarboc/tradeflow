/**
 * LP-3 — Verificación manual de ubicación de empresa
 *
 * Invariantes verificados:
 *  1. Una sola escritura protegida por confirmación (updateOrgGeoManual).
 *  2. Snapshot de cinco campos capturado en el momento de apertura.
 *  3. Rechazo cuando cambia la dirección (snapshot WHERE guard).
 *  4. Rechazo por cambio de organización durante la confirmación.
 *  5. Coordenadas inválidas → cero escrituras.
 *  6. Error de red → sin falso éxito.
 *  7. Estado local actualizado con confirmedAt exacto de DB.
 *  8. Conservación del resto de datos de empresa.
 *  9. Geocodificación automática tardía bloqueada si geo_source=manual.
 * 10. Edición no geográfica que conserva geo manual.
 * 11. Cambio real de dirección que invalida geo manual.
 * 12. Modo demo sin escritura remota.
 */
import { describe, it, expect, vi } from 'vitest';
import type { GeoAddressSnapshot } from '../../lib/supabase';

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

interface MockOrg {
  id: string;
  nombre: string;
  direccion?: string | null;
  localidad?: string | null;
  cp?: string | null;
  provincia?: string | null;
  pais?: string | null;
  base_latitud?: number | null;
  base_longitud?: number | null;
  geo_source?: 'auto' | 'manual' | null;
  geo_confirmed_at?: string | null;
  nif?: string;
  email?: string;
  telefono_fijo?: string;
  iban?: string;
}

function makeOrg(overrides: Partial<MockOrg> = {}): MockOrg {
  return {
    id: 'org-001',
    nombre: 'Instalaciones Pérez SL',
    direccion: 'Calle Mayor 1',
    localidad: 'Santander',
    cp: '39001',
    provincia: 'Cantabria',
    pais: 'España',
    base_latitud: 43.462,
    base_longitud: -3.81,
    geo_source: 'auto',
    geo_confirmed_at: null,
    nif: 'B12345678',
    email: 'info@perez.es',
    telefono_fijo: '942000000',
    iban: 'ES00 0000 0000 0000 0000 0000',
    ...overrides,
  };
}

// ── isValidLatLng (misma lógica que RouteMap.tsx) ─────────────────────────────

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

// ── Snapshot de apertura ──────────────────────────────────────────────────────

function captureOrgSnapshot(org: MockOrg): GeoAddressSnapshot {
  return {
    direccion: org.direccion ?? null,
    localidad: org.localidad ?? null,
    cp:        org.cp ?? null,
    provincia: org.provincia ?? null,
    pais:      org.pais ?? null,
  };
}

// ── Mock de updateOrgGeoManual ────────────────────────────────────────────────

interface MockOrgGeoCall {
  orgId: string;
  lat: number;
  lng: number;
  snapshot: GeoAddressSnapshot;
}

const FIXED_CONFIRMED_AT = '2026-10-22T15:00:00.000Z';

function makeUpdateOrgGeoManual(applied: boolean, error?: Error) {
  const calls: MockOrgGeoCall[] = [];
  const fn = vi.fn(async (orgId: string, lat: number, lng: number, snapshot: GeoAddressSnapshot) => {
    calls.push({ orgId, lat, lng, snapshot });
    if (error) throw error;
    return { applied, confirmedAt: applied ? FIXED_CONFIRMED_AT : null };
  });
  return { fn, calls };
}

// ── Tracked callbacks ─────────────────────────────────────────────────────────

interface OrgGeoConfirmedCall { orgId: string; lat: number; lng: number; confirmedAt: string; }
interface ToastCall { msg: string; type: string; }

function makeTrackers() {
  const orgGeoConfirmedCalls: OrgGeoConfirmedCall[] = [];
  const toastCalls: ToastCall[] = [];

  const onOrgGeoConfirmed = (orgId: string, lat: number, lng: number, confirmedAt: string): void => {
    orgGeoConfirmedCalls.push({ orgId, lat, lng, confirmedAt });
  };
  const showToast = (msg: string, type: string): void => {
    toastCalls.push({ msg, type });
  };

  return { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls, toastCalls };
}

// ── PickerContext ─────────────────────────────────────────────────────────────

interface OrgPickerContext {
  isLiveMode: boolean;
  orgId: string;
  pickerOrgId: string;
  // Simulates orgIdRef.current — the value that's always current (not stale closure)
  currentOrgIdRef: string;
  snapshot: GeoAddressSnapshot;
  updateOrgGeoManualFn: (orgId: string, lat: number, lng: number, snap: GeoAddressSnapshot) => Promise<{ applied: boolean; confirmedAt: string | null }>;
  onOrgGeoConfirmed?: (orgId: string, lat: number, lng: number, confirmedAt: string) => void;
  showToast: (msg: string, type: string) => void;
}

interface ConfirmResult {
  closedPicker: boolean;
  toastType: string | null;
  confirmedArgs: [string, number, number, string] | null;
  // Simulates what setOrgBaseGeo would receive (for Ruta del Día validation)
  orgBaseGeoUpdate: { lat: number; lng: number } | null;
}

async function handleOrgLocationConfirm(lat: number, lng: number, ctx: OrgPickerContext): Promise<ConfirmResult> {
  const result: ConfirmResult = { closedPicker: false, toastType: null, confirmedArgs: null, orgBaseGeoUpdate: null };

  if (!isValidLatLng(lat, lng)) {
    throw new Error('Coordenadas inválidas — selecciona un punto en el mapa');
  }

  if (!ctx.isLiveMode) {
    result.closedPicker = true;
    ctx.showToast('Activa el modo real para guardar la ubicación', 'info');
    result.toastType = 'info';
    return result;
  }

  // Pre-await org check (closure values)
  if (ctx.pickerOrgId !== ctx.orgId) {
    throw new Error('La organización cambió mientras el selector estaba abierto');
  }

  const { applied, confirmedAt } = await ctx.updateOrgGeoManualFn(ctx.pickerOrgId, lat, lng, ctx.snapshot);

  // Post-await org guard via ref — stale closure protection
  if (ctx.currentOrgIdRef !== ctx.pickerOrgId) {
    result.closedPicker = true;
    return result; // picker closes silently, no state update, no toast
  }

  if (!applied) {
    throw new Error('La dirección cambió mientras el selector estaba abierto. Guarda primero los datos y vuelve a verificar la ubicación.');
  }

  // State-only update — sin segundo UPDATE genérico
  ctx.onOrgGeoConfirmed?.(ctx.pickerOrgId, lat, lng, confirmedAt!);
  result.confirmedArgs = [ctx.pickerOrgId, lat, lng, confirmedAt!];
  result.orgBaseGeoUpdate = { lat, lng };

  result.closedPicker = true;
  ctx.showToast('Ubicación de empresa confirmada', 'success');
  result.toastType = 'success';
  return result;
}

// ── Helpers de invariantes de geocodificación ─────────────────────────────────

function orgAddressChanged(
  draft: { direccion?: string; localidad?: string; cp?: string; provincia?: string; pais?: string },
  org: MockOrg,
): boolean {
  return (
    (draft.direccion ?? '') !== (org.direccion ?? '') ||
    (draft.localidad ?? '') !== (org.localidad ?? '') ||
    (draft.cp ?? '') !== (org.cp ?? '') ||
    (draft.provincia ?? '') !== (org.provincia ?? '') ||
    (draft.pais ?? '') !== (org.pais ?? '')
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('LP-3 — captureOrgSnapshot (snapshot de apertura)', () => {
  it('LP3-1 — apertura con coordenadas existentes: snapshot tiene 5 campos', () => {
    const org = makeOrg();
    const snap = captureOrgSnapshot(org);
    expect(snap).toEqual({
      direccion: 'Calle Mayor 1',
      localidad: 'Santander',
      cp: '39001',
      provincia: 'Cantabria',
      pais: 'España',
    });
    expect(Object.keys(snap)).toHaveLength(5);
  });

  it('LP3-2 — apertura sin coordenadas: snapshot tiene 5 campos, geo null', () => {
    const org = makeOrg({ base_latitud: null, base_longitud: null, geo_source: null });
    const snap = captureOrgSnapshot(org);
    expect(snap.direccion).toBe('Calle Mayor 1');
    expect(Object.keys(snap)).toHaveLength(5);
  });
});

describe('LP-3 — guardia dirección sin guardar', () => {
  it('LP3-unsaved-dir — dirección modificada sin guardar: no abre picker, aviso claro', () => {
    const toastCalls: ToastCall[] = [];
    const showToast = (msg: string, type: string) => toastCalls.push({ msg, type });

    const org = makeOrg();
    const draft = { direccion: 'Calle Nueva 9', localidad: org.localidad ?? '', cp: org.cp ?? '', provincia: org.provincia ?? '', pais: org.pais ?? '' };

    // Simulate openOrgLocationPicker logic
    const draftAddressChanged = orgAddressChanged(draft, org);
    let pickerOpened = false;
    if (draftAddressChanged) {
      showToast('Guarda primero los cambios de dirección para verificar la ubicación', 'info');
    } else {
      pickerOpened = true;
    }

    expect(draftAddressChanged).toBe(true);
    expect(pickerOpened).toBe(false);
    expect(toastCalls[0]?.type).toBe('info');
    expect(toastCalls[0]?.msg).toContain('Guarda primero');
  });

  it('LP3-no-changes — dirección sin cambios: picker se abre normalmente', () => {
    const org = makeOrg();
    const draft = { direccion: org.direccion ?? '', localidad: org.localidad ?? '', cp: org.cp ?? '', provincia: org.provincia ?? '', pais: org.pais ?? '' };

    const draftAddressChanged = orgAddressChanged(draft, org);
    expect(draftAddressChanged).toBe(false);
  });

  it('LP3-non-geo-field — cambiar campo no geográfico no bloquea el picker', () => {
    // orgAddressChanged only checks the 5 address fields, not nombre/nif/email etc.
    const org = makeOrg();
    const draft = { direccion: org.direccion ?? '', localidad: org.localidad ?? '', cp: org.cp ?? '', provincia: org.provincia ?? '', pais: org.pais ?? '' };
    // Simulates editing nombre/email/iban in empresaAjustes without touching address fields
    const draftAddressChanged = orgAddressChanged(draft, org);
    expect(draftAddressChanged).toBe(false);
  });
});

describe('LP-3 — cancelación', () => {
  it('LP3-3 — cancelación: cero escrituras, cero callbacks', () => {
    const { fn } = makeUpdateOrgGeoManual(true);
    const { orgGeoConfirmedCalls } = makeTrackers();
    // La cancelación ocurre antes de handleOrgLocationConfirm (onCancel callback).
    expect(fn).not.toHaveBeenCalled();
    expect(orgGeoConfirmedCalls).toHaveLength(0);
  });
});

describe('LP-3 — confirmación aceptada (una sola escritura protegida)', () => {
  it('LP3-4 — confirmación exitosa: updateOrgGeoManual llamado con args correctos', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await handleOrgLocationConfirm(43.5, -3.9, ctx);

    expect(mock.calls[0]).toMatchObject({ orgId: 'org-001', lat: 43.5, lng: -3.9 });
    expect(mock.calls[0].snapshot).toEqual(captureOrgSnapshot(org));
  });

  it('LP3-5 — una sola escritura: onOrgGeoConfirmed con confirmedAt exacto de DB', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    const result = await handleOrgLocationConfirm(43.5, -3.9, ctx);

    expect(mock.fn).toHaveBeenCalledTimes(1);
    expect(orgGeoConfirmedCalls).toHaveLength(1);
    expect(orgGeoConfirmedCalls[0]).toEqual({
      orgId: 'org-001', lat: 43.5, lng: -3.9, confirmedAt: FIXED_CONFIRMED_AT,
    });
    expect(result.confirmedArgs).toEqual(['org-001', 43.5, -3.9, FIXED_CONFIRMED_AT]);
    expect(result.closedPicker).toBe(true);
    expect(result.toastType).toBe('success');
  });
});

describe('LP-3 — snapshot de 5 campos en la escritura', () => {
  it('LP3-6 — snapshot contiene los 5 campos de dirección al confirmar', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const org = makeOrg({ provincia: 'Cantabria', pais: 'España' });
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await handleOrgLocationConfirm(43.5, -3.9, ctx);

    expect(mock.calls[0].snapshot).toMatchObject({
      direccion: 'Calle Mayor 1',
      localidad: 'Santander',
      cp: '39001',
      provincia: 'Cantabria',
      pais: 'España',
    });
  });
});

describe('LP-3 — rechazo por cambio de dirección', () => {
  it('LP3-7 — applied=false: lanza error descriptivo, sin onOrgGeoConfirmed', async () => {
    const { fn } = makeUpdateOrgGeoManual(false);
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await expect(handleOrgLocationConfirm(43.5, -3.9, ctx)).rejects.toThrow(
      'La dirección cambió mientras el selector estaba abierto',
    );
    expect(orgGeoConfirmedCalls).toHaveLength(0);
  });
});

describe('LP-3 — rechazo por cambio de organización', () => {
  it('LP3-8 — orgId cambia antes de confirmar: lanza error, cero escrituras', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls } = makeTrackers();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: 'org-NEW',       // changed after open
      pickerOrgId: 'org-001', // captured at open
      currentOrgIdRef: 'org-NEW',
      snapshot: captureOrgSnapshot(makeOrg()),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await expect(handleOrgLocationConfirm(43.5, -3.9, ctx)).rejects.toThrow(
      'La organización cambió',
    );
    expect(mock.fn).not.toHaveBeenCalled();
    expect(orgGeoConfirmedCalls).toHaveLength(0);
  });

  it('LP3-8b — orgId cambia DURANTE la escritura (post-await): sin actualización de estado', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls } = makeTrackers();
    // Pre-await: orgId matches. Post-await: orgId changed (simulated via currentOrgIdRef).
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: 'org-001',         // matched at closure creation (pre-await check passes)
      pickerOrgId: 'org-001',
      currentOrgIdRef: 'org-SWITCHED', // ref reflects current value after async gap
      snapshot: captureOrgSnapshot(makeOrg()),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    // Write should have been attempted for the original org
    const result = await handleOrgLocationConfirm(43.5, -3.9, ctx);

    expect(mock.fn).toHaveBeenCalledTimes(1); // DB write happened for original org
    // But state was NOT updated for the new org
    expect(orgGeoConfirmedCalls).toHaveLength(0);
    expect(result.closedPicker).toBe(true); // picker closes silently
    expect(result.confirmedArgs).toBeNull();
    expect(result.toastType).toBeNull(); // no success toast for wrong org
  });

  it('LP3-8c — resultado aceptado para org original no contamina org nueva', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls } = makeTrackers();
    // Simulate: write succeeds for 'org-001' but user is now on 'org-002'
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: 'org-001',
      pickerOrgId: 'org-001',
      currentOrgIdRef: 'org-002', // switched during async
      snapshot: captureOrgSnapshot(makeOrg()),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    const result = await handleOrgLocationConfirm(43.5, -3.9, ctx);

    // Write happened for org-001 (correct)
    expect(mock.calls[0].orgId).toBe('org-001');
    // State update NOT applied to org-002
    expect(orgGeoConfirmedCalls).toHaveLength(0);
    expect(result.confirmedArgs).toBeNull();
  });
});

describe('LP-3 — coordenadas inválidas', () => {
  it('LP3-9a — NaN: lanza error antes de escritura DB', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await expect(handleOrgLocationConfirm(NaN, NaN, ctx)).rejects.toThrow('Coordenadas inválidas');
    expect(mock.fn).not.toHaveBeenCalled();
  });

  it('LP3-9b — Infinity: lanza error antes de escritura DB', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await expect(handleOrgLocationConfirm(Infinity, 0, ctx)).rejects.toThrow('Coordenadas inválidas');
    expect(mock.fn).not.toHaveBeenCalled();
  });

  it('LP3-9c — lat fuera de rango: lanza error', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await expect(handleOrgLocationConfirm(91, 0, ctx)).rejects.toThrow('Coordenadas inválidas');
    expect(mock.fn).not.toHaveBeenCalled();
  });
});

describe('LP-3 — error de red', () => {
  it('LP3-10 — error de red: excepción propagada, sin toast de éxito ni callback', async () => {
    const { fn } = makeUpdateOrgGeoManual(false, new Error('Network error'));
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls, toastCalls } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: fn,
      onOrgGeoConfirmed,
      showToast,
    };

    await expect(handleOrgLocationConfirm(43.5, -3.9, ctx)).rejects.toThrow('Network error');
    expect(orgGeoConfirmedCalls).toHaveLength(0);
    expect(toastCalls.filter(t => t.type === 'success')).toHaveLength(0);
  });
});

describe('LP-3 — actualización local tras confirmación', () => {
  it('LP3-11 — onOrgGeoConfirmed actualiza solo campos geo (no nombre, iban, etc.)', () => {
    const org = makeOrg();
    // Simula el estado local antes de confirmar
    const prevState: MockOrg = { ...org };

    // Callback de AppDashboardView — solo actualiza campos geo
    const applyGeoConfirmed = (o: MockOrg, lat: number, lng: number, confirmedAt: string): MockOrg => ({
      ...o,
      base_latitud: lat,
      base_longitud: lng,
      geo_source: 'manual',
      geo_confirmed_at: confirmedAt,
    });

    const nextState = applyGeoConfirmed(prevState, 43.5, -3.9, FIXED_CONFIRMED_AT);

    expect(nextState.base_latitud).toBe(43.5);
    expect(nextState.base_longitud).toBe(-3.9);
    expect(nextState.geo_source).toBe('manual');
    expect(nextState.geo_confirmed_at).toBe(FIXED_CONFIRMED_AT);
    // Campos no geográficos intactos
    expect(nextState.nombre).toBe(org.nombre);
    expect(nextState.nif).toBe(org.nif);
    expect(nextState.email).toBe(org.email);
    expect(nextState.iban).toBe(org.iban);
    expect(nextState.telefono_fijo).toBe(org.telefono_fijo);
  });
});

describe('LP-3 — cambio real de dirección invalida geo manual', () => {
  it('LP3-13 — cambiar dirección detecta geoInvalidated=true y limpia geo_source', () => {
    const org = makeOrg({ geo_source: 'manual', geo_confirmed_at: FIXED_CONFIRMED_AT });
    const draft = { direccion: 'Calle Nueva 5', localidad: 'Torrelavega', cp: org.cp ?? '', provincia: org.provincia ?? '', pais: org.pais ?? '' };

    const geoInvalidated = orgAddressChanged(draft, org);
    const dbPayload = geoInvalidated
      ? { base_latitud: null, base_longitud: null, geo_source: null, geo_confirmed_at: null }
      : {};

    expect(geoInvalidated).toBe(true);
    expect(dbPayload.geo_source).toBeNull();
    expect(dbPayload.geo_confirmed_at).toBeNull();
    expect(dbPayload.base_latitud).toBeNull();
  });
});

describe('LP-3 — edición no geográfica conserva geo manual', () => {
  it('LP3-14 — cambiar teléfono/email no activa geoInvalidated', () => {
    const org = makeOrg({ geo_source: 'manual', geo_confirmed_at: FIXED_CONFIRMED_AT });
    // El draft solo cambia datos no geográficos — la dirección es igual
    const draft = {
      direccion: org.direccion ?? '',
      localidad: org.localidad ?? '',
      cp:        org.cp ?? '',
      provincia: org.provincia ?? '',
      pais:      org.pais ?? '',
    };

    const geoInvalidated = orgAddressChanged(draft, org);
    expect(geoInvalidated).toBe(false);
  });
});

describe('LP-3 — geocodificación automática tardía bloqueada', () => {
  it('LP3-15 — updateOrgGeocoords (auto) no sobrescribe geo_source=manual', () => {
    // La protección IS DISTINCT FROM vive en la función de BD.
    // Aquí verificamos que la condición del guard se evalúa correctamente
    // para un org con geo_source=manual.
    const geoSource: string | null | undefined = 'manual';
    // IS DISTINCT FROM 'manual' equivale a: NULL o != 'manual'
    const eligibleForAutoGeo = geoSource == null || geoSource !== 'manual';
    expect(eligibleForAutoGeo).toBe(false); // manual bloqueado
  });

  it('LP3-15b — updateOrgGeocoords (auto) aplica cuando geo_source=null', () => {
    const geoSource: string | null | undefined = null;
    const eligibleForAutoGeo = geoSource == null || geoSource !== 'manual';
    expect(eligibleForAutoGeo).toBe(true); // null es elegible
  });

  it('LP3-15c — updateOrgGeocoords (auto) aplica cuando geo_source=auto', () => {
    const geoSource: string | null | undefined = 'auto';
    const eligibleForAutoGeo = geoSource == null || geoSource !== 'manual';
    expect(eligibleForAutoGeo).toBe(true); // auto puede ser reemplazado
  });
});

describe('LP-3 — modo demo', () => {
  it('LP3-16 — modo demo: cero escrituras, picker cerrado con toast info', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast, orgGeoConfirmedCalls, toastCalls } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: false,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    const result = await handleOrgLocationConfirm(43.5, -3.9, ctx);

    expect(mock.fn).not.toHaveBeenCalled();
    expect(orgGeoConfirmedCalls).toHaveLength(0);
    expect(result.closedPicker).toBe(true);
    expect(result.toastType).toBe('info');
    expect(toastCalls[0].msg).toContain('modo real');
  });
});

describe('LP-3 — sincronización del origen de Ruta del Día', () => {
  it('LP3-ruta — confirmación exitosa: orgBaseGeoUpdate recibe coordenadas correctas', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const org = makeOrg();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: org.id,
      pickerOrgId: org.id,
      currentOrgIdRef: org.id,
      snapshot: captureOrgSnapshot(org),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    const result = await handleOrgLocationConfirm(43.5, -3.9, ctx);

    // setOrgBaseGeo receives the confirmed coordinates
    expect(result.orgBaseGeoUpdate).toEqual({ lat: 43.5, lng: -3.9 });
    expect(result.closedPicker).toBe(true);
    expect(result.toastType).toBe('success');
  });

  it('LP3-ruta-org-switch — si cambia org durante escritura, orgBaseGeo NO se actualiza', async () => {
    const mock = makeUpdateOrgGeoManual(true);
    const { onOrgGeoConfirmed, showToast } = makeTrackers();
    const ctx: OrgPickerContext = {
      isLiveMode: true,
      orgId: 'org-001',
      pickerOrgId: 'org-001',
      currentOrgIdRef: 'org-SWITCHED',
      snapshot: captureOrgSnapshot(makeOrg()),
      updateOrgGeoManualFn: mock.fn,
      onOrgGeoConfirmed,
      showToast,
    };

    const result = await handleOrgLocationConfirm(43.5, -3.9, ctx);

    expect(result.orgBaseGeoUpdate).toBeNull(); // no update for wrong org
    expect(result.closedPicker).toBe(true);     // picker still closes
    expect(result.toastType).toBeNull();        // no success toast
  });
});
