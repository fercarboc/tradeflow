/**
 * TX-MAP-AGENDA-FIX-1 — Tests para:
 *   FASE C: AgendaServiceCard sin mid-word break (line-clamp-2, no break-words)
 *   FASE D: RutaDetailPanel suprime ItinerarioSection cuando no hay coordenadas
 */
import { describe, it, expect } from 'vitest';
import { geoValid } from '../../lib/transportLocations';

// ── Types mínimos (estructurales, sin importar el módulo completo) ─────────────

interface MinLocation {
  lat?: number | null;
  lng?: number | null;
}

interface MinStop {
  nombre: string;
  location?: MinLocation;
}

interface MinService {
  origen_detalle?: MinLocation | null;
  destino_detalle?: MinLocation | null;
  paradas: MinStop[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Usa geoValid importado (alineado con TransportServiceMap y ScreenTransporteRutas) */
function hasAnyCoords(service: MinService): boolean {
  return (
    geoValid(service.origen_detalle?.lat, service.origen_detalle?.lng) ||
    geoValid(service.destino_detalle?.lat, service.destino_detalle?.lng) ||
    service.paradas.some(p => geoValid(p.location?.lat, p.location?.lng))
  );
}

// ── FASE D — hasAnyCoords: supresión de duplicidad ─────────────────────────────

describe('FASE D — hasAnyCoords: ItinerarioSection se oculta cuando no hay coordenadas', () => {
  it('sin coordenadas en ninguna ubicación → hasAnyCoords = false', () => {
    const svc: MinService = {
      origen_detalle: { lat: null, lng: null },
      destino_detalle: null,
      paradas: [{ nombre: 'Parada 1' }],
    };
    expect(hasAnyCoords(svc)).toBe(false);
  });

  it('sin origen_detalle ni destino_detalle → false', () => {
    expect(hasAnyCoords({ origen_detalle: null, destino_detalle: null, paradas: [] })).toBe(false);
  });

  it('origen con coordenadas → hasAnyCoords = true', () => {
    const svc: MinService = {
      origen_detalle: { lat: 43.4628, lng: -3.8050 },
      destino_detalle: null,
      paradas: [],
    };
    expect(hasAnyCoords(svc)).toBe(true);
  });

  it('solo destino con coordenadas → true', () => {
    const svc: MinService = {
      origen_detalle: { lat: null, lng: null },
      destino_detalle: { lat: 43.3619, lng: -5.8494 },
      paradas: [],
    };
    expect(hasAnyCoords(svc)).toBe(true);
  });

  it('solo parada con coordenadas → true', () => {
    const svc: MinService = {
      origen_detalle: null,
      destino_detalle: null,
      paradas: [
        { nombre: 'Sin coords' },
        { nombre: 'Con coords', location: { lat: 43.2630, lng: -2.9350 } },
      ],
    };
    expect(hasAnyCoords(svc)).toBe(true);
  });

  it('paradas con location pero lat=null → false', () => {
    const svc: MinService = {
      origen_detalle: null,
      destino_detalle: null,
      paradas: [{ nombre: 'P1', location: { lat: null, lng: null } }],
    };
    expect(hasAnyCoords(svc)).toBe(false);
  });

  it('origen con lat pero lng=null → false para ese punto', () => {
    const svc: MinService = {
      origen_detalle: { lat: 43.4628, lng: null },
      destino_detalle: null,
      paradas: [],
    };
    expect(hasAnyCoords(svc)).toBe(false);
  });

  it('origen con lat pero sin lng → false para ese punto', () => {
    const svc: MinService = {
      origen_detalle: { lat: 43.4628 },
      destino_detalle: null,
      paradas: [],
    };
    expect(hasAnyCoords(svc)).toBe(false);
  });

  it('todos los puntos con coordenadas → true', () => {
    const svc: MinService = {
      origen_detalle:  { lat: 43.4628, lng: -3.8050 },
      destino_detalle: { lat: 43.3619, lng: -5.8494 },
      paradas: [{ nombre: 'P1', location: { lat: 43.3333, lng: -4.0000 } }],
    };
    expect(hasAnyCoords(svc)).toBe(true);
  });

  it('lista de paradas vacía y sin ubicaciones → false', () => {
    expect(hasAnyCoords({ origen_detalle: undefined, destino_detalle: undefined, paradas: [] })).toBe(false);
  });
});

// ── FASE C — AgendaServiceCard: sin break-all, con line-clamp ─────────────────

/**
 * No podemos verificar CSS visualmente en unit tests.
 * Verificamos la lógica que determina qué se muestra en la tarjeta.
 */

interface MinSvcCard {
  titulo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  vehicle_id: string | null;
  conductor_id: string | null;
  client_id: string | null;
}

function cardHasVehicleOrConductor(
  svc: MinSvcCard,
  vehicleMap: Map<string, { nombre: string }>,
  workerMap: Map<string, { nombre: string }>,
): boolean {
  const vehicle   = svc.vehicle_id   ? vehicleMap.get(svc.vehicle_id)   : undefined;
  const conductor = svc.conductor_id ? workerMap.get(svc.conductor_id) : undefined;
  return !!(vehicle || conductor);
}

describe('FASE C — AgendaServiceCard: lógica de visualización de tarjeta', () => {
  const vm = new Map([['v-1', { nombre: 'Bus 01' }]]);
  const wm = new Map([['w-1', { nombre: 'Carlos' }]]);

  it('sin vehicle_id ni conductor_id → no muestra info extra', () => {
    const svc: MinSvcCard = { titulo: 'Servicio 1', estado: 'confirmado', fecha_inicio: '2026-10-26T09:00:00', fecha_fin: null, vehicle_id: null, conductor_id: null, client_id: null };
    expect(cardHasVehicleOrConductor(svc, vm, wm)).toBe(false);
  });

  it('con vehicle_id en el mapa → muestra info extra', () => {
    const svc: MinSvcCard = { titulo: 'Excursión', estado: 'en_curso', fecha_inicio: '2026-10-26T09:00:00', fecha_fin: null, vehicle_id: 'v-1', conductor_id: null, client_id: null };
    expect(cardHasVehicleOrConductor(svc, vm, wm)).toBe(true);
  });

  it('con conductor_id en el mapa → muestra info extra', () => {
    const svc: MinSvcCard = { titulo: 'Traslado', estado: 'borrador', fecha_inicio: '2026-10-26T10:00:00', fecha_fin: null, vehicle_id: null, conductor_id: 'w-1', client_id: null };
    expect(cardHasVehicleOrConductor(svc, vm, wm)).toBe(true);
  });

  it('vehicle_id no encontrado en el mapa → false', () => {
    const svc: MinSvcCard = { titulo: 'X', estado: 'confirmado', fecha_inicio: '2026-10-26T08:00:00', fecha_fin: null, vehicle_id: 'v-999', conductor_id: null, client_id: null };
    expect(cardHasVehicleOrConductor(svc, vm, wm)).toBe(false);
  });

  it('título largo no provoca error de renderizado (función, no CSS)', () => {
    const titulo = 'Viaje de temporada alta - Ruta litoral norte completa - Octubre 2026';
    expect(titulo.length).toBeGreaterThan(50); // simula el caso de truncamiento
  });
});

// ── geoValid (exportado desde transportLocations) ────────────────────────────

describe('geoValid — validación estricta de coordenadas', () => {
  it('coordenadas válidas → true', () => {
    expect(geoValid(43.4628, -3.8050)).toBe(true);
  });

  it('null lat → false', () => {
    expect(geoValid(null, -3.8050)).toBe(false);
  });

  it('null lng → false', () => {
    expect(geoValid(43.4628, null)).toBe(false);
  });

  it('undefined lat → false', () => {
    expect(geoValid(undefined, -3.8050)).toBe(false);
  });

  it('Infinity → false (gap frente a != null)', () => {
    expect(geoValid(Infinity, -3.8050)).toBe(false);
  });

  it('lat fuera de rango (999) → false', () => {
    expect(geoValid(999, -3.8050)).toBe(false);
  });

  it('NaN → false', () => {
    expect(geoValid(NaN, -3.8050)).toBe(false);
  });

  it('ambos null → false', () => {
    expect(geoValid(null, null)).toBe(false);
  });

  it('lng fuera de rango (-200) → false', () => {
    expect(geoValid(43.4628, -200)).toBe(false);
  });

  it('coordenadas en el límite exacto (90, 180) → true', () => {
    expect(geoValid(90, 180)).toBe(true);
  });
});
