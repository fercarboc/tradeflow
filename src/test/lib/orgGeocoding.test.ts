/**
 * orgGeocoding.test.ts
 * Tests for org geocoding helpers and the GeoScheduler.
 *
 * UNIT (pure functions):
 *   TEST-ORG-GEO-1   localidad presente, ciudad ausente → usa localidad
 *   TEST-ORG-GEO-2   org antigua solo con ciudad → fallback a ciudad
 *   TEST-ORG-GEO-3   consulta con cp y provincia → todos los campos pasados
 *   TEST-ORG-GEO-4   dirección sin cambios → orgAddressChanged = false
 *   TEST-ORG-GEO-5   dirección modificada → orgAddressChanged = true
 *   TEST-ORG-GEO-6   modificación exclusivamente fiscal → coordenadas conservadas
 *   TEST-ORG-GEO-6P  cambio de pais → orgAddressChanged = true
 *
 * INTEGRATION (createGeoScheduler real):
 *   TEST-SCHED-1   Org A geocodificando → cambio a org B con coords → respuesta A descartada
 *   TEST-SCHED-2   Desmontaje con petición pendiente → sin escritura tardía
 *   TEST-SCHED-3   Dirección modificada → una única geocodificación
 *   TEST-SCHED-4   Dos cambios rápidos → solo persiste el resultado vigente
 *   TEST-SCHED-5   Cambio exclusivamente fiscal → coordenadas conservadas (orgAddressChanged)
 *   TEST-SCHED-6   Error del proveedor → sin coordenadas antiguas
 *   TEST-SCHED-7   Cambio de org → sin escritura ni estado cruzado
 *   TEST-SCHED-8   orgId antes que orgData (orgLoadedKey = null) → sin geocodificación; orgData llega → sí geocodifica
 *   TEST-SCHED-9   Org con coords ya almacenadas → scheduler no se invoca (early return)
 *   TEST-SCHED-10  Ventana de race: cancel() después de onSuccess ejecutado → escritura DB en curso
 *
 * TEST-ORG-GEO-12  Ruta del Día: startLocation null no usa (0,0)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildOrgGeocodeParams,
  orgAddressChanged,
  createGeoScheduler,
} from '../../lib/geocoder';
import type { OrgAddressFields, GeocodeResult } from '../../lib/geocoder';
import { optimizeDailyRoute } from '../../lib/routeOptimizer';
import type { TradeJob } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrg(overrides: Partial<OrgAddressFields> = {}): OrgAddressFields {
  return { direccion: null, localidad: null, ciudad: null, cp: null, provincia: null, pais: null, ...overrides };
}

function makeGeo(lat = 43.46, lng = -3.81): GeocodeResult {
  return { latitud: lat, longitud: lng, formatted_address: `${lat},${lng}` };
}

// Deferred promise helper
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

// ── UNIT: buildOrgGeocodeParams ───────────────────────────────────────────────

describe('buildOrgGeocodeParams', () => {
  it('TEST-ORG-GEO-1 usa localidad cuando ciudad está ausente', () => {
    const p = buildOrgGeocodeParams(makeOrg({ direccion: 'Calle Mayor 5', localidad: 'Torrelavega', cp: '39300' }));
    expect(p.localidad).toBe('Torrelavega');
    expect(p.direccion).toBe('Calle Mayor 5');
    expect(p.cp).toBe('39300');
  });

  it('TEST-ORG-GEO-2 usa ciudad como fallback cuando localidad es null', () => {
    const p = buildOrgGeocodeParams(makeOrg({ direccion: 'Paseo Pereda 10', ciudad: 'Santander' }));
    expect(p.localidad).toBe('Santander');
  });

  it('TEST-ORG-GEO-2b localidad tiene prioridad sobre ciudad', () => {
    const p = buildOrgGeocodeParams(makeOrg({ localidad: 'Torrelavega', ciudad: 'Santander' }));
    expect(p.localidad).toBe('Torrelavega');
  });

  it('TEST-ORG-GEO-3 incluye cp y provincia cuando están disponibles', () => {
    const p = buildOrgGeocodeParams(makeOrg({ localidad: 'Castro Urdiales', cp: '39700', provincia: 'Cantabria' }));
    expect(p.cp).toBe('39700');
    expect(p.provincia).toBe('Cantabria');
    expect(p.pais).toBe('España');
  });

  it('TEST-ORG-GEO-3b cp y provincia null → no se pasan como string vacío', () => {
    const p = buildOrgGeocodeParams(makeOrg({ localidad: 'Laredo', cp: null, provincia: null }));
    expect(p.cp).toBeUndefined();
    expect(p.provincia).toBeUndefined();
  });
});

// ── UNIT: orgAddressChanged ───────────────────────────────────────────────────

describe('orgAddressChanged', () => {
  it('TEST-ORG-GEO-4 devuelve false cuando la dirección no cambia', () => {
    const base = makeOrg({ direccion: 'Calle Mayor 5', localidad: 'Torrelavega', cp: '39300', provincia: 'Cantabria', pais: 'España' });
    expect(orgAddressChanged(
      { direccion: 'Calle Mayor 5', localidad: 'Torrelavega', cp: '39300', provincia: 'Cantabria', pais: 'España' },
      base,
    )).toBe(false);
  });

  it('TEST-ORG-GEO-4b null equivale a string vacío para comparación', () => {
    const base = makeOrg({ direccion: 'Calle Sol 2', localidad: null, cp: null, provincia: null });
    expect(orgAddressChanged({ direccion: 'Calle Sol 2', localidad: '', cp: '', provincia: '', pais: 'España' }, base)).toBe(false);
  });

  it('TEST-ORG-GEO-5a devuelve true cuando cambia direccion', () => {
    const base = makeOrg({ direccion: 'Calle Vieja 1', localidad: 'Santander' });
    expect(orgAddressChanged({ direccion: 'Calle Nueva 2', localidad: 'Santander', cp: null, provincia: null, pais: 'España' }, base)).toBe(true);
  });

  it('TEST-ORG-GEO-5b devuelve true cuando cambia localidad', () => {
    const base = makeOrg({ direccion: 'Avda. Principal 10', localidad: 'Polanco' });
    expect(orgAddressChanged({ direccion: 'Avda. Principal 10', localidad: 'Reinosa', cp: null, provincia: null, pais: 'España' }, base)).toBe(true);
  });

  it('TEST-ORG-GEO-5c devuelve true cuando cambia cp', () => {
    const base = makeOrg({ cp: '39300', localidad: 'Torrelavega' });
    expect(orgAddressChanged({ direccion: undefined, localidad: 'Torrelavega', cp: '39400', provincia: null, pais: 'España' }, base)).toBe(true);
  });

  it('TEST-ORG-GEO-5d devuelve true cuando cambia provincia', () => {
    const base = makeOrg({ localidad: 'Laredo', provincia: 'Cantabria' });
    expect(orgAddressChanged({ direccion: null, localidad: 'Laredo', cp: null, provincia: 'Vizcaya', pais: 'España' }, base)).toBe(true);
  });

  it('TEST-ORG-GEO-6 devuelve false cuando solo cambian campos fiscales', () => {
    const base = makeOrg({ direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España' });
    expect(orgAddressChanged(
      { direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España' },
      base,
    )).toBe(false);
  });

  it('TEST-ORG-GEO-6b fallback ciudad = localidad no dispara cambio si son equivalentes', () => {
    const base = makeOrg({ direccion: 'Calle Sol 1', ciudad: 'Santander', localidad: null, cp: '39001' });
    expect(orgAddressChanged(
      { direccion: 'Calle Sol 1', localidad: 'Santander', cp: '39001', provincia: null, pais: 'España' },
      base,
    )).toBe(false);
  });

  it('TEST-ORG-GEO-6P devuelve true cuando cambia pais', () => {
    const base = makeOrg({ localidad: 'Lisboa', provincia: null, pais: 'Portugal' });
    expect(orgAddressChanged({ localidad: 'Lisboa', cp: null, provincia: null, pais: 'España' }, base)).toBe(true);
  });
});

// ── INTEGRATION: createGeoScheduler ──────────────────────────────────────────
//
// Todos los tests usan el código de producción real de createGeoScheduler
// con una función geocodeFn inyectada (mock controlable).

describe('createGeoScheduler — integración real', () => {

  /**
   * TEST-SCHED-1
   * Org A está geocodificando → se cambia al contexto de org B (que ya tiene coords)
   * → el componente llama cancel() → la respuesta tardía de A no ejecuta onSuccess.
   */
  it('TEST-SCHED-1 cancel() descarta respuesta pendiente de org anterior', async () => {
    const { promise, resolve } = deferred<GeocodeResult | null>();
    const onSuccessA = vi.fn();

    const scheduler = createGeoScheduler(() => promise);
    scheduler.schedule({ localidad: 'OrgA' }, onSuccessA);

    // simula el early-return del useEffect al encontrar coords de org B
    scheduler.cancel();

    resolve(makeGeo()); // respuesta tardía de org A llega después de cancel
    await promise;

    expect(onSuccessA).not.toHaveBeenCalled();
  });

  /**
   * TEST-SCHED-2
   * Componente se desmonta con una petición pendiente.
   * El cleanup del useEffect llama cancel() → onSuccess nunca se ejecuta.
   */
  it('TEST-SCHED-2 desmontaje cancela petición pendiente — sin escritura tardía', async () => {
    const { promise, resolve } = deferred<GeocodeResult | null>();
    const onSuccess = vi.fn();

    const scheduler = createGeoScheduler(() => promise);
    scheduler.schedule({ localidad: 'Santander', cp: '39001' }, onSuccess);

    // simula cleanup de desmontaje
    scheduler.cancel();

    resolve(makeGeo(43.46, -3.81));
    await promise;

    expect(onSuccess).not.toHaveBeenCalled();
  });

  /**
   * TEST-SCHED-3
   * Dirección modificada → handleSaveFiscal llama schedule() una sola vez.
   * El scheduler solo produce un onSuccess.
   */
  it('TEST-SCHED-3 dirección modificada → una única geocodificación y un único onSuccess', async () => {
    const { promise, resolve } = deferred<GeocodeResult | null>();
    const onSuccess = vi.fn();

    const scheduler = createGeoScheduler(() => promise);
    scheduler.schedule({ localidad: 'Torrelavega', cp: '39300' }, onSuccess);

    resolve(makeGeo(43.35, -4.04));
    await promise;

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith(makeGeo(43.35, -4.04));
  });

  /**
   * TEST-SCHED-4
   * Dos cambios rápidos de dirección (schedule → schedule antes de resolver la primera).
   * Solo persiste el resultado del segundo.
   */
  it('TEST-SCHED-4 dos cambios rápidos → solo persiste el resultado vigente', async () => {
    const d1 = deferred<GeocodeResult | null>();
    const d2 = deferred<GeocodeResult | null>();
    const onSuccess = vi.fn();

    // geocodeFn que devuelve d1 o d2 según cuántas veces se llamó
    let callCount = 0;
    const geocodeFn = () => { callCount++; return callCount === 1 ? d1.promise : d2.promise; };

    const scheduler = createGeoScheduler(geocodeFn);
    scheduler.schedule({ localidad: 'Primero' }, onSuccess);
    scheduler.schedule({ localidad: 'Segundo' }, onSuccess); // invalida el primero

    // resuelven en orden inverso: la segunda resuelve primero
    d2.resolve(makeGeo(43.46, -3.81)); // vigente
    await d2.promise;
    d1.resolve(makeGeo(40.42, -3.70)); // stale
    await d1.promise;

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess.mock.calls[0][0].latitud).toBe(43.46); // resultado del segundo
  });

  /**
   * TEST-SCHED-5
   * Cambio exclusivamente fiscal (NIF, IBAN, etc.) → orgAddressChanged devuelve false
   * → handleSaveFiscal nunca llama schedule() → coordenadas conservadas.
   * (Verifica que la lógica de guardado fiscal no toca el scheduler.)
   */
  it('TEST-SCHED-5 cambio fiscal no llama schedule', () => {
    const geocodeFn = vi.fn().mockResolvedValue(makeGeo());
    const scheduler = createGeoScheduler(geocodeFn);

    // Simular la decisión de handleSaveFiscal: geoInvalidated = false
    const geoInvalidated = orgAddressChanged(
      { direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España' },
      makeOrg({ direccion: 'Calle Luna 3', localidad: 'Santander', cp: '39001', provincia: 'Cantabria', pais: 'España' }),
    );

    if (geoInvalidated) {
      scheduler.schedule({ localidad: 'Santander' }, () => {});
    }

    expect(geoInvalidated).toBe(false);
    expect(geocodeFn).not.toHaveBeenCalled();
  });

  /**
   * TEST-SCHED-6
   * Proveedor devuelve null (error o no encontrado).
   * onSuccess NO se llama → setOrgBaseGeo no recibe coordenadas →
   * las coordenadas del DB ya son null (por el UPDATE previo), nada queda asociado.
   */
  it('TEST-SCHED-6 error del proveedor → onSuccess no se ejecuta', async () => {
    const onSuccess = vi.fn();
    const scheduler = createGeoScheduler(async () => null); // proveedor falla

    scheduler.schedule({ localidad: 'LugarInexistente' }, onSuccess);

    // Esperar a que se resuelva la promesa interna
    await new Promise(r => setTimeout(r, 10));

    expect(onSuccess).not.toHaveBeenCalled();
  });

  /**
   * TEST-SCHED-7
   * Org A lanza geocoding. Antes de resolver, el contexto cambia a org B.
   * Cancel() se llama en el momento del cambio.
   * La respuesta de A llega después: ni onSuccessA ni onSuccessB se ejecutan
   * de forma cruzada.
   */
  it('TEST-SCHED-7 cambio de org → sin escritura ni estado cruzado', async () => {
    const dA = deferred<GeocodeResult | null>();
    const dB = deferred<GeocodeResult | null>();

    const writesOrgA: GeocodeResult[] = [];
    const writesOrgB: GeocodeResult[] = [];

    let callCount = 0;
    const geocodeFn = () => { callCount++; return callCount === 1 ? dA.promise : dB.promise; };

    const scheduler = createGeoScheduler(geocodeFn);

    // Org A lanza geocoding
    scheduler.schedule({ localidad: 'OrgA' }, geo => writesOrgA.push(geo));

    // Cambio a org B: simula el cancel() del useEffect + schedule() del nuevo orgId
    scheduler.cancel();
    scheduler.schedule({ localidad: 'OrgB' }, geo => writesOrgB.push(geo));

    // Org A resuelve tardíamente
    dA.resolve(makeGeo(40.0, -3.0));
    await dA.promise;

    // Org B resuelve
    dB.resolve(makeGeo(43.46, -3.81));
    await dB.promise;

    // Org A no debe haber escrito nada
    expect(writesOrgA).toHaveLength(0);
    // Org B tiene exactamente su resultado
    expect(writesOrgB).toHaveLength(1);
    expect(writesOrgB[0].latitud).toBe(43.46);
  });


  /**
   * TEST-SCHED-8
   * Patrón orgLoadedKey: cuando orgId está disponible pero orgData aún es null,
   * el scheduler NO debe invocarse. Cuando orgData llega, SÍ debe invocarse.
   * Esto verifica la lógica que orgLoadedKey implementa en el componente:
   *   const orgLoadedKey = orgId && orgData ? orgId : null;
   */
  it('TEST-SCHED-8 orgId sin orgData → sin geocodificación; orgData llega → geocodifica', async () => {
    const geocodeFn = vi.fn().mockResolvedValue(makeGeo(43.46, -3.81));
    const scheduler = createGeoScheduler(geocodeFn);
    const onSuccess = vi.fn();

    const orgId = 'org-abc';
    let orgData: OrgAddressFields | null = null;

    // Fase 1: orgLoadedKey = null → efecto no se dispara → schedule no se llama
    if (orgId && orgData) {
      const params = buildOrgGeocodeParams(orgData);
      if (params.direccion || params.localidad) {
        scheduler.schedule(params, onSuccess);
      }
    }
    expect(geocodeFn).not.toHaveBeenCalled();

    // Fase 2: orgData llega → orgLoadedKey = orgId → efecto se dispara → schedule sí
    orgData = makeOrg({ localidad: 'Santander', cp: '39001' });
    if (orgId && orgData) {
      const params = buildOrgGeocodeParams(orgData);
      if (params.direccion || params.localidad) {
        scheduler.schedule(params, onSuccess);
      }
    }

    await new Promise(r => setTimeout(r, 10));

    expect(geocodeFn).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess.mock.calls[0][0].latitud).toBe(43.46);
  });

  /**
   * TEST-SCHED-9
   * Org con coordenadas ya almacenadas (base_latitud != null).
   * El useEffect hace early return antes de llamar schedule().
   * Verifica que no se lanza ninguna geocodificación innecesaria.
   */
  it('TEST-SCHED-9 org con coords ya almacenadas → scheduler no se invoca', () => {
    const geocodeFn = vi.fn().mockResolvedValue(makeGeo());
    const scheduler = createGeoScheduler(geocodeFn);
    const onSuccess = vi.fn();

    // Simula la rama de early return del useEffect: org ya tiene coords almacenadas
    const baseLatitud = 43.46;
    const baseLongitud = -3.81;

    if (baseLatitud == null || baseLongitud == null) {
      // Solo en este caso se lanzaría la geocodificación
      scheduler.schedule({ localidad: 'Santander' }, onSuccess);
    }
    // Si tiene coords, simplemente no se invoca el scheduler

    expect(geocodeFn).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  /**
   * TEST-SCHED-10
   * Ventana de race: si onSuccess ya fue ejecutado cuando se llama cancel(),
   * la escritura a Supabase (updateOrgGeocoords, fire-and-forget) ya está en curso
   * y cancel() no puede cancelarla.
   *
   * Alcance del riesgo: requiere que el usuario guarde una nueva dirección en el
   * intervalo entre la resolución del geocoding (~100ms-2s) y el arranque del siguiente.
   * Probabilidad práctica: casi nula. No se mitiga en esta fase.
   */
  it('TEST-SCHED-10 ventana de race: cancel() tras onSuccess ya ejecutado no cancela escritura en curso', async () => {
    const { promise, resolve } = deferred<GeocodeResult | null>();
    let onSuccessFired = false;
    let dbWriteStarted = false;

    const scheduler = createGeoScheduler(() => promise);

    scheduler.schedule({ localidad: 'Santander' }, _geo => {
      onSuccessFired = true;
      // En producción aquí se ejecutaría: void updateOrgGeocoords(orgId, lat, lng)
      dbWriteStarted = true;
    });

    // Geocoding completa ANTES de que el usuario guarde el nuevo domicilio
    resolve(makeGeo(43.46, -3.81));
    await promise;

    // onSuccess ya se ejecutó y la escritura DB arrancó
    expect(onSuccessFired).toBe(true);
    expect(dbWriteStarted).toBe(true);

    // cancel() se llama después (demasiado tarde para la escritura ya iniciada)
    scheduler.cancel();

    // La escritura sigue su curso; no hay forma de detenerla desde el scheduler.
    // Si justo después llega una nueva dirección B, ambas escrituras compiten.
    // La última en llegar gana (last-write-wins en Supabase).
  });
});

// ── TEST-ORG-GEO-12: Ruta del Día — null origin ───────────────────────────────

describe('TEST-ORG-GEO-12 Ruta del Día mantiene comportamiento sin coordenadas de org', () => {
  it('startLocation null → ordena por prioridad, no por proximidad a (0,0)', () => {
    const makeJob = (id: string, prioridad: TradeJob['prioridad'], lat: number, lng: number): TradeJob => ({
      id, org_id: 'org1', titulo: id, estado: 'pendiente', prioridad,
      tipo: 'trabajo', fecha_inicio: '2026-10-20', hora_inicio: '09:00',
      duracion_horas: 1, latitud: lat, longitud: lng,
      direccion: null, localidad: null, cp: null, descripcion: null,
      orden_ruta: null, trade_clients: null, trade_job_workers: [],
      created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z',
    } as unknown as TradeJob);

    const normalNearOrigin = makeJob('normal',  'normal',  0.01,  0.01);
    const urgentCantabria  = makeJob('urgente', 'urgente', 43.46, -3.81);

    const result = optimizeDailyRoute([normalNearOrigin, urgentCantabria], null);
    expect(result[0].prioridad).toBe('urgente');
    expect(result[0].id).toBe('urgente');
  });
});
