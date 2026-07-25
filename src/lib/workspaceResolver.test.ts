import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isRememberedWorkspaceValid,
  getRememberedWorkspace,
  rememberWorkspace,
  clearRememberedWorkspace,
  type ResolvedWorkspaces,
} from './workspaceResolver';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INSTALLER: ResolvedWorkspaces = {
  installers: [{ type: 'installer_org', id: 'org-1', name: 'Demo SL', role: 'owner', isOnboarded: true }],
  suppliers: [],
};

const SUPPLIER: ResolvedWorkspaces = {
  installers: [],
  suppliers: [{ type: 'marketplace_actor', id: 'actor-1', name: 'OBRAMAT Demo', logoUrl: null, actorType: 'supplier', actorEstado: 'active', roleName: 'owner', activo: true }],
};

const BOTH: ResolvedWorkspaces = {
  installers: [{ type: 'installer_org', id: 'org-1', name: 'Demo SL', role: 'owner', isOnboarded: true }],
  suppliers:  [{ type: 'marketplace_actor', id: 'actor-1', name: 'OBRAMAT Demo', logoUrl: null, actorType: 'supplier', actorEstado: 'active', roleName: 'owner', activo: true }],
};

const MULTIPLE: ResolvedWorkspaces = {
  installers: [
    { type: 'installer_org', id: 'org-1', name: 'Demo SL',  role: 'owner', isOnboarded: true },
    { type: 'installer_org', id: 'org-2', name: 'Obras SL', role: 'admin', isOnboarded: false },
  ],
  suppliers: [],
};

const EMPTY: ResolvedWorkspaces = { installers: [], suppliers: [] };

const INACTIVE_SUPPLIER: ResolvedWorkspaces = {
  installers: [],
  suppliers: [{ type: 'marketplace_actor', id: 'actor-1', name: 'OBRAMAT Demo', logoUrl: null, actorType: 'supplier', actorEstado: 'suspended', roleName: 'owner', activo: false }],
};

// ── isRememberedWorkspaceValid ────────────────────────────────────────────────

describe('isRememberedWorkspaceValid', () => {
  it('validates remembered installer workspace', () => {
    expect(isRememberedWorkspaceValid({ type: 'installer_org', id: 'org-1' }, INSTALLER)).toBe(true);
  });

  it('rejects remembered installer not in resolved list', () => {
    expect(isRememberedWorkspaceValid({ type: 'installer_org', id: 'org-99' }, INSTALLER)).toBe(false);
  });

  it('validates remembered supplier workspace', () => {
    expect(isRememberedWorkspaceValid({ type: 'marketplace_actor', id: 'actor-1' }, SUPPLIER)).toBe(true);
  });

  it('rejects suspended supplier even if id matches', () => {
    expect(isRememberedWorkspaceValid({ type: 'marketplace_actor', id: 'actor-1' }, INACTIVE_SUPPLIER)).toBe(false);
  });

  it('rejects unknown type', () => {
    expect(isRememberedWorkspaceValid({ type: 'unknown', id: 'x' }, BOTH)).toBe(false);
  });

  it('returns false for empty workspaces', () => {
    expect(isRememberedWorkspaceValid({ type: 'installer_org', id: 'org-1' }, EMPTY)).toBe(false);
  });
});

// ── localStorage helpers ──────────────────────────────────────────────────────

describe('workspace localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips workspace to localStorage', () => {
    rememberWorkspace({ type: 'installer_org', id: 'org-1' });
    expect(getRememberedWorkspace()).toEqual({ type: 'installer_org', id: 'org-1' });
  });

  it('returns null when nothing stored', () => {
    expect(getRememberedWorkspace()).toBeNull();
  });

  it('clears stored workspace', () => {
    rememberWorkspace({ type: 'marketplace_actor', id: 'actor-1' });
    clearRememberedWorkspace();
    expect(getRememberedWorkspace()).toBeNull();
  });

  it('returns null on malformed stored value', () => {
    localStorage.setItem('trabflow_last_workspace', 'not-json{');
    expect(getRememberedWorkspace()).toBeNull();
  });

  it('returns null when type or id is missing', () => {
    localStorage.setItem('trabflow_last_workspace', JSON.stringify({ type: 'installer_org' }));
    expect(getRememberedWorkspace()).toBeNull();
  });
});

// ── Routing rules (pure logic, no Supabase calls) ─────────────────────────────

describe('workspace routing rules', () => {
  function decideRoute(resolved: ResolvedWorkspaces, remembered: { type: string; id: string } | null) {
    const { installers, suppliers } = resolved;

    if (remembered && isRememberedWorkspaceValid(remembered, resolved)) {
      return remembered.type === 'installer_org' ? 'AppDashboard' : 'PortalProveedor';
    }

    if (installers.length === 0 && suppliers.length === 0) return 'NoWorkspace';
    if (installers.length === 1 && suppliers.length === 0) return 'AppDashboard';
    if (installers.length === 0 && suppliers.length === 1) return 'PortalProveedor';
    return 'WorkspaceSelector';
  }

  it('installer only → AppDashboard', () => {
    expect(decideRoute(INSTALLER, null)).toBe('AppDashboard');
  });

  it('supplier only → PortalProveedor', () => {
    expect(decideRoute(SUPPLIER, null)).toBe('PortalProveedor');
  });

  it('both → WorkspaceSelector', () => {
    expect(decideRoute(BOTH, null)).toBe('WorkspaceSelector');
  });

  it('multiple installers → WorkspaceSelector', () => {
    expect(decideRoute(MULTIPLE, null)).toBe('WorkspaceSelector');
  });

  it('no memberships → NoWorkspace', () => {
    expect(decideRoute(EMPTY, null)).toBe('NoWorkspace');
  });

  it('remembered installer_org valid → AppDashboard without selector', () => {
    expect(decideRoute(BOTH, { type: 'installer_org', id: 'org-1' })).toBe('AppDashboard');
  });

  it('remembered supplier valid → PortalProveedor without selector', () => {
    expect(decideRoute(BOTH, { type: 'marketplace_actor', id: 'actor-1' })).toBe('PortalProveedor');
  });

  it('remembered workspace invalid → shows selector', () => {
    expect(decideRoute(BOTH, { type: 'installer_org', id: 'org-stale' })).toBe('WorkspaceSelector');
  });

  it('inactive membership not counted', () => {
    expect(decideRoute(INACTIVE_SUPPLIER, null)).toBe('NoWorkspace');
  });

  it('suspended actor not counted as valid supplier', () => {
    expect(decideRoute(INACTIVE_SUPPLIER, { type: 'marketplace_actor', id: 'actor-1' })).toBe('NoWorkspace');
  });
});
