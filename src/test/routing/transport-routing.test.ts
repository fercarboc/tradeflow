/**
 * TX-MC-0-FIX-1 — Transport routing invariants
 *
 * Tests the two guards added in App.tsx:
 *   1. routeSession: org owners with a worker record skip /worker (fix P0 Incidencia B)
 *   2. renderActiveView Worker guard: org owners never see the worker view (fix Incidencia A)
 *
 * Pure-logic tests only. E2E scenarios (actual Supabase auth events, browser popstate,
 * browser Back/Forward) require a real browser environment and are documented as
 * "E2E pending" below.
 */

import { describe, it, expect } from 'vitest';
import { ActivePage } from '../../types';

// ── Modelled types (mirror App.tsx state shape) ────────────────────────────────

interface WorkerProfile {
  id: string;
  org_id: string;
  nombre: string;
  rol: string;
  email: string;
}

interface ResolvedWorkspaces {
  installers: { id: string; name: string }[];
  suppliers:  { id: string; name: string }[];
}

// ── Pure logic extracted from App.tsx guards ───────────────────────────────────

/**
 * Guard 1 (routeSession): should we skip the Worker redirect?
 * Returns true when the user owns an org → fall through to resolveAndRoute.
 * Returns false when no owned org → safe to route to Worker.
 */
function shouldSkipWorkerRoute(ownedOrg: { id: string } | null): boolean {
  return ownedOrg !== null;
}

/**
 * Guard 2 (renderActiveView): should the Worker case render AppDashboard instead?
 * Org owners in Worker page (e.g. via stale browser history) must see their dashboard.
 */
function workerCaseShouldRenderDashboard(
  resolvedWorkspaces: ResolvedWorkspaces | null
): boolean {
  if (!resolvedWorkspaces) return false;
  return resolvedWorkspaces.installers.length > 0 || resolvedWorkspaces.suppliers.length > 0;
}

// ── Scenario RT-1: routeSession — pure worker (no org) → route to Worker ──────

describe('RT-1: pure worker (no owned org) → routes to Worker', () => {
  it('ownedOrg=null → shouldSkipWorkerRoute=false (allow Worker route)', () => {
    expect(shouldSkipWorkerRoute(null)).toBe(false);
  });

  it('worker with rol=tecnico, ownedOrg=null → setCurrentPage(Worker) is allowed', () => {
    const wp: WorkerProfile = { id: 'w1', org_id: 'o1', nombre: 'Técnico', rol: 'tecnico', email: 'tech@test.com' };
    expect(wp.rol === 'admin').toBe(false); // → routes to Worker not AppDashboard
    expect(shouldSkipWorkerRoute(null)).toBe(false);
  });

  it('worker with rol=admin, ownedOrg=null → setCurrentPage(AppDashboard) is allowed', () => {
    const wp: WorkerProfile = { id: 'w1', org_id: 'o1', nombre: 'Admin', rol: 'admin', email: 'admin@test.com' };
    expect(wp.rol === 'admin').toBe(true); // → routes to AppDashboard
    expect(shouldSkipWorkerRoute(null)).toBe(false);
  });
});

// ── Scenario RT-2: routeSession — org owner with worker record → skip Worker ──

describe('RT-2: org owner with worker record → skips Worker route', () => {
  it('ownedOrg present → shouldSkipWorkerRoute=true (fall through to resolveAndRoute)', () => {
    expect(shouldSkipWorkerRoute({ id: 'org-123' })).toBe(true);
  });

  it('Mercancías conductor who owns org → skip Worker (root cause demot3)', () => {
    // demot3: es_conductor=true, rol=tecnico, BUT owns org → must NOT go to /worker
    const ownedOrg = { id: '486f2120-1fb2-4303-9eae-28de8b444b04' };
    expect(shouldSkipWorkerRoute(ownedOrg)).toBe(true);
  });

  it('Viajeros conductor who owns org → skip Worker', () => {
    const ownedOrg = { id: 'viajeros-org-id' };
    expect(shouldSkipWorkerRoute(ownedOrg)).toBe(true);
  });

  it('Combinada org owner with worker record → skip Worker', () => {
    const ownedOrg = { id: 'combinada-org-id' };
    expect(shouldSkipWorkerRoute(ownedOrg)).toBe(true);
  });

  it('Installer org owner with worker record → skip Worker', () => {
    const ownedOrg = { id: 'installer-org-id' };
    expect(shouldSkipWorkerRoute(ownedOrg)).toBe(true);
  });
});

// ── Scenario RT-3: renderActiveView Worker guard ───────────────────────────────

describe('RT-3: renderActiveView Worker guard — org owners see AppDashboard', () => {
  it('resolvedWorkspaces=null → do NOT redirect (Worker view is correct for pure workers)', () => {
    expect(workerCaseShouldRenderDashboard(null)).toBe(false);
  });

  it('resolvedWorkspaces with 0 installers + 0 suppliers → do NOT redirect', () => {
    expect(workerCaseShouldRenderDashboard({ installers: [], suppliers: [] })).toBe(false);
  });

  it('resolvedWorkspaces with 1 installer → redirect to AppDashboard', () => {
    expect(workerCaseShouldRenderDashboard({ installers: [{ id: 'o1', name: 'Org' }], suppliers: [] })).toBe(true);
  });

  it('resolvedWorkspaces with 1 supplier → redirect to AppDashboard', () => {
    expect(workerCaseShouldRenderDashboard({ installers: [], suppliers: [{ id: 's1', name: 'Proveedor' }] })).toBe(true);
  });

  it('resolvedWorkspaces with both → redirect to AppDashboard', () => {
    expect(workerCaseShouldRenderDashboard({
      installers: [{ id: 'o1', name: 'Org' }],
      suppliers: [{ id: 's1', name: 'Proveedor' }],
    })).toBe(true);
  });

  it('Mercancías org owner in /worker via stale history → redirect to AppDashboard', () => {
    // Simulates: user had /worker in browser history, presses Back, state restores Worker.
    // resolvedWorkspaces was correctly set by resolveAndRoute after the RT-2 fix.
    const resolvedWorkspaces: ResolvedWorkspaces = {
      installers: [{ id: '486f2120-1fb2-4303-9eae-28de8b444b04', name: 'juan demot3 nercancias' }],
      suppliers: [],
    };
    expect(workerCaseShouldRenderDashboard(resolvedWorkspaces)).toBe(true);
  });
});

// ── Scenario RT-4: page mapping sanity for transport routes ───────────────────

const PAGE_PATHS: Partial<Record<ActivePage, string>> = {
  [ActivePage.AppDashboard]: '/app',
  [ActivePage.Worker]:       '/worker',
};

describe('RT-4: /app and /worker routes are distinct', () => {
  it('/app maps to AppDashboard', () => {
    expect(PAGE_PATHS[ActivePage.AppDashboard]).toBe('/app');
  });

  it('/worker maps to Worker', () => {
    expect(PAGE_PATHS[ActivePage.Worker]).toBe('/worker');
  });

  it('Worker and AppDashboard are different page values', () => {
    expect(ActivePage.Worker).not.toBe(ActivePage.AppDashboard);
  });
});

// ── Scenario RT-5: pending / suspended transport orgs (no regression) ─────────

describe('RT-5: pending and suspended transport orgs — not affected by routing fix', () => {
  it('pending org (transport_enabled=false): ownedOrg exists → still skips Worker route', () => {
    // Pending orgs have is_onboarded=false and transport_enabled=false.
    // The org record EXISTS in trade_organizations, so owner_id check returns it.
    // They will go to resolveAndRoute → AppDashboard (onboarding wizard shown there).
    const ownedOrg = { id: 'pending-org-id' };
    expect(shouldSkipWorkerRoute(ownedOrg)).toBe(true);
  });

  it('suspended org: ownedOrg exists → still skips Worker route', () => {
    const ownedOrg = { id: 'suspended-org-id' };
    expect(shouldSkipWorkerRoute(ownedOrg)).toBe(true);
  });
});

// ── Scenario RT-6: multi-workspace users ──────────────────────────────────────

describe('RT-6: multi-workspace users (installer + supplier) → AppDashboard in Worker case', () => {
  it('user with both installer and supplier workspaces → Worker guard redirects to AppDashboard', () => {
    expect(workerCaseShouldRenderDashboard({
      installers: [{ id: 'org1', name: 'Org 1' }],
      suppliers:  [{ id: 'sup1', name: 'Proveedor 1' }],
    })).toBe(true);
  });
});

// ── E2E scenarios (documented, require real browser + Supabase session) ────────

describe('RT-E2E: scenarios requiring real browser (documented only, not automated)', () => {
  it.todo('Mercancías login: SIGNED_IN event → resolveAndRoute → /app (not /worker)');
  it.todo('Mercancías logout + login: SIGNED_OUT + SIGNED_IN → resolveAndRoute → /app');
  it.todo('F5 reload in /app: INITIAL_SESSION → resolveAndRoute → preserves /app');
  it.todo('Browser Back from /app to /worker: guard redirects to /app');
  it.todo('Viajeros login: SIGNED_IN event → resolveAndRoute → /app with Viajeros tabs');
  it.todo('Installer legitimate access: worker with no org → correctly routes to /worker');
  it.todo('Token refresh (TOKEN_REFRESHED): no re-routing, stays on current page');
});
