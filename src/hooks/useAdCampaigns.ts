// Hook para campañas publicitarias del Marketplace.
// Envuelve getActiveCampaigns() con estado React (loading, error, datos).
//
// Reglas:
//   - Render inmediato con datos demo, reemplaza con BD cuando resuelve la RPC.
//   - 1 llamada bulk por mount (sin N+1).
//   - stable key = slotIds.sort().join(',') — no re-fetches si el array cambia pero el contenido no.
//   - Expone getCampaign(slotId) para lookup en O(1).

import { useState, useEffect, useRef } from 'react';
import type { AdSlotId, AdCampaign } from '../lib/marketplace-ad-types';
import { getActiveCampaigns } from '../lib/api/marketplace-ads';

export interface UseAdCampaignsResult {
  campaigns: Map<string, AdCampaign>;
  loading:   boolean;
  error:     Error | null;
  getCampaign: (slotId: AdSlotId) => AdCampaign | undefined;
}

export function useAdCampaigns(slotIds: readonly AdSlotId[]): UseAdCampaignsResult {
  const stableKey = [...slotIds].sort().join(',');

  const [campaigns, setCampaigns] = useState<Map<string, AdCampaign>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<Error | null>(null);
  const prevKey = useRef<string>('');

  useEffect(() => {
    if (slotIds.length === 0) {
      setLoading(false);
      return;
    }

    // Solo re-fetch si los slots cambian
    if (prevKey.current === stableKey) return;
    prevKey.current = stableKey;

    let cancelled = false;
    setLoading(true);

    getActiveCampaigns(slotIds)
      .then(result => {
        if (cancelled) return;
        setCampaigns(result);
        setError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        // campaigns conserva lo que haya (demo fallback o caché)
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableKey]);

  const getCampaign = (slotId: AdSlotId): AdCampaign | undefined =>
    campaigns.get(slotId);

  return { campaigns, loading, error, getCampaign };
}
