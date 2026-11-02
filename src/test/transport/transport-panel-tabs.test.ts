/**
 * TX-MC-0-FIX-3 — ScreenTransportePanel tab segregation invariants
 *
 * Tests the three-tab Centro de Gestión de Tráfico logic:
 *   - Tab availability by org modalidad
 *   - Active tab resets to 'general' when a tab becomes disabled
 *   - Default tab is always 'general'
 *   - Viajeros-only, Mercancías-only and Combinada access matrices
 *
 * Pure-logic tests — no DOM rendering required.
 */

import { describe, it, expect } from 'vitest';

// ── Types mirroring component props ──────────────────────────────────────────

interface OrgModalidadProps {
  isViajerosPrimary: boolean;
  isMercanciasPrimary: boolean;
  isCombinadaOrg: boolean;
}

type PanelTab = 'general' | 'viajeros' | 'mercancias';

// ── Pure logic extracted from component ──────────────────────────────────────

function viajeroEnabled(props: OrgModalidadProps): boolean {
  return props.isViajerosPrimary || props.isCombinadaOrg;
}

function mercanciasEnabled(props: OrgModalidadProps): boolean {
  return props.isMercanciasPrimary || props.isCombinadaOrg;
}

/**
 * resolveActiveTab: mirrors the useEffect guard that resets tab on prop change.
 * Returns the corrected active tab.
 */
function resolveActiveTab(currentTab: PanelTab, props: OrgModalidadProps): PanelTab {
  if (currentTab === 'viajeros' && !viajeroEnabled(props)) return 'general';
  if (currentTab === 'mercancias' && !mercanciasEnabled(props)) return 'general';
  return currentTab;
}

/**
 * availableTabs: which tabs a user can click (enabled = not locked).
 */
function availableTabs(props: OrgModalidadProps): PanelTab[] {
  const tabs: PanelTab[] = ['general']; // always available
  if (viajeroEnabled(props))    tabs.push('viajeros');
  if (mercanciasEnabled(props)) tabs.push('mercancias');
  return tabs;
}

// ── Predefined org modalidad sets ─────────────────────────────────────────────

const VIAJEROS_ORG: OrgModalidadProps = {
  isViajerosPrimary: true,
  isMercanciasPrimary: false,
  isCombinadaOrg: false,
};

const MERCANCIAS_ORG: OrgModalidadProps = {
  isViajerosPrimary: false,
  isMercanciasPrimary: true,
  isCombinadaOrg: false,
};

const COMBINADA_ORG: OrgModalidadProps = {
  isViajerosPrimary: false,
  isMercanciasPrimary: false,
  isCombinadaOrg: true,
};

const NO_TRANSPORT_ORG: OrgModalidadProps = {
  isViajerosPrimary: false,
  isMercanciasPrimary: false,
  isCombinadaOrg: false,
};

// ── Scenario TP-1: default tab ───────────────────────────────────────────────

describe('TP-1: default tab is always general', () => {
  const DEFAULT_TAB: PanelTab = 'general';

  it('Viajeros org → general tab enabled and shown by default', () => {
    expect(DEFAULT_TAB).toBe('general');
    expect(resolveActiveTab(DEFAULT_TAB, VIAJEROS_ORG)).toBe('general');
  });

  it('Mercancías org → general tab enabled and shown by default', () => {
    expect(resolveActiveTab(DEFAULT_TAB, MERCANCIAS_ORG)).toBe('general');
  });

  it('Combinada org → general tab enabled and shown by default', () => {
    expect(resolveActiveTab(DEFAULT_TAB, COMBINADA_ORG)).toBe('general');
  });

  it('No-transport org → general tab still accessible', () => {
    expect(resolveActiveTab(DEFAULT_TAB, NO_TRANSPORT_ORG)).toBe('general');
  });
});

// ── Scenario TP-2: tab availability matrix ───────────────────────────────────

describe('TP-2: tab availability — Viajeros org', () => {
  it('Viajeros: General + Viajeros enabled, Mercancías locked', () => {
    const tabs = availableTabs(VIAJEROS_ORG);
    expect(tabs).toContain('general');
    expect(tabs).toContain('viajeros');
    expect(tabs).not.toContain('mercancias');
  });

  it('Viajeros: viajeroEnabled=true, mercanciasEnabled=false', () => {
    expect(viajeroEnabled(VIAJEROS_ORG)).toBe(true);
    expect(mercanciasEnabled(VIAJEROS_ORG)).toBe(false);
  });
});

describe('TP-2b: tab availability — Mercancías org', () => {
  it('Mercancías: General + Mercancías enabled, Viajeros locked', () => {
    const tabs = availableTabs(MERCANCIAS_ORG);
    expect(tabs).toContain('general');
    expect(tabs).not.toContain('viajeros');
    expect(tabs).toContain('mercancias');
  });

  it('Mercancías: viajeroEnabled=false, mercanciasEnabled=true', () => {
    expect(viajeroEnabled(MERCANCIAS_ORG)).toBe(false);
    expect(mercanciasEnabled(MERCANCIAS_ORG)).toBe(true);
  });
});

describe('TP-2c: tab availability — Combinada org', () => {
  it('Combinada: all three tabs enabled (General + Viajeros + Mercancías)', () => {
    const tabs = availableTabs(COMBINADA_ORG);
    expect(tabs).toContain('general');
    expect(tabs).toContain('viajeros');
    expect(tabs).toContain('mercancias');
    expect(tabs).toHaveLength(3);
  });

  it('Combinada: viajeroEnabled=true, mercanciasEnabled=true', () => {
    expect(viajeroEnabled(COMBINADA_ORG)).toBe(true);
    expect(mercanciasEnabled(COMBINADA_ORG)).toBe(true);
  });
});

// ── Scenario TP-3: tab guard resets to general when tab becomes disabled ──────

describe('TP-3: tab guard — active tab resets when org props change', () => {
  it('Viajeros org, active=viajeros → stays viajeros', () => {
    expect(resolveActiveTab('viajeros', VIAJEROS_ORG)).toBe('viajeros');
  });

  it('Viajeros org, active=mercancias → resets to general (mercancias not enabled)', () => {
    expect(resolveActiveTab('mercancias', VIAJEROS_ORG)).toBe('general');
  });

  it('Mercancías org, active=mercancias → stays mercancias', () => {
    expect(resolveActiveTab('mercancias', MERCANCIAS_ORG)).toBe('mercancias');
  });

  it('Mercancías org, active=viajeros → resets to general (viajeros not enabled)', () => {
    expect(resolveActiveTab('viajeros', MERCANCIAS_ORG)).toBe('general');
  });

  it('Combinada org, active=viajeros → stays viajeros', () => {
    expect(resolveActiveTab('viajeros', COMBINADA_ORG)).toBe('viajeros');
  });

  it('Combinada org, active=mercancias → stays mercancias', () => {
    expect(resolveActiveTab('mercancias', COMBINADA_ORG)).toBe('mercancias');
  });

  it('No-transport org, active=viajeros → resets to general', () => {
    expect(resolveActiveTab('viajeros', NO_TRANSPORT_ORG)).toBe('general');
  });

  it('No-transport org, active=mercancias → resets to general', () => {
    expect(resolveActiveTab('mercancias', NO_TRANSPORT_ORG)).toBe('general');
  });

  it('Any org, active=general → always stays general', () => {
    for (const props of [VIAJEROS_ORG, MERCANCIAS_ORG, COMBINADA_ORG, NO_TRANSPORT_ORG]) {
      expect(resolveActiveTab('general', props)).toBe('general');
    }
  });
});

// ── Scenario TP-4: demot3/demot4 real profiles ───────────────────────────────

describe('TP-4: real demo account profiles', () => {
  // demot3 = "juan demot3 mercancias" → isMercanciasPrimary=true
  const DEMOT3_PROPS: OrgModalidadProps = { isViajerosPrimary: false, isMercanciasPrimary: true, isCombinadaOrg: false };
  // demot4 = combinada (post-onboarding) → isCombinadaOrg=true
  const DEMOT4_PROPS: OrgModalidadProps = { isViajerosPrimary: false, isMercanciasPrimary: false, isCombinadaOrg: true };

  it('demot3 (Mercancías): available tabs = general + mercancias (no viajeros)', () => {
    const tabs = availableTabs(DEMOT3_PROPS);
    expect(tabs).toContain('general');
    expect(tabs).toContain('mercancias');
    expect(tabs).not.toContain('viajeros');
  });

  it('demot3: if user clicks Viajeros tab somehow → guard resets to general', () => {
    expect(resolveActiveTab('viajeros', DEMOT3_PROPS)).toBe('general');
  });

  it('demot4 (Combinada): all tabs available', () => {
    const tabs = availableTabs(DEMOT4_PROPS);
    expect(tabs).toHaveLength(3);
    expect(tabs).toContain('viajeros');
    expect(tabs).toContain('mercancias');
  });
});

// ── Scenario TP-5: mutual exclusivity of Primary flags ───────────────────────

describe('TP-5: isViajerosPrimary and isMercanciasPrimary are mutually exclusive', () => {
  it('Both true simultaneously is not expected from orgCapabilities', () => {
    // The orgCapabilities.ts logic ensures these are mutually exclusive.
    // If someone passes both=true directly, our tab logic still works:
    const both: OrgModalidadProps = { isViajerosPrimary: true, isMercanciasPrimary: true, isCombinadaOrg: false };
    // Both tabs are enabled — no crash.
    const tabs = availableTabs(both);
    expect(tabs).toContain('viajeros');
    expect(tabs).toContain('mercancias');
  });

  it('Neither primary, isCombinadaOrg=false → only general', () => {
    const tabs = availableTabs(NO_TRANSPORT_ORG);
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toBe('general');
  });
});

// ── Scenario TP-6: Props default (isViajerosPrimary defaults to true in component) ──

describe('TP-6: default prop behavior (isViajerosPrimary defaults to true in component)', () => {
  it('Default props: isViajerosPrimary=true → Viajeros tab enabled', () => {
    // Component defaults: isViajerosPrimary = true, isMercanciasPrimary = false, isCombinadaOrg = false
    const defaultProps: OrgModalidadProps = { isViajerosPrimary: true, isMercanciasPrimary: false, isCombinadaOrg: false };
    expect(viajeroEnabled(defaultProps)).toBe(true);
    expect(mercanciasEnabled(defaultProps)).toBe(false);
    expect(availableTabs(defaultProps)).toContain('viajeros');
  });
});
