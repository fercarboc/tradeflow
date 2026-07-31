import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMyMarketplaceMemberships, MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import { getUnreadNotificationCount } from '../../lib/api/marketplace-portal';

export type PortalTab = 'dashboard' | 'catalogo' | 'pedidos' | 'equipo' | 'informes' | 'config';

const VALID_TABS: PortalTab[] = ['dashboard', 'catalogo', 'pedidos', 'equipo', 'informes', 'config'];
const LS_TAB    = 'trabflow_portal_tab';
const LS_ACTOR  = 'trabflow_portal_actor';

function readStoredTab(): PortalTab {
  try {
    const v = localStorage.getItem(LS_TAB);
    return VALID_TABS.includes(v as PortalTab) ? (v as PortalTab) : 'dashboard';
  } catch { return 'dashboard'; }
}

function readStoredActor(): string | null {
  try { return localStorage.getItem(LS_ACTOR) ?? null; } catch { return null; }
}

interface PortalState {
  memberships:       MarketplaceMyMembership[];
  activeActorId:     string | null;
  activeMembership:  MarketplaceMyMembership | null;
  activeTab:         PortalTab;
  unreadCount:       number;
  loading:           boolean;
  error:             string | null;
  setActiveActorId:  (id: string) => void;
  setActiveTab:      (tab: PortalTab) => void;
  reloadMemberships: () => Promise<void>;
  refreshUnread:     () => Promise<void>;
}

const PortalContext = createContext<PortalState | null>(null);

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('usePortal must be used inside PortalProvider');
  return ctx;
}

interface Props {
  children: React.ReactNode;
}

export function PortalProvider({ children }: Props) {
  const [memberships, setMemberships] = useState<MarketplaceMyMembership[]>([]);
  const [activeActorId, setActiveActorIdState] = useState<string | null>(readStoredActor);
  const [activeTab, setActiveTabState] = useState<PortalTab>(readStoredTab);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveTab = useCallback((tab: PortalTab) => {
    setActiveTabState(tab);
    try { localStorage.setItem(LS_TAB, tab); } catch {}
  }, []);

  const setActiveActorId = useCallback((id: string) => {
    setActiveActorIdState(id);
    try { localStorage.setItem(LS_ACTOR, id); } catch {}
  }, []);

  const reloadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyMarketplaceMemberships();
      const suppliers = data.filter((m) => m.actor_type === 'supplier' && m.activo);
      setMemberships(suppliers);
      setActiveActorIdState((prev) => {
        const stored = readStoredActor();
        const validStored = stored && suppliers.some((s) => s.actor_id === stored);
        if (validStored) {
          try { localStorage.setItem(LS_ACTOR, stored!); } catch {}
          return stored;
        }
        if (prev && suppliers.some((s) => s.actor_id === prev)) return prev;
        if (suppliers.length === 1) {
          try { localStorage.setItem(LS_ACTOR, suppliers[0].actor_id); } catch {}
          return suppliers[0].actor_id;
        }
        return prev;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando membresías');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!activeActorId) return;
    try {
      const count = await getUnreadNotificationCount(activeActorId);
      setUnreadCount(count);
    } catch {
      // silencioso: el badge simplemente no se actualiza
    }
  }, [activeActorId]);

  useEffect(() => {
    reloadMemberships();
  }, []);

  useEffect(() => {
    if (activeActorId) refreshUnread();
  }, [activeActorId]);

  const activeMembership = memberships.find((m) => m.actor_id === activeActorId) ?? null;

  return (
    <PortalContext.Provider value={{
      memberships,
      activeActorId,
      activeMembership,
      activeTab,
      unreadCount,
      loading,
      error,
      setActiveActorId,
      setActiveTab,
      reloadMemberships,
      refreshUnread,
    }}>
      {children}
    </PortalContext.Provider>
  );
}
