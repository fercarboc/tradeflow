import { supabase } from './supabase';
import type { MarketplaceMyMembership } from './api/marketplace-actors';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface InstallerWorkspace {
  type: 'installer_org';
  id: string;
  name: string;
  role: string;
  isOnboarded: boolean;
}

export interface SupplierWorkspace {
  type: 'marketplace_actor';
  id: string;
  name: string;
  logoUrl: string | null;
  actorType: string;
  actorEstado: string;
  roleName: string;
  activo: boolean;
}

export type AnyWorkspace = InstallerWorkspace | SupplierWorkspace;

export interface ResolvedWorkspaces {
  installers: InstallerWorkspace[];
  suppliers: SupplierWorkspace[];
}

// ── LocalStorage ──────────────────────────────────────────────────────────────

const LS_KEY = 'trabflow_last_workspace';

export function rememberWorkspace(ws: { type: string; id: string }): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ws)); } catch {}
}

export function getRememberedWorkspace(): { type: string; id: string } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.type !== 'string' || typeof parsed?.id !== 'string') return null;
    return parsed as { type: string; id: string };
  } catch { return null; }
}

export function clearRememberedWorkspace(): void {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

export function isRememberedWorkspaceValid(
  remembered: { type: string; id: string },
  resolved: ResolvedWorkspaces,
): boolean {
  if (remembered.type === 'installer_org') {
    return resolved.installers.some(i => i.id === remembered.id);
  }
  if (remembered.type === 'marketplace_actor') {
    return resolved.suppliers.some(
      s => s.id === remembered.id && s.activo && s.actorEstado === 'active',
    );
  }
  return false;
}

// ── Resolución principal ──────────────────────────────────────────────────────

export async function resolveWorkspaces(userId: string): Promise<ResolvedWorkspaces> {
  const [installersResult, suppliersResult] = await Promise.allSettled([
    loadInstallerWorkspaces(userId),
    loadSupplierWorkspaces(),
  ]);

  return {
    installers: installersResult.status === 'fulfilled' ? installersResult.value : [],
    suppliers:  suppliersResult.status === 'fulfilled'  ? suppliersResult.value  : [],
  };
}

async function loadInstallerWorkspaces(userId: string): Promise<InstallerWorkspace[]> {
  const seen = new Set<string>();
  const result: InstallerWorkspace[] = [];

  // Organizaciones propias (owner)
  const { data: owned } = await supabase
    .from('trade_organizations')
    .select('id, nombre, is_onboarded')
    .eq('owner_id', userId);

  for (const org of (owned ?? []) as { id: string; nombre: string; is_onboarded: boolean }[]) {
    if (!seen.has(org.id)) {
      seen.add(org.id);
      result.push({
        type: 'installer_org',
        id: org.id,
        name: org.nombre,
        role: 'owner',
        isOnboarded: !!org.is_onboarded,
      });
    }
  }

  // Miembro activo de otra org (no owner)
  const { data: memberRows } = await supabase
    .from('trade_org_members')
    .select('org_id, rol')
    .eq('user_id', userId)
    .eq('activo', true);

  const extraOrgIds = ((memberRows ?? []) as { org_id: string; rol: string }[])
    .map(m => m.org_id)
    .filter(id => !seen.has(id));

  if (extraOrgIds.length > 0) {
    const { data: extraOrgs } = await supabase
      .from('trade_organizations')
      .select('id, nombre, is_onboarded')
      .in('id', extraOrgIds);

    for (const org of (extraOrgs ?? []) as { id: string; nombre: string; is_onboarded: boolean }[]) {
      if (!seen.has(org.id)) {
        seen.add(org.id);
        const row = ((memberRows ?? []) as { org_id: string; rol: string }[])
          .find(m => m.org_id === org.id);
        result.push({
          type: 'installer_org',
          id: org.id,
          name: org.nombre,
          role: row?.rol ?? 'member',
          isOnboarded: !!org.is_onboarded,
        });
      }
    }
  }

  return result;
}

async function loadSupplierWorkspaces(): Promise<SupplierWorkspace[]> {
  // Usa el cliente principal (lib/supabase.ts) para garantizar que la sesión en memoria
  // es la misma que recibió el evento SIGNED_IN. Un segundo cliente (lib/client.ts) tiene
  // su propio estado de sesión y puede estar sin auth en el momento de este callback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_my_marketplace_memberships');
  console.log('[PZ_ROUTING] loadSupplierWorkspaces RPC result', {
    count: (data ?? []).length,
    error: error?.message ?? null,
    actors: ((data ?? []) as MarketplaceMyMembership[]).map(m => ({
      id: m.actor_id,
      nombre: m.actor_nombre,
      activo: m.activo,
      estado: m.actor_estado,
    })),
  });
  if (error) {
    console.error('[PZ_ROUTING] loadSupplierWorkspaces RPC error', error);
    return [];
  }
  const memberships = (data ?? []) as MarketplaceMyMembership[];
  return memberships
    .filter(m => m.activo && m.actor_estado === 'active')
    .map(m => ({
      type: 'marketplace_actor' as const,
      id: m.actor_id,
      name: m.actor_nombre,
      logoUrl: m.actor_logo_url ?? null,
      actorType: m.actor_type,
      actorEstado: m.actor_estado,
      roleName: m.role_nombre,
      activo: m.activo,
    }));
}
