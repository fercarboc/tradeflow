import { describe, it, expect } from 'vitest';
import { buildTripStops, sumTripLoad } from '../../components/transport-shipments/TripShipmentsPanel';
import { tripDateRange } from '../../components/ScreenTransporteViajes';
import {
  shipmentInvoiceConcept, serviceInvoiceConcept, BILLING_LINK_COLUMN, normNif,
} from '../../lib/transportBilling';
import { validateShipment, emptyShipmentInput, hasDeliveryProof, type TradeTransportShipment } from '../../lib/transportShipments';
import type { TradeTransportService } from '../../lib/transportServices';

function sh(p: Partial<TradeTransportShipment>): TradeTransportShipment {
  return {
    id: 'x', org_id: 'o', referencia: 'EXP-2026-0001', trip_id: 't', client_id: null,
    cargador_nombre: 'Cargas Norte SL', cargador_nif: 'B12345678', cargador_domicilio: null,
    destinatario_nombre: null, destinatario_telefono: null,
    origen: 'Santander', destino: 'Bilbao', fecha_recogida: '2026-11-20', hora_recogida: null,
    naturaleza: 'Palés de bebidas', tipo_carga: 'paletizado', peso_kg: 1000, num_bultos: 4, volumen_m3: 2.5,
    referencia_cargador: null, estado: 'pendiente', recogida_at: null, entregada_at: null,
    receptor_nombre: null, incidencia: null, observaciones: null, created_at: '', updated_at: '',
    ...p,
  } as TradeTransportShipment;
}

describe('TX-CIERRE-1 · paradas y carga del viaje', () => {
  it('ordena recogidas antes que entregas y agrupa por lugar', () => {
    const stops = buildTripStops([
      sh({ id: 'a', referencia: 'A', origen: 'Santander', destino: 'Bilbao' }),
      sh({ id: 'b', referencia: 'B', origen: 'santander ', destino: 'Vitoria', estado: 'recogida' }),
      sh({ id: 'c', referencia: 'C', origen: 'Torrelavega', destino: 'Bilbao', estado: 'cancelada' }),
    ]);
    expect(stops.map(s => `${s.tipo}:${s.lugar.trim()}`)).toEqual(['recogida:Santander', 'entrega:Bilbao', 'entrega:Vitoria']);
    expect(stops[0].referencias).toEqual(['A', 'B']);
    expect(stops[0].hecho).toBe(false);
  });

  it('suma la carga sin las expediciones canceladas', () => {
    const c = sumTripLoad([sh({ peso_kg: 1000, num_bultos: 4 }), sh({ peso_kg: 500, num_bultos: 2, volumen_m3: 1 }), sh({ estado: 'cancelada', peso_kg: 9999 })]);
    expect(c).toEqual({ peso_kg: 1500, num_bultos: 6, volumen_m3: 3.5, n: 2 });
  });
});

describe('TX-CIERRE-1 · filtros de viajes', () => {
  const now = new Date('2026-11-13T15:00:00');
  it('«todos» no filtra', () => expect(tripDateRange('todos', now)).toEqual({}));
  it('«hoy» va de las 00:00 a las 00:00 del día siguiente', () => {
    const r = tripDateRange('hoy', now);
    expect(new Date(r.hasta!).getTime() - new Date(r.desde!).getTime()).toBe(24 * 3600 * 1000);
  });
  it('«próximos» no tiene fin', () => expect(tripDateRange('proximos', now).hasta).toBeUndefined());
});

describe('TX-CIERRE-1 · facturación', () => {
  it('cada tipo se enlaza por su columna', () => {
    expect(BILLING_LINK_COLUMN).toEqual({ trip: 'trip_id', service: 'transport_service_id', shipment: 'shipment_id' });
  });
  it('concepto de expedición con ruta, mercancía y referencias', () => {
    const c = shipmentInvoiceConcept(sh({ referencia_cargador: 'ALB-77' }));
    expect(c).toContain('Porte Santander → Bilbao');
    expect(c).toContain('Palés de bebidas');
    expect(c).toContain('Exp. EXP-2026-0001');
    expect(c).toContain('Su ref. ALB-77');
  });
  it('concepto de servicio de viajeros', () => {
    const s = { id: 's', org_id: 'o', titulo: 'Excursión colegio', tipo_servicio: 'excursion', estado: 'completado',
      fecha_inicio: '2026-11-20T08:00:00Z', origen: 'Santander', destino: 'Comillas', paradas: [], num_viajeros: 54 } as unknown as TradeTransportService;
    const c = serviceInvoiceConcept(s, '1234ABC');
    expect(c).toContain('Servicio de transporte de viajeros Santander → Comillas');
    expect(c).toContain('Excursión colegio');
    expect(c).toContain('54 plazas');
    expect(c).toContain('Vehículo 1234ABC');
  });
  it('normaliza el NIF', () => expect(normNif(' b-12.345.678 ')).toBe('B12345678'));
});

describe('TX-CIERRE-1 · expediciones', () => {
  it('rechaza un precio negativo', () => {
    expect(validateShipment({ ...emptyShipmentInput('2026-11-20'), cargador_nombre: 'X', origen: 'A', destino: 'B', naturaleza: 'N', precio_acordado: -1 }))
      .toBe('El precio no es válido');
  });
  it('detecta la prueba de entrega', () => {
    expect(hasDeliveryProof(sh({}))).toBe(false);
    expect(hasDeliveryProof(sh({ firma_path: 'o/x/firma.png' }))).toBe(true);
    expect(hasDeliveryProof(sh({ fotos: ['o/x/f.jpg'] }))).toBe(true);
  });
});
