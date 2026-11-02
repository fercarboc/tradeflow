/**
 * TX-MC-0-LEGACY-1 — OrgCapabilities: legacy transport orgs and modality classification
 *
 * Tests the `isLegacyTransport` flag and the full modality classification matrix,
 * including the demot1 scenario (oficio='mudanzas', transport_modalidad=null).
 *
 * Pure logic tests — no DOM, no Supabase calls.
 */

import { describe, it, expect } from 'vitest';
import { getOrgCapabilities, TRANSPORT_CANONICAL_OFICIOS } from '../../lib/orgCapabilities';
import type { TradeOrganization } from '../../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrg(overrides: Partial<TradeOrganization>): TradeOrganization {
  return {
    id: 'test-org-id',
    nombre: 'Test Org',
    oficio: 'electricista',
    owner_id: 'owner-id',
    plan: 'basico',
    transport_enabled: false,
    transport_modalidad: null,
    transport_license: 'none',
    transport_service_types: [],
    is_onboarded: true,
    nif: 'B12345678',
    ...overrides,
  } as TradeOrganization;
}

// ── ESCENARIO DEMOT1 — org legacy con oficio='mudanzas' ─────────────────────

describe('LC-1: demot1 — oficio=mudanzas, transport_enabled=true, transport_modalidad=null', () => {
  const demot1 = makeOrg({
    id: 'd5938389-34dc-46c9-b96f-e1f14c5dcb84',
    nombre: 'Autobuses DemoT1',
    oficio: 'mudanzas',
    transport_enabled: true,
    transport_modalidad: null,
    transport_license: 'demo',
    is_onboarded: true,
  });

  it('hasTransport=true (transport_enabled=true)', () => {
    expect(getOrgCapabilities(demot1).hasTransport).toBe(true);
  });

  it('isTransportOrg=true (mudanzas keyword → isTransportPrimary=true)', () => {
    expect(getOrgCapabilities(demot1).isTransportOrg).toBe(true);
  });

  it('isViajerosPrimary=false (modalidad=null, oficio≠canonical viajeros)', () => {
    expect(getOrgCapabilities(demot1).isViajerosPrimary).toBe(false);
  });

  it('isMercanciasPrimary=false (modalidad=null, oficio≠canonical mercancias)', () => {
    expect(getOrgCapabilities(demot1).isMercanciasPrimary).toBe(false);
  });

  it('isCombinadaOrg=false (modalidad≠combinada)', () => {
    expect(getOrgCapabilities(demot1).isCombinadaOrg).toBe(false);
  });

  it('isLegacyTransport=true — sin modalidad identificable, panel visible pero tabs bloqueados', () => {
    expect(getOrgCapabilities(demot1).isLegacyTransport).toBe(true);
  });

  it('isMixedOrg=false (isTransportPrimary=true, no installer mix)', () => {
    expect(getOrgCapabilities(demot1).isMixedOrg).toBe(false);
  });

  it('isTransportDemo=true (license=demo)', () => {
    expect(getOrgCapabilities(demot1).isTransportDemo).toBe(true);
  });
});

// ── ESCENARIO DEMOT1 POST-FIX — tras ejecutar UPDATE transport_modalidad='viajeros' ──

describe('LC-2: demot1 post-fix — transport_modalidad=viajeros', () => {
  const demot1Fixed = makeOrg({
    id: 'd5938389-34dc-46c9-b96f-e1f14c5dcb84',
    nombre: 'Autobuses DemoT1',
    oficio: 'mudanzas',
    transport_enabled: true,
    transport_modalidad: 'viajeros',
    transport_license: 'demo',
    is_onboarded: true,
  });

  it('isViajerosPrimary=true tras fix', () => {
    expect(getOrgCapabilities(demot1Fixed).isViajerosPrimary).toBe(true);
  });

  it('isMercanciasPrimary=false tras fix', () => {
    expect(getOrgCapabilities(demot1Fixed).isMercanciasPrimary).toBe(false);
  });

  it('isLegacyTransport=false tras fix (modalidad ya declarada)', () => {
    expect(getOrgCapabilities(demot1Fixed).isLegacyTransport).toBe(false);
  });

  it('isTransportOrg=true tras fix', () => {
    expect(getOrgCapabilities(demot1Fixed).isTransportOrg).toBe(true);
  });
});

// ── ESCENARIO DEMOT2 — org Viajeros normal (demot2) ──────────────────────────

describe('LC-3: demot2 — oficio=canonical viajeros, transport_modalidad=viajeros', () => {
  const demot2 = makeOrg({
    nombre: 'AUTOBUSES DEMOT2',
    oficio: TRANSPORT_CANONICAL_OFICIOS.viajeros,
    transport_enabled: true,
    transport_modalidad: 'viajeros',
    transport_license: 'pilot',
    is_onboarded: true,
    transport_service_types: ['excursiones', 'escolar'],
  });

  it('isViajerosPrimary=true', () => {
    expect(getOrgCapabilities(demot2).isViajerosPrimary).toBe(true);
  });

  it('isLegacyTransport=false', () => {
    expect(getOrgCapabilities(demot2).isLegacyTransport).toBe(false);
  });
});

// ── MATRIZ DE MODALIDAD COMPLETA ─────────────────────────────────────────────

describe('LC-4: matriz de modalidad — viajeros, mercancias, reparto, combinada', () => {
  it('modalidad=viajeros → isViajerosPrimary, no legacy', () => {
    const org = makeOrg({ transport_enabled: true, transport_modalidad: 'viajeros' });
    const caps = getOrgCapabilities(org);
    expect(caps.isViajerosPrimary).toBe(true);
    expect(caps.isMercanciasPrimary).toBe(false);
    expect(caps.isCombinadaOrg).toBe(false);
    expect(caps.isLegacyTransport).toBe(false);
  });

  it('modalidad=mercancias → isMercanciasPrimary, no legacy', () => {
    const org = makeOrg({ transport_enabled: true, transport_modalidad: 'mercancias' });
    const caps = getOrgCapabilities(org);
    expect(caps.isViajerosPrimary).toBe(false);
    expect(caps.isMercanciasPrimary).toBe(true);
    expect(caps.isCombinadaOrg).toBe(false);
    expect(caps.isLegacyTransport).toBe(false);
  });

  it('modalidad=reparto → isMercanciasPrimary, no legacy', () => {
    const org = makeOrg({ transport_enabled: true, transport_modalidad: 'reparto' });
    const caps = getOrgCapabilities(org);
    expect(caps.isMercanciasPrimary).toBe(true);
    expect(caps.isLegacyTransport).toBe(false);
  });

  it('modalidad=combinada → isCombinadaOrg, no legacy', () => {
    const org = makeOrg({ transport_enabled: true, transport_modalidad: 'combinada' });
    const caps = getOrgCapabilities(org);
    expect(caps.isViajerosPrimary).toBe(false);
    expect(caps.isMercanciasPrimary).toBe(false);
    expect(caps.isCombinadaOrg).toBe(true);
    expect(caps.isLegacyTransport).toBe(false);
  });

  it('oficio=canonical viajeros, modalidad=null → isViajerosPrimary, no legacy', () => {
    const org = makeOrg({
      transport_enabled: true,
      transport_modalidad: null,
      oficio: TRANSPORT_CANONICAL_OFICIOS.viajeros,
    });
    const caps = getOrgCapabilities(org);
    expect(caps.isViajerosPrimary).toBe(true);
    expect(caps.isLegacyTransport).toBe(false);
  });

  it('oficio=canonical mercancias, modalidad=null → isMercanciasPrimary, no legacy', () => {
    const org = makeOrg({
      transport_enabled: true,
      transport_modalidad: null,
      oficio: TRANSPORT_CANONICAL_OFICIOS.mercancias,
    });
    const caps = getOrgCapabilities(org);
    expect(caps.isMercanciasPrimary).toBe(true);
    expect(caps.isLegacyTransport).toBe(false);
  });
});

// ── ESCENARIOS LEGACY ADICIONALES (otros oficios keyword) ───────────────────

describe('LC-5: otros oficios keyword legacy → isLegacyTransport=true', () => {
  const legacyOficios = ['transporte', 'logística', 'logistica', 'autocar', 'autobús', 'camión'];

  for (const oficio of legacyOficios) {
    it(`oficio='${oficio}', transport_enabled=true, modalidad=null → isLegacyTransport=true`, () => {
      const org = makeOrg({ transport_enabled: true, transport_modalidad: null, oficio });
      const caps = getOrgCapabilities(org);
      expect(caps.isTransportOrg).toBe(true);
      expect(caps.isLegacyTransport).toBe(true);
      expect(caps.isViajerosPrimary).toBe(false);
      expect(caps.isMercanciasPrimary).toBe(false);
    });
  }
});

// ── INSTALADOR PURO ───────────────────────────────────────────────────────────

describe('LC-6: instalador puro — sin transporte', () => {
  const installer = makeOrg({
    oficio: 'electricista',
    transport_enabled: false,
    transport_modalidad: null,
  });

  it('hasTransport=false, isTransportOrg=false', () => {
    const caps = getOrgCapabilities(installer);
    expect(caps.hasTransport).toBe(false);
    expect(caps.isTransportOrg).toBe(false);
  });

  it('isInstallerOrg=true', () => {
    expect(getOrgCapabilities(installer).isInstallerOrg).toBe(true);
  });

  it('isLegacyTransport=false (sin transporte)', () => {
    expect(getOrgCapabilities(installer).isLegacyTransport).toBe(false);
  });

  it('isViajerosPrimary=false, isMercanciasPrimary=false, isCombinadaOrg=false', () => {
    const caps = getOrgCapabilities(installer);
    expect(caps.isViajerosPrimary).toBe(false);
    expect(caps.isMercanciasPrimary).toBe(false);
    expect(caps.isCombinadaOrg).toBe(false);
  });
});

// ── ORGANIZACIÓN MIXTA ────────────────────────────────────────────────────────

describe('LC-7: organización mixta — transport_enabled=true, oficio=electricista', () => {
  const mixed = makeOrg({
    oficio: 'electricista',
    transport_enabled: true,
    transport_modalidad: null,
  });

  it('isMixedOrg=true (transport habilitado, oficio no es transport keyword)', () => {
    const caps = getOrgCapabilities(mixed);
    expect(caps.isMixedOrg).toBe(true);
  });

  it('isTransportOrg=false (no es transport primario)', () => {
    expect(getOrgCapabilities(mixed).isTransportOrg).toBe(false);
  });

  it('isInstallerOrg=true (mixta mantiene acceso instalador)', () => {
    expect(getOrgCapabilities(mixed).isInstallerOrg).toBe(true);
  });

  it('isLegacyTransport=false (isTransportPrimary=false → no aplica legacy check)', () => {
    expect(getOrgCapabilities(mixed).isLegacyTransport).toBe(false);
  });
});

// ── ORG NULA ──────────────────────────────────────────────────────────────────

describe('LC-8: org nula → defaults seguros', () => {
  it('getOrgCapabilities(null) → isLegacyTransport=false', () => {
    expect(getOrgCapabilities(null).isLegacyTransport).toBe(false);
  });

  it('getOrgCapabilities(null) → isTransportOrg=false, isInstallerOrg=true', () => {
    const caps = getOrgCapabilities(null);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
  });
});

// ── PENDING Y SUSPENDED (sin regresión) ──────────────────────────────────────

describe('LC-9: isPendingTransport y isTransportSuspended (sin regresión)', () => {
  it('isPendingTransport: transport_enabled=false + canonical oficio + not onboarded', () => {
    const org = makeOrg({
      oficio: TRANSPORT_CANONICAL_OFICIOS.viajeros,
      transport_enabled: false,
      is_onboarded: false,
    });
    expect(getOrgCapabilities(org).isPendingTransport).toBe(true);
  });

  it('isTransportSuspended: transport_enabled=false + canonical oficio + is_onboarded=true', () => {
    const org = makeOrg({
      oficio: TRANSPORT_CANONICAL_OFICIOS.viajeros,
      transport_enabled: false,
      is_onboarded: true,
    });
    expect(getOrgCapabilities(org).isTransportSuspended).toBe(true);
    expect(getOrgCapabilities(org).isLegacyTransport).toBe(false);
  });

  it('isPendingTransport y isTransportSuspended son mutuamente excluyentes', () => {
    const org1 = makeOrg({
      oficio: TRANSPORT_CANONICAL_OFICIOS.mercancias,
      transport_enabled: false,
      is_onboarded: false,
    });
    const org2 = makeOrg({
      oficio: TRANSPORT_CANONICAL_OFICIOS.mercancias,
      transport_enabled: false,
      is_onboarded: true,
    });
    expect(getOrgCapabilities(org1).isPendingTransport).toBe(true);
    expect(getOrgCapabilities(org1).isTransportSuspended).toBe(false);
    expect(getOrgCapabilities(org2).isPendingTransport).toBe(false);
    expect(getOrgCapabilities(org2).isTransportSuspended).toBe(true);
  });
});
