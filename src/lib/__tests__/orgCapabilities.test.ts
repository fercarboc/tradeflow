import { describe, it, expect } from 'vitest';
import { getOrgCapabilities } from '../orgCapabilities';
import type { TradeOrganization } from '../supabase';

function makeOrg(overrides: Partial<TradeOrganization & { transport_specialties?: string[] }>): TradeOrganization & { transport_specialties?: string[] } {
  return {
    id: 'test-id',
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
  } as TradeOrganization & { transport_specialties?: string[] };
}

describe('getOrgCapabilities — null org', () => {
  it('returns installer defaults', () => {
    const caps = getOrgCapabilities(null);
    expect(caps.hasTransport).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.isMixedOrg).toBe(false);
    expect(caps.transportSpecialties).toEqual([]);
  });
});

describe('getOrgCapabilities — installer-only org', () => {
  it('returns installer caps when transport_enabled=false', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: false }));
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.hasTransport).toBe(false);
    expect(caps.isMixedOrg).toBe(false);
  });

  it('is NOT a transport org even with transport keyword in oficio when transport_enabled=false', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: false }));
    expect(caps.hasTransport).toBe(false);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
  });
});

describe('getOrgCapabilities — transport-only org (DEMO T1 scenario)', () => {
  it('detects transport org from oficio "mudanzas"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.isInstallerOrg).toBe(false);
    expect(caps.hasTransport).toBe(true);
    expect(caps.isMixedOrg).toBe(false);
  });

  it('detects transport org from oficio containing "Transporte"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Transporte de viajeros', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.isMixedOrg).toBe(false);
  });

  it('detects transport org from oficio "Autocares"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Autocares Cantabria', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
  });

  it('detects transport org from oficio "logística"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'logística y distribución', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
  });
});

describe('getOrgCapabilities — mixed org', () => {
  it('detects mixed org when transport_enabled but oficio is installer', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: true }));
    expect(caps.isMixedOrg).toBe(true);
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.hasTransport).toBe(true);
  });

  it('detects mixed org for Electricidad + transport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Electricidad', transport_enabled: true }));
    expect(caps.isMixedOrg).toBe(true);
    expect(caps.isInstallerOrg).toBe(true);
  });
});

describe('getOrgCapabilities — transport_specialties override', () => {
  it('detects transport org from transport_specialties even with installer oficio', () => {
    const org = makeOrg({ oficio: 'Fontanería', transport_enabled: true, transport_specialties: ['viajeros'] });
    const caps = getOrgCapabilities(org);
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.isMixedOrg).toBe(false);
    expect(caps.transportSpecialties).toEqual(['viajeros']);
  });

  it('returns specialties array', () => {
    const org = makeOrg({ oficio: 'mudanzas', transport_enabled: true, transport_specialties: ['viajeros', 'mercancias'] });
    const caps = getOrgCapabilities(org);
    expect(caps.transportSpecialties).toEqual(['viajeros', 'mercancias']);
  });

  it('returns empty specialties when column absent', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: true }));
    expect(caps.transportSpecialties).toEqual([]);
  });
});
