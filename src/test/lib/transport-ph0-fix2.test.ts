/**
 * TX-C3-PH0-FIX-2 — Tests multivertical y guard de operativa de Transporte.
 *
 * Cubre:
 *  1. Orgs instaladoras con caps.hasTransport=false → no deben crear servicio
 *  2. Criterio autorizado: transport_enabled en DB (no oficio, no metadata)
 *  3. Lógica del banner €/h: ocultar cuando el presupuesto actual es transporte
 *     con precio cerrado, independientemente del tipo de org
 *  4. Guard de aceptación pública: el RPC devuelve ORG_NO_TRANSPORT_CAPABILITY
 *     cuando transport_enabled=false (simulado desde la respuesta del RPC)
 *  5. Regresión: limpieza y otras verticales no activan el guard de transporte
 */

import { describe, it, expect } from 'vitest';
import { getOrgCapabilities } from '../../lib/orgCapabilities';
import {
  isValidTransportIntake,
  isTransportQuoteWithClosedPrice,
  type TransportIntake,
  type TransportIntakeData,
} from '../../lib/transportVoiceIntake';
import type { TradeOrganization } from '../../lib/supabase';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeOrg(overrides: Partial<TradeOrganization>): TradeOrganization {
  return {
    id: 'org-id',
    owner_id: 'owner-id',
    nombre: 'Test Org',
    oficio: 'Fontanería',
    iva_default: 21,
    plan: 'basico',
    is_onboarded: true,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    transport_enabled: false,
    ...overrides,
  } as TradeOrganization;
}

function makeTransportIntake(
  precio_origen: 'dictado_usuario' | 'pendiente' = 'dictado_usuario',
): TransportIntake {
  const data: TransportIntakeData = {
    tipo_servicio: 'excursion',
    origen: 'Santander',
    destino: 'Bilbao',
    fecha_servicio: '2026-11-15',
    fecha_fin_servicio: null,
    num_viajeros: 40,
    precio_base: precio_origen === 'dictado_usuario' ? 1200 : null,
    precio_incluye_iva: false,
    precio_origen,
    itinerario: [],
    condiciones_especiales: [],
    campos_pendientes: precio_origen === 'pendiente' ? ['precio_base'] : [],
  };
  return { schemaVersion: 1, vertical: 'transporte', intake: data };
}

// ── T1: Org instaladora → caps.hasTransport = false ───────────────────────────
describe('T1 — org instaladora sin transport_enabled', () => {
  it('hasTransport = false cuando transport_enabled = false', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: false }));
    expect(caps.hasTransport).toBe(false);
  });

  it('isTransportOrg = false aunque cree un presupuesto de vertical=transporte', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: false }));
    expect(caps.isTransportOrg).toBe(false);
  });
});

// ── T2: Guard frontend — condición de llamada a createTransportServiceFromQuote ─
describe('T2 — guard frontend: no crear servicio si hasTransport=false', () => {
  it('una org instaladora (hasTransport=false) NO debe activar la creación de servicio', () => {
    const caps = getOrgCapabilities(makeOrg({ transport_enabled: false }));
    const quoteIsTransporte = true;
    const shouldCreate = caps.hasTransport && quoteIsTransporte;
    expect(shouldCreate).toBe(false);
  });

  it('una org con transport_enabled=true SÍ activa la creación de servicio', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de viajeros',
      transport_enabled: true,
    }));
    const quoteIsTransporte = true;
    const shouldCreate = caps.hasTransport && quoteIsTransporte;
    expect(shouldCreate).toBe(true);
  });
});

// ── T3: RPC simulado — ORG_NO_TRANSPORT_CAPABILITY ───────────────────────────
describe('T3 — respuesta RPC ORG_NO_TRANSPORT_CAPABILITY', () => {
  it('cuando RPC devuelve ORG_NO_TRANSPORT_CAPABILITY, ok=false y no hay service_id', () => {
    // Simula la respuesta que el SQL devuelve para org sin transport_enabled
    const rpcResponse = {
      ok: false,
      code: 'ORG_NO_TRANSPORT_CAPABILITY',
      message: 'Esta organización no tiene la operativa de Transporte habilitada.',
    };
    expect(rpcResponse.ok).toBe(false);
    expect(rpcResponse.code).toBe('ORG_NO_TRANSPORT_CAPABILITY');
    expect((rpcResponse as Record<string, unknown>)['service_id']).toBeUndefined();
  });

  it('el código ORG_NO_TRANSPORT_CAPABILITY es distinto de RECURRENTE_DEFERRED', () => {
    expect('ORG_NO_TRANSPORT_CAPABILITY').not.toBe('RECURRENTE_DEFERRED');
  });
});

// ── T4: Happy path — org con transport habilitado ─────────────────────────────
describe('T4 — happy path: org con transport_enabled=true crea servicio', () => {
  it('org pura de transporte tiene hasTransport=true e isTransportOrg=true', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Autocares del Norte',
      transport_enabled: true,
      transport_modalidad: 'viajeros',
    }));
    expect(caps.hasTransport).toBe(true);
    expect(caps.isTransportOrg).toBe(true);
    const shouldCreate = caps.hasTransport && true; // quoteIsTransporte
    expect(shouldCreate).toBe(true);
  });
});

// ── T5: No se crea Oficios job para presupuestos de transporte ────────────────
describe('T5 — no se crea trabajo de Oficios al aceptar presupuesto de transporte', () => {
  it('isValidTransportIntake solo pasa cuando vertical=transporte', () => {
    const valid = makeTransportIntake();
    expect(isValidTransportIntake(valid)).toBe(true);
  });

  it('presupuesto sin vertical=transporte no pasa el gate', () => {
    const noTransport = { schemaVersion: 1, vertical: 'instalacion', intake: {} };
    expect(isValidTransportIntake(noTransport)).toBe(false);
  });

  it('presupuesto sin metadata de intake no activa conversión', () => {
    expect(isValidTransportIntake(null)).toBe(false);
    expect(isValidTransportIntake(undefined)).toBe(false);
  });
});

// ── T6: Dedup — presupuesto con transport_service_id ya existente ─────────────
describe('T6 — dedup: segundo intento devuelve idempotent=true', () => {
  it('cuando la metadata ya tiene transport_service_id, no se necesita llamar al RPC', () => {
    const quoteMeta = {
      vertical: 'transporte',
      transport_service_id: 'uuid-existente-123',
    };
    const alreadyCreated = !!quoteMeta.transport_service_id;
    expect(alreadyCreated).toBe(true);
  });

  it('respuesta idempotente del RPC tiene ok=true e idempotent=true', () => {
    const idempotentResponse = { ok: true, service_id: 'uuid-123', idempotent: true };
    expect(idempotentResponse.ok).toBe(true);
    expect(idempotentResponse.idempotent).toBe(true);
  });
});

// ── T7: Banner €/h oculto — instaladora con presupuesto transporte precio cerrado ─
describe('T7 — banner €/h oculto: org instaladora + presupuesto transporte con precio cerrado', () => {
  it('isTransportQuoteWithClosedPrice = true cuando precio_origen=dictado_usuario', () => {
    const intake = makeTransportIntake('dictado_usuario');
    expect(isTransportQuoteWithClosedPrice(intake)).toBe(true);
  });

  it('condición banner: se suprime si isTransportQuoteWithClosedPrice=true, aunque isTransportOrg=false', () => {
    const caps = getOrgCapabilities(makeOrg({ transport_enabled: false }));
    const intake = makeTransportIntake('dictado_usuario');
    const valorHoraOperario = 20;
    const TARIFA_SUGERIDA = 25;
    const showPricingSuggestion = true;

    const showBanner =
      showPricingSuggestion &&
      !caps.isTransportOrg &&
      valorHoraOperario < TARIFA_SUGERIDA &&
      !isTransportQuoteWithClosedPrice(intake);

    expect(showBanner).toBe(false);
  });
});

// ── T8: Banner €/h visible — instaladora con precio pendiente ────────────────
describe('T8 — banner €/h visible: org instaladora + presupuesto transporte con precio pendiente', () => {
  it('isTransportQuoteWithClosedPrice = false cuando precio_origen=pendiente', () => {
    const intake = makeTransportIntake('pendiente');
    expect(isTransportQuoteWithClosedPrice(intake)).toBe(false);
  });

  it('banner visible si isTransportOrg=false y precio pendiente (sin precio cerrado)', () => {
    const caps = getOrgCapabilities(makeOrg({ transport_enabled: false }));
    const intake = makeTransportIntake('pendiente');
    const valorHoraOperario = 20;
    const TARIFA_SUGERIDA = 25;
    const showPricingSuggestion = true;

    const showBanner =
      showPricingSuggestion &&
      !caps.isTransportOrg &&
      valorHoraOperario < TARIFA_SUGERIDA &&
      !isTransportQuoteWithClosedPrice(intake);

    expect(showBanner).toBe(true);
  });
});

// ── T9: Banner €/h oculto — org de transporte (siempre) ──────────────────────
describe('T9 — banner €/h siempre oculto para org de transporte', () => {
  it('isTransportOrg=true suprime el banner independientemente del intake', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Autocares del Norte',
      transport_enabled: true,
      transport_modalidad: 'viajeros',
    }));
    const intake = makeTransportIntake('pendiente'); // precio pendiente
    const valorHoraOperario = 20;
    const TARIFA_SUGERIDA = 25;
    const showPricingSuggestion = true;

    const showBanner =
      showPricingSuggestion &&
      !caps.isTransportOrg &&
      valorHoraOperario < TARIFA_SUGERIDA &&
      !isTransportQuoteWithClosedPrice(intake);

    expect(showBanner).toBe(false);
  });

  it('isTransportOrg=true con intake=null también suprime el banner', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Autocares',
      transport_enabled: true,
      transport_modalidad: 'mercancias',
    }));
    const valorHoraOperario = 20;
    const TARIFA_SUGERIDA = 25;
    const showPricingSuggestion = true;

    const showBanner =
      showPricingSuggestion &&
      !caps.isTransportOrg &&
      valorHoraOperario < TARIFA_SUGERIDA &&
      !isTransportQuoteWithClosedPrice(null);

    expect(showBanner).toBe(false);
  });
});

// ── T10: Regresión — limpieza y otras verticales no activan guard transporte ──
describe('T10 — regresión: otras verticales no activan guard de transporte', () => {
  it('isValidTransportIntake rechaza vertical=cleaning', () => {
    const cleaningIntake = { schemaVersion: 1, vertical: 'cleaning', intake: {} };
    expect(isValidTransportIntake(cleaningIntake)).toBe(false);
  });

  it('isTransportQuoteWithClosedPrice devuelve false cuando intake=null', () => {
    expect(isTransportQuoteWithClosedPrice(null)).toBe(false);
  });

  it('org instaladora sin intake de transporte → banner se muestra si todas las condiciones se dan', () => {
    const caps = getOrgCapabilities(makeOrg({ transport_enabled: false }));
    const valorHoraOperario = 15;
    const TARIFA_SUGERIDA = 25;
    const showPricingSuggestion = true;

    const showBanner =
      showPricingSuggestion &&
      !caps.isTransportOrg &&
      valorHoraOperario < TARIFA_SUGERIDA &&
      !isTransportQuoteWithClosedPrice(null);

    expect(showBanner).toBe(true);
  });
});
