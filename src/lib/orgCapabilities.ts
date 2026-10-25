import { useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import type { TradeOrganization } from './supabase';

// Keywords that signal transport/logistics as the primary business activity.
// Used as a fallback when transport_modalidad column is absent (pre-migration).
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
  /**
   * BC alias for transportServiceTypes.
   * @deprecated Use transportServiceTypes for new code.
   */
  transportSpecialties: string[];
  /** Primary transport modality declared during onboarding (viajeros/mercancias/reparto/combinada). */
  transportModalidad: string | null;
  /** Specific services offered within the modality (e.g. excursiones, traslados). */
  transportServiceTypes: string[];
  /**
   * Explicit entitlement level set only by admin (never inferred from Stripe absence).
   * Values: 'none' | 'demo' | 'pilot' | 'production'
   */
  transportLicense: string;
  /**
   * True only when transport_license === 'demo'.
   * NOT derived from subscription.stripe_customer_id or trial status.
   */
  isTransportDemo: boolean;
}

/**
 * Derive org capabilities from database fields.
 * Pure function — safe to call on every render.
 *
 * Transport detection priority:
 *   1. transport_modalidad !== null (explicit — set during transport onboarding)
 *   2. oficio keyword match (fallback for pre-onboarding orgs, e.g. DEMO T1 'mudanzas')
 *   3. transport_enabled === false → no transport access regardless of oficio
 *
 * CIRCULAR DEPENDENCY NOTE:
 *   transport_enabled is protected by trg_protect_transport_enabled (server trigger).
 *   A new company cannot self-enable transport; it requires admin authorization.
 *   New transport companies go through the installer wizard first, then admin activates
 *   transport_enabled. Only then does TransportOnboardingWizard become accessible.
 *   Selection of transport activity in onboarding stores to transport_modalidad/oficio
 *   but does NOT modify transport_enabled — these are separate concerns.
 */
export function getOrgCapabilities(org: TradeOrganization | null): OrgCapabilities {
  if (!org) {
    return {
      hasTransport: false,
      isTransportOrg: false,
      isInstallerOrg: true,
      isMixedOrg: false,
      transportSpecialties: [],
      transportModalidad: null,
      transportServiceTypes: [],
      transportLicense: 'none',
      isTransportDemo: false,
    };
  }

  const hasTransport = org.transport_enabled === true;
  const modalidad = org.transport_modalidad ?? null;
  const serviceTypes: string[] = org.transport_service_types ?? [];
  const license = org.transport_license ?? 'none';

  const transportOficio = isTransportOficio(org.oficio ?? '');
  // Transport is "primary" when explicitly declared (modalidad) or oficio keyword matches
  const isTransportPrimary = hasTransport && (modalidad !== null || transportOficio);
  const isMixedOrg = hasTransport && !isTransportPrimary;

  return {
    hasTransport,
    isTransportOrg: isTransportPrimary,
    isInstallerOrg: !isTransportPrimary || isMixedOrg,
    isMixedOrg,
    transportSpecialties: serviceTypes,
    transportModalidad: modalidad,
    transportServiceTypes: serviceTypes,
    transportLicense: license,
    isTransportDemo: license === 'demo',
  };
}

/** React hook — recomputes when org changes. */
export function useOrgCapabilities(): OrgCapabilities {
  const { org } = useSession();
  return useMemo(() => getOrgCapabilities(org), [org]);
}
