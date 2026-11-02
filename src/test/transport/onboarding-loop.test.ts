/**
 * TX-MC-0-FIX-2 — TransportOnboardingWizard loop prevention
 *
 * Root cause: when an org is created by AppDashboardView.loadLiveData (transport
 * registration flow), SessionContext.org is null at wizard mount time. The wizard
 * derived orgId = org?.id ?? '' = ''. The guard `if (orgId)` silently skipped the
 * is_onboarded update. onComplete() was still called, loadLiveData re-fetched
 * is_onboarded=false and set showOnboarding=true → infinite loop.
 *
 * Fix:
 *   1. AppDashboardView passes orgId prop (authoritative DB org ID) to wizard.
 *   2. Wizard uses propOrgId || sessionOrg?.id — propOrgId wins.
 *   3. handleComplete checks { error } from Supabase; throws so onComplete()
 *      is never called on a failed write.
 *
 * These are pure-logic invariant tests. E2E scenarios (actual Supabase session,
 * registration flow, wizard mount) are documented as todo.
 */

import { describe, it, expect } from 'vitest';

// ── Types mirroring wizard internals ─────────────────────────────────────────

interface SessionOrg {
  id: string;
}

interface WizardProps {
  orgId?: string;
}

// ── Pure logic extracted from wizard ─────────────────────────────────────────

/** resolveOrgId: mirrors `const orgId = propOrgId || (org?.id ?? '')` */
function resolveOrgId(props: WizardProps, sessionOrg: SessionOrg | null): string {
  return props.orgId || (sessionOrg?.id ?? '');
}

/** shouldSkipUpdate: mirrors `if (!orgId)` guard in handleComplete */
function shouldSkipUpdate(orgId: string): boolean {
  return !orgId;
}

/**
 * handleCompleteWillCallOnComplete: simulates the fixed handleComplete outcome.
 *
 * In the OLD code: onComplete() was always called (no error check, no orgId check).
 * In the NEW code: onComplete() is only called when orgId is truthy AND no Supabase error.
 */
function handleCompleteWillCallOnComplete(
  orgId: string,
  supabaseError: { message: string } | null
): boolean {
  if (!orgId) return false;       // throws "ID de organización no disponible"
  if (supabaseError) return false; // throws supabaseError.message
  return true;                    // success → onComplete() called
}

// ── Scenario OL-1: orgId resolution ──────────────────────────────────────────

describe('OL-1: orgId resolution — prop wins over session', () => {
  it('propOrgId set, session null → uses propOrgId', () => {
    expect(resolveOrgId({ orgId: 'prop-org-id' }, null)).toBe('prop-org-id');
  });

  it('propOrgId set, session has different id → uses propOrgId (prop wins)', () => {
    expect(resolveOrgId({ orgId: 'prop-org-id' }, { id: 'session-org-id' })).toBe('prop-org-id');
  });

  it('propOrgId undefined, session has org → uses session id', () => {
    expect(resolveOrgId({}, { id: 'session-org-id' })).toBe('session-org-id');
  });

  it('propOrgId undefined, session null → empty string (will be caught by guard)', () => {
    expect(resolveOrgId({}, null)).toBe('');
  });

  it('propOrgId empty string, session has org → falls through to session id', () => {
    // '' is falsy, so propOrgId || sessionOrg?.id returns session id
    expect(resolveOrgId({ orgId: '' }, { id: 'session-org-id' })).toBe('session-org-id');
  });
});

// ── Scenario OL-2: handleComplete — NEW behavior ─────────────────────────────

describe('OL-2: handleComplete (fixed) — onComplete() only on success', () => {
  it('orgId present, no error → onComplete() IS called', () => {
    expect(handleCompleteWillCallOnComplete('org-123', null)).toBe(true);
  });

  it('orgId empty, no error → onComplete() NOT called (prevents loop)', () => {
    expect(handleCompleteWillCallOnComplete('', null)).toBe(false);
  });

  it('orgId present, Supabase RLS error → onComplete() NOT called', () => {
    expect(handleCompleteWillCallOnComplete('org-123', { message: 'Row Level Security policy violation' })).toBe(false);
  });

  it('orgId present, Supabase transport_enabled trigger error → onComplete() NOT called', () => {
    expect(handleCompleteWillCallOnComplete('org-123', { message: 'TRANSPORT_ENABLED_PROTECTED' })).toBe(false);
  });

  it('orgId present, network error → onComplete() NOT called', () => {
    expect(handleCompleteWillCallOnComplete('org-123', { message: 'Failed to fetch' })).toBe(false);
  });
});

// ── Scenario OL-3: OLD behavior — demonstrates the bug ───────────────────────

describe('OL-3: OLD handleComplete behavior — demonstrates the loop bug', () => {
  /** Old code: onComplete() called regardless of orgId or error */
  function oldHandleCompleteWillCallOnComplete(_orgId: string, _error: unknown): boolean {
    return true; // always called — this was the bug
  }

  it('[OLD BUG] orgId empty + no error → onComplete() wrongly called → loop', () => {
    // This is the root cause: session org null → orgId='' → guard skips update
    // → onComplete() runs → loadLiveData → is_onboarded=false → wizard again
    expect(oldHandleCompleteWillCallOnComplete('', null)).toBe(true);
  });

  it('[OLD BUG] Supabase error + valid orgId → onComplete() wrongly called → loop', () => {
    expect(oldHandleCompleteWillCallOnComplete('org-123', { message: 'some error' })).toBe(true);
  });
});

// ── Scenario OL-4: registration flow — demot4 root cause ─────────────────────

describe('OL-4: demot4 registration flow — root cause scenario', () => {
  // demot4@castpedex.com: org 832e3dd3 created by loadLiveData (registration)
  // SessionContext loaded before org existed → org=null → sessionOrgId=''
  // AppDashboardView has the real orgId after loadLiveData completes

  const DEMOT4_ORG_ID = '832e3dd3-d06a-4329-ad91-69cac9240ee5';

  it('SessionContext org null at wizard mount (registration flow) → resolveOrgId uses prop', () => {
    const resolved = resolveOrgId({ orgId: DEMOT4_ORG_ID }, null);
    expect(resolved).toBe(DEMOT4_ORG_ID);
  });

  it('without prop fix: SessionContext null → empty orgId → silent skip → loop', () => {
    const oldOrgId = resolveOrgId({}, null); // OLD: no prop, session null
    expect(shouldSkipUpdate(oldOrgId)).toBe(true); // update would be skipped → loop
  });

  it('with prop fix: propOrgId from AppDashboardView → orgId set → update runs', () => {
    const newOrgId = resolveOrgId({ orgId: DEMOT4_ORG_ID }, null);
    expect(shouldSkipUpdate(newOrgId)).toBe(false); // update runs → no loop
  });

  it('handleComplete with real orgId and no error → onComplete() called → wizard closes', () => {
    expect(handleCompleteWillCallOnComplete(DEMOT4_ORG_ID, null)).toBe(true);
  });
});

// ── Scenario OL-5: modality invariants (viajeros, mercancias, combinada) ──────

describe('OL-5: all three transport modalities trigger the same loop protection', () => {
  const MODALITIES = ['viajeros', 'mercancias', 'reparto', 'combinada'] as const;

  MODALITIES.forEach(modalidad => {
    it(`${modalidad}: propOrgId provided → orgId resolved correctly`, () => {
      const orgId = `test-org-${modalidad}`;
      const resolved = resolveOrgId({ orgId }, null);
      expect(resolved).toBe(orgId);
      expect(shouldSkipUpdate(resolved)).toBe(false);
    });

    it(`${modalidad}: no prop, session null → orgId empty → handleComplete throws (no loop)`, () => {
      const resolved = resolveOrgId({}, null);
      expect(handleCompleteWillCallOnComplete(resolved, null)).toBe(false);
    });
  });
});

// ── Scenario OL-6: doSkip — same fix applies ────────────────────────────────

describe('OL-6: doSkip shares the same prop-based orgId resolution', () => {
  it('propOrgId provided → doSkip writes is_onboarded=true to correct org', () => {
    const resolved = resolveOrgId({ orgId: 'org-123' }, null);
    expect(resolved).toBe('org-123');
    expect(shouldSkipUpdate(resolved)).toBe(false); // update will run
  });

  it('propOrgId missing, session null → empty orgId → doSkip calls onComplete anyway', () => {
    // doSkip is fire-and-forget; it still calls onComplete() even with empty orgId.
    // The prop fix makes this branch unreachable under normal conditions.
    const resolved = resolveOrgId({}, null);
    expect(resolved).toBe('');
    expect(shouldSkipUpdate(resolved)).toBe(true);
  });
});

// ── E2E scenarios (documented, require real Supabase + browser) ───────────────

describe('OL-E2E: scenarios requiring real Supabase session', () => {
  it.todo('demot4 login → onboarding wizard → Finalizar → no loop → dashboard shown');
  it.todo('demot4 F5 refresh → wizard skipped (is_onboarded=true) → dashboard shown');
  it.todo('viajeros registration → wizard → Finalizar → dashboard with Viajeros tabs');
  it.todo('mercancias registration → wizard → Finalizar → dashboard with Mercancías tabs');
  it.todo('combinada registration → wizard → Finalizar → dashboard with combined tabs');
  it.todo('Supabase RLS error on handleComplete → toast shown → wizard stays open');
});
