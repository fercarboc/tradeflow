import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMyMarketplaceMemberships, MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import { getUnreadNotificationCount } from '../../lib/api/marketplace-portal';

export type PortalTab = 'dashboard' | 'catalogo' | 'pedidos' | 'equipo' | 'config';

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
  const [activeActorId, setActiveActorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyMarketplaceMemberships();
      const suppliers = data.filter((m) => m.actor_type === 'supplier' && m.activo);
      setMemberships(suppliers);
      if (activeActorId === null && suppliers.length === 1) {
        setActiveActorId(suppliers[0].actor_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando membresías');
    } finally {
      setLoading(false);
    }
  }, [activeActorId]);

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
