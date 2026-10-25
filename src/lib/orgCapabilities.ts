import { useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import type { TradeOrganization } from './supabase';

// Keywords that signal transport/logistics as the primary business activity.
// Checked against org.oficio (lowercase) as a fallback when transport_specialties is absent.
const TRANSPORT_OFICIO_KEYS = [
  'mudanzas', 'transporte', 'logística', 'logistica', 'logistic',
  'autocar', 'autobus', 'autobús', 'camión', 'camion',
];

function isTransportOficio(oficio: string): boolean {
  const lc = oficio.toLowerCase();
  return TRANSPORT_OFICIO_KEYS.some(k => lc.includes(k));
}

export interface OrgCapabilities {
  /** Transport module is accessible (authoritative server gate via transport_enabled). */
  hasTransport: boolean;
  /** Transport is the primary or sole business activity — show transport-only UI. */
  isTransportOrg: boolean;
  /** Installer trade work is a primary activity — show installer modules. */
  isInstallerOrg: boolean;
  /** Org has both transport and installer activities active. */
  isMixedOrg: boolean;
  /** Declared transport specialties (from transport_specialties column when populated). */
  transportSpecialties: string[];
}

/**
 * Derive org capabilities from database fields.
 * Pure function — safe to call on every render.
 *
 * Priority for transport detection:
 *   1. transport_specialties[] (explicit, requires future migration)
 *   2. oficio keyword match (fallback, works today)
 *   3. transport_enabled=false → no transport regardless
 */
export function getOrgCapabilities(org: TradeOrganization | null): OrgCapabilities {
  if (!org) {
    return {
      hasTransport: false,
      isTransportOrg: false,
      isInstallerOrg: true,
      isMixedOrg: false,
      transportSpecialties: [],
    };
  }

  const hasTransport = org.transport_enabled === true;

  // transport_specialties is a future column — cast safely; null/undefined → empty array
  type OrgWithSpecialties = TradeOrganization & { transport_specialties?: string[] };
  const specialties: string[] = (org as OrgWithSpecialties).transport_specialties ?? [];

  const transportOficio = isTransportOficio(org.oficio ?? '');
  // Transport is "primary" when explicitly declared (specialties) or oficio matches
  const isTransportPrimary = hasTransport && (specialties.length > 0 || transportOficio);
  const isMixedOrg = hasTransport && !isTransportPrimary;

  return {
    hasTransport,
    isTransportOrg: isTransportPrimary,
    // Installer when: not transport primary, OR mixed (both active)
    isInstallerOrg: !isTransportPrimary || isMixedOrg,
    isMixedOrg,
    transportSpecialties: specialties,
  };
}

/** React hook — recomputes when org changes. */
export function useOrgCapabilities(): OrgCapabilities {
  const { org } = useSession();
  return useMemo(() => getOrgCapabilities(org), [org]);
}
