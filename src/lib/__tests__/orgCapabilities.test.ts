import { describe, it, expect } from 'vitest';
import { getOrgCapabilities, TRANSPORT_PENDING_OFICIOS, TRANSPORT_CANONICAL_OFICIOS } from '../orgCapabilities';
import type { TradeOrganization } from '../supabase';

function makeOrg(overrides: Partial<TradeOrganization>): TradeOrganization {
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
  } as TradeOrganization;
}

// ── Scenario 1: null org ──────────────────────────────────────────────────────
describe('SC-1: null org → installer defaults', () => {
  it('returns safe defaults', () => {
    const caps = getOrgCapabilities(null);
    expect(caps.hasTransport).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.isMixedOrg).toBe(false);
    expect(caps.transportSpecialties).toEqual([]);
    expect(caps.transportModalidad).toBeNull();
    expect(caps.transportServiceTypes).toEqual([]);
    expect(caps.transportLicense).toBe('none');
    expect(caps.isTransportDemo).toBe(false);
  });
});

// ── Scenario 2: installer org ─────────────────────────────────────────────────
describe('SC-2: installer org (transport_enabled=false)', () => {
  it('is installer, not transport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: false }));
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.hasTransport).toBe(false);
    expect(caps.isMixedOrg).toBe(false);
  });

  it('transport keyword in oficio does NOT grant access when transport_enabled=false', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: false }));
    expect(caps.hasTransport).toBe(false);
    expect(caps.isTransportOrg).toBe(false);
  });
});

// ── Scenario 3: oficio keyword detection ──────────────────────────────────────
describe('SC-3: transport org detected via oficio keyword', () => {
  it('detects "mudanzas"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.isInstallerOrg).toBe(false);
    expect(caps.isMixedOrg).toBe(false);
  });

  it('detects "Transporte de viajeros"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Transporte de viajeros', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
  });

  it('detects "Autocares Cantabria"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Autocares Cantabria', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
  });

  it('detects "logística y distribución"', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'logística y distribución', transport_enabled: true }));
    expect(caps.isTransportOrg).toBe(true);
  });
});

// ── Scenario 4: transport_modalidad overrides installer oficio ────────────────
describe('SC-4: transport_modalidad set → isTransportOrg=true even with installer oficio', () => {
  it('viajeros modalidad on installer oficio', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Fontanería',
      transport_enabled: true,
      transport_modalidad: 'viajeros',
    }));
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.isMixedOrg).toBe(false);
    expect(caps.transportModalidad).toBe('viajeros');
  });

  it('mercancias modalidad', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Electricidad',
      transport_enabled: true,
      transport_modalidad: 'mercancias',
    }));
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.transportModalidad).toBe('mercancias');
  });
});

// ── Scenario 5: mixed org ─────────────────────────────────────────────────────
describe('SC-5: mixed org (transport_enabled + installer oficio, no modalidad)', () => {
  it('is mixed when transport enabled but no modalidad or transport keyword', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: true }));
    expect(caps.isMixedOrg).toBe(true);
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
    expect(caps.hasTransport).toBe(true);
  });

  it('is mixed for Electricidad + transport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Electricidad', transport_enabled: true }));
    expect(caps.isMixedOrg).toBe(true);
    expect(caps.isInstallerOrg).toBe(true);
  });
});

// ── Scenario 6: isTransportDemo = true ───────────────────────────────────────
describe('SC-6: transport_license="demo" → isTransportDemo=true', () => {
  it('sets isTransportDemo when license is demo', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'mudanzas',
      transport_enabled: true,
      transport_license: 'demo',
    }));
    expect(caps.isTransportDemo).toBe(true);
    expect(caps.transportLicense).toBe('demo');
  });
});

// ── Scenario 7: isTransportDemo = false for "none" ───────────────────────────
describe('SC-7: transport_license="none" → isTransportDemo=false', () => {
  it('does not set isTransportDemo for none', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'mudanzas',
      transport_enabled: true,
      transport_license: 'none',
    }));
    expect(caps.isTransportDemo).toBe(false);
  });
});

// ── Scenario 8: isTransportDemo = false for "pilot" ──────────────────────────
describe('SC-8: transport_license="pilot" → isTransportDemo=false', () => {
  it('does not set isTransportDemo for pilot', () => {
    const caps = getOrgCapabilities(makeOrg({
      transport_enabled: true,
      transport_license: 'pilot',
    }));
    expect(caps.isTransportDemo).toBe(false);
    expect(caps.transportLicense).toBe('pilot');
  });
});

// ── Scenario 9: isTransportDemo = false for "production" ─────────────────────
describe('SC-9: transport_license="production" → isTransportDemo=false', () => {
  it('does not set isTransportDemo for production', () => {
    const caps = getOrgCapabilities(makeOrg({
      transport_enabled: true,
      transport_license: 'production',
    }));
    expect(caps.isTransportDemo).toBe(false);
    expect(caps.transportLicense).toBe('production');
  });
});

// ── Scenario 10: transport_service_types returned ────────────────────────────
describe('SC-10: transport_service_types populated', () => {
  it('returns service types array', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'mudanzas',
      transport_enabled: true,
      transport_service_types: ['excursiones', 'traslados'],
    }));
    expect(caps.transportServiceTypes).toEqual(['excursiones', 'traslados']);
    // BC alias
    expect(caps.transportSpecialties).toEqual(['excursiones', 'traslados']);
  });
});

// ── Scenario 11: empty transport_service_types ────────────────────────────────
describe('SC-11: transport_service_types empty', () => {
  it('returns empty array when column absent', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: true }));
    expect(caps.transportServiceTypes).toEqual([]);
    expect(caps.transportSpecialties).toEqual([]);
  });

  it('returns empty array when column is explicitly empty', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'mudanzas',
      transport_enabled: true,
      transport_service_types: [],
    }));
    expect(caps.transportServiceTypes).toEqual([]);
  });
});

// ── Scenario 12: Stripe-absence must NOT set isTransportDemo ─────────────────
describe('SC-12: Stripe-absence + trial status must NOT set isTransportDemo', () => {
  it('isTransportDemo=false for trial org without Stripe but no explicit license', () => {
    // This is the critical regression guard: old code inferred Demo from
    // !stripe_customer_id + status=trial. New code ONLY uses transport_license='demo'.
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'mudanzas',
      transport_enabled: true,
      // transport_license absent → defaults to 'none'
    }));
    expect(caps.isTransportDemo).toBe(false);
    // Even though we cannot pass subscription data to getOrgCapabilities,
    // the function must not produce isTransportDemo=true without explicit license.
  });
});

// ── Scenario 13: isPendingTransport — pending activation ─────────────────────
describe('SC-13: isPendingTransport — exact oficio + transport_enabled=false + not onboarded', () => {
  it('isPendingTransport=true for transport registration awaiting admin activation', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: false,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(true);
    // Must NOT grant transport access yet
    expect(caps.hasTransport).toBe(false);
    expect(caps.isTransportOrg).toBe(false);
    // Still shows as installer-capable? No — it's pending. isInstallerOrg is true but that's irrelevant
    // because AppDashboardView short-circuits on isPendingTransport before checking isInstallerOrg.
  });
});

// ── Scenario 14: isPendingTransport=false once transport_enabled=true ─────────
describe('SC-14: isPendingTransport=false once admin activates transport', () => {
  it('activated transport org is NOT pending', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: true,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.hasTransport).toBe(true);
  });
});

// ── Scenario 15: normal installer org is NOT pending ─────────────────────────
describe('SC-15: installer org is never isPendingTransport', () => {
  it('Fontanería installer is NOT pending transport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Fontanería', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });

  it('null org is NOT pending transport', () => {
    const caps = getOrgCapabilities(null);
    expect(caps.isPendingTransport).toBe(false);
  });
});

// ── Scenario 16: partial keyword match does NOT trigger isPendingTransport ────
describe('SC-16: keyword/partial match does NOT set isPendingTransport', () => {
  it('"transporte" (keyword) is NOT isPendingTransport — exact match required', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'transporte', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });

  it('"Transporte de Viajeros SL" (contains exact) is NOT isPendingTransport', () => {
    // Not a contains match — must be === 'Transporte de Viajeros'
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Transporte de Viajeros SL', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });

  it('"mudanzas" keyword is NOT isPendingTransport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mudanzas', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });
});

// ── Scenario 17: already onboarded transport org is NOT pending ───────────────
describe('SC-17: is_onboarded=true + pending oficio is NOT isPendingTransport', () => {
  it('onboarded transport org is not pending even if transport_enabled=false', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: false,
      is_onboarded: true,
    }));
    expect(caps.isPendingTransport).toBe(false);
  });
});

// ── Scenario 18: Mercancías pending activation ────────────────────────────────
describe('SC-18: isPendingTransport — Transporte de Mercancías awaiting activation', () => {
  it('isPendingTransport=true for Mercancías registration with transport_enabled=false', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Mercancías',
      transport_enabled: false,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(true);
    expect(caps.hasTransport).toBe(false);
    expect(caps.isTransportOrg).toBe(false);
  });
});

// ── Scenario 19: Mercancías activated is NOT pending ─────────────────────────
describe('SC-19: isPendingTransport=false once Mercancías is activated', () => {
  it('activated Mercancías org is NOT pending', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Mercancías',
      transport_enabled: true,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.hasTransport).toBe(true);
  });

  it('onboarded Mercancías org is NOT pending', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Mercancías',
      transport_enabled: false,
      is_onboarded: true,
    }));
    expect(caps.isPendingTransport).toBe(false);
  });
});

// ── Scenario 20: exact match required for Mercancías ─────────────────────────
describe('SC-20: keyword/partial match does NOT trigger isPendingTransport for Mercancías', () => {
  it('"transporte de mercancias" (lowercase, no tilde) is NOT isPendingTransport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'transporte de mercancias', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });

  it('"Transporte de Mercancías SL" (contains) is NOT isPendingTransport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'Transporte de Mercancías SL', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });

  it('"mercancías" keyword alone is NOT isPendingTransport', () => {
    const caps = getOrgCapabilities(makeOrg({ oficio: 'mercancías', transport_enabled: false, is_onboarded: false }));
    expect(caps.isPendingTransport).toBe(false);
  });
});

// ── Scenario 21: TRANSPORT_PENDING_OFICIOS export ────────────────────────────
describe('SC-21: TRANSPORT_PENDING_OFICIOS is exported and complete', () => {
  it('contains Transporte de Viajeros', () => {
    expect(TRANSPORT_PENDING_OFICIOS).toContain(TRANSPORT_CANONICAL_OFICIOS.viajeros);
  });
  it('contains Transporte de Mercancías', () => {
    expect(TRANSPORT_PENDING_OFICIOS).toContain(TRANSPORT_CANONICAL_OFICIOS.mercancias);
  });
  it('has exactly 2 entries', () => {
    expect(TRANSPORT_PENDING_OFICIOS).toHaveLength(2);
  });
});

// ── Scenario 22: admin-activated transport org routes to TransportOnboardingWizard
describe('SC-22: admin-activated Viajeros org goes to TransportOnboardingWizard (not pending)', () => {
  it('transport_enabled=true + is_onboarded=false → isTransportOrg=true, isPendingTransport=false', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: true,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.hasTransport).toBe(true);
    expect(caps.isTransportOrg).toBe(true);
  });
});

// ── Scenario 23: admin-activated Mercancías org routes to TransportOnboardingWizard
describe('SC-23: admin-activated Mercancías org goes to TransportOnboardingWizard', () => {
  it('transport_enabled=true + is_onboarded=false → isTransportOrg=true, isPendingTransport=false', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Mercancías',
      transport_enabled: true,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.hasTransport).toBe(true);
    expect(caps.isTransportOrg).toBe(true);
  });
});

// ── Scenario 24: installer regression — oficio='Otros' never triggers pending ─
describe('SC-24: installer org (oficio=Otros) is never isPendingTransport', () => {
  it('oficio=Otros + transport_enabled=false + is_onboarded=false is NOT pending', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Otros',
      transport_enabled: false,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
  });
});

// ── Scenario 25: null org never distinguishes DB error from installer-without-org ─
// INVARIANT: getOrgCapabilities(null) always returns isInstallerOrg=true regardless of
// why org is null (missing registration, getOwnOrg failure, or transport create error).
// The component MUST guard with transportCreateError state to prevent showing the
// installer wizard to transport registrants when org creation fails.
describe('SC-25: null org always produces installer caps (transport error guard must be external)', () => {
  it('null org from getOwnOrg error → isPendingTransport=false, isInstallerOrg=true', () => {
    const caps = getOrgCapabilities(null);
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
    expect(caps.isTransportOrg).toBe(false);
  });

  it('null org from transport create error → same installer caps (guard is external)', () => {
    // Caps cannot distinguish these cases — transportCreateError state in the
    // component is the only reliable guard. This test documents the invariant.
    const capsCreate = getOrgCapabilities(null);
    const capsGetOwn = getOrgCapabilities(null);
    expect(capsCreate).toEqual(capsGetOwn);
    expect(capsCreate.isPendingTransport).toBe(false);
  });
});

// ── Scenario 26: 23505 recovery — org with correct transport oficio after race ─
describe('SC-26: after 23505 race condition, org has correct transport oficio', () => {
  it('Viajeros org recovered after race → isPendingTransport=true routes to pending screen', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: TRANSPORT_CANONICAL_OFICIOS.viajeros,
      transport_enabled: false,
      is_onboarded: false,
    }));
    // isPendingTransport=true ensures TransportePendingView is shown (not the installer wizard)
    // even though isInstallerOrg is also true (transport not yet enabled).
    expect(caps.isPendingTransport).toBe(true);
    expect(caps.hasTransport).toBe(false);
  });

  it('Mercancías org recovered after race → isPendingTransport=true routes to pending screen', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: TRANSPORT_CANONICAL_OFICIOS.mercancias,
      transport_enabled: false,
      is_onboarded: false,
    }));
    expect(caps.isPendingTransport).toBe(true);
    expect(caps.hasTransport).toBe(false);
  });
});

// ── Scenario 27: isTransportSuspended — deactivated after onboarding ──────────
describe('SC-27: isTransportSuspended guards against installer fallback after deactivation', () => {
  it('Viajeros + transport_enabled=false + is_onboarded=true → isTransportSuspended=true', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: false,
      is_onboarded: true,
    }));
    expect(caps.isTransportSuspended).toBe(true);
    expect(caps.isPendingTransport).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
  });

  it('Mercancias + transport_enabled=false + is_onboarded=true → isTransportSuspended=true', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Mercancías',
      transport_enabled: false,
      is_onboarded: true,
    }));
    expect(caps.isTransportSuspended).toBe(true);
    expect(caps.isPendingTransport).toBe(false);
  });

  it('Installer org (Fontaneria) + is_onboarded=true → isTransportSuspended=false', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Fontanería',
      transport_enabled: false,
      is_onboarded: true,
    }));
    expect(caps.isTransportSuspended).toBe(false);
    expect(caps.isInstallerOrg).toBe(true);
  });

  it('Active transport org → isTransportSuspended=false even with is_onboarded=true', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: true,
      transport_modalidad: 'viajeros',
      is_onboarded: true,
    }));
    expect(caps.isTransportSuspended).toBe(false);
    expect(caps.isTransportOrg).toBe(true);
    expect(caps.hasTransport).toBe(true);
  });

  it('null org → isTransportSuspended=false', () => {
    const caps = getOrgCapabilities(null);
    expect(caps.isTransportSuspended).toBe(false);
  });
});

// ── Scenario 28: isPendingTransport and isTransportSuspended are mutually exclusive ─
describe('SC-28: isPendingTransport and isTransportSuspended are mutually exclusive', () => {
  const TRANSPORT_OFICIOS = ['Transporte de Viajeros', 'Transporte de Mercancías'];

  for (const oficio of TRANSPORT_OFICIOS) {
    it(`${oficio}: never both true simultaneously`, () => {
      // is_onboarded=false → isPendingTransport
      const pendingCaps = getOrgCapabilities(makeOrg({ oficio, transport_enabled: false, is_onboarded: false }));
      expect(pendingCaps.isPendingTransport).toBe(true);
      expect(pendingCaps.isTransportSuspended).toBe(false);

      // is_onboarded=true → isTransportSuspended
      const suspendedCaps = getOrgCapabilities(makeOrg({ oficio, transport_enabled: false, is_onboarded: true }));
      expect(suspendedCaps.isPendingTransport).toBe(false);
      expect(suspendedCaps.isTransportSuspended).toBe(true);

      // transport_enabled=true → neither
      const activeCaps = getOrgCapabilities(makeOrg({ oficio, transport_enabled: true, is_onboarded: true }));
      expect(activeCaps.isPendingTransport).toBe(false);
      expect(activeCaps.isTransportSuspended).toBe(false);
    });
  }
});

// ── Scenario 29: suspended org with explicit transport_modalidad (post-onboarding) ─
describe('SC-29: suspended org with transport_modalidad set (post-onboarding state)', () => {
  it('Viajeros + transport_modalidad=viajeros + transport_enabled=false + is_onboarded=true → isTransportSuspended', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_modalidad: 'viajeros',
      transport_enabled: false,
      is_onboarded: true,
    }));
    expect(caps.isTransportSuspended).toBe(true);
    expect(caps.hasTransport).toBe(false);
    expect(caps.transportModalidad).toBe('viajeros');
    expect(caps.isPendingTransport).toBe(false);
  });

  it('suspended org retains transport_license value from before deactivation', () => {
    const caps = getOrgCapabilities(makeOrg({
      oficio: 'Transporte de Viajeros',
      transport_enabled: false,
      transport_license: 'pilot',
      is_onboarded: true,
    }));
    expect(caps.isTransportSuspended).toBe(true);
    // transport_license value is preserved in caps even when suspended
    expect(caps.transportLicense).toBe('pilot');
  });
});
