import { supabase } from '../client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type MarketplaceActorType =
  | 'supplier'
  | 'brand'
  | 'logistics'
  | 'association'
  | 'platform'
  | 'partner'
  | 'any';

export type MarketplaceActorEstado =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'banned';

export type MarketplaceInvitationEstado =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'revoked';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface MarketplaceActorType_ {
  id: MarketplaceActorType;
  label: string;
  descripcion?: string | null;
  icono?: string | null;
  activo: boolean;
  posicion: number;
}

export interface MarketplaceActor {
  id: string;
  actor_type: MarketplaceActorType;
  nombre: string;
  slug: string;
  legal_name?: string | null;
  tax_id?: string | null;
  country: string;
  logo_url?: string | null;
  website?: string | null;
  email_contacto?: string | null;
  telefono?: string | null;
  estado: MarketplaceActorEstado;
  verificado: boolean;
  verificado_at?: string | null;
  supplier_catalog_id?: string | null;
  brand_id?: string | null;
  metadata: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceRole {
  id: string;
  actor_type: MarketplaceActorType;
  nombre: string;
  descripcion?: string | null;
  permissions: string[];
  is_system: boolean;
  priority: number;
  actor_id?: string | null;
  created_at: string;
}

export interface MarketplaceActorMember {
  id: string;
  actor_id: string;
  user_id: string;
  role_id: string;
  activo: boolean;
  invited_by?: string | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  last_accessed_at?: string | null;
  notas?: string | null;
  created_at: string;
  // Relaciones resueltas (join opcional)
  role?: MarketplaceRole;
  actor?: Pick<MarketplaceActor, 'id' | 'nombre' | 'slug' | 'actor_type' | 'logo_url' | 'estado' | 'verificado'>;
}

// token_hash no se expone al cliente. Usar v_marketplace_invitations_safe o los campos de abajo.
export interface MarketplaceInvitation {
  id: string;
  actor_id: string;
  role_id: string;
  email: string;
  estado: MarketplaceInvitationEstado;
  expires_at: string;
  invited_by?: string | null;
  created_at: string;
  // Relaciones resueltas (join opcional)
  role?: Pick<MarketplaceRole, 'id' | 'nombre' | 'priority'>;
  actor?: Pick<MarketplaceActor, 'id' | 'nombre' | 'slug'>;
}

export interface MarketplaceMyMembership {
  actor_id: string;
  actor_type: MarketplaceActorType;
  actor_nombre: string;
  actor_slug: string;
  actor_estado: MarketplaceActorEstado;
  actor_logo_url?: string | null;
  actor_verificado: boolean;
  member_id: string;
  role_id: string;
  role_nombre: string;
  role_priority: number;
  permissions: string[];
  activo: boolean;
  accepted_at?: string | null;
}

export interface MarketplaceAuditEvent {
  id: string;
  actor_id?: string | null;
  user_id?: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

// ── Mis membresías ────────────────────────────────────────────────────────────

export async function getMyMarketplaceMemberships(): Promise<MarketplaceMyMembership[]> {
  const { data, error } = await db.rpc('get_my_marketplace_memberships');
  if (error) throw error;
  return (data ?? []) as MarketplaceMyMembership[];
}

// ── Actores ───────────────────────────────────────────────────────────────────

export async function loadMarketplaceActor(idOrSlug: string): Promise<MarketplaceActor | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const q = db.from('trade_marketplace_actors').select('*');
  const { data, error } = await (isUuid ? q.eq('id', idOrSlug) : q.eq('slug', idOrSlug)).single();
  if (error) return null;
  return data as MarketplaceActor;
}

export async function loadMarketplaceActors(opts?: {
  type?: MarketplaceActorType;
  estado?: MarketplaceActorEstado;
  limit?: number;
  offset?: number;
}): Promise<MarketplaceActor[]> {
  let q = db.from('trade_marketplace_actors').select('*').order('nombre');
  if (opts?.type)   q = q.eq('actor_type', opts.type);
  if (opts?.estado) q = q.eq('estado', opts.estado);
  if (opts?.limit)  q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, (opts.offset ?? 0) + (opts.limit ?? 20) - 1);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketplaceActor[];
}

// ── Roles disponibles para un tipo de actor ───────────────────────────────────

export async function loadMarketplaceRoles(actorType: MarketplaceActorType): Promise<MarketplaceRole[]> {
  const { data, error } = await db
    .from('trade_marketplace_roles')
    .select('*')
    .in('actor_type', [actorType, 'any'])
    .is('actor_id', null)
    .eq('is_system', true)
    .order('priority', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MarketplaceRole[]).map((r) => ({
    ...r,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  }));
}

// ── Miembros de un actor ──────────────────────────────────────────────────────

export async function loadActorMembers(actorId: string): Promise<MarketplaceActorMember[]> {
  const { data, error } = await db
    .from('trade_marketplace_actor_members')
    .select(`
      *,
      role:trade_marketplace_roles(id, nombre, priority, permissions)
    `)
    .eq('actor_id', actorId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as MarketplaceActorMember[];
}

export async function updateMemberRole(memberId: string, roleId: string): Promise<void> {
  const { error } = await db
    .from('trade_marketplace_actor_members')
    .update({ role_id: roleId })
    .eq('id', memberId);
  if (error) throw error;
}

export async function deactivateMember(memberId: string): Promise<void> {
  const { error } = await db
    .from('trade_marketplace_actor_members')
    .update({ activo: false })
    .eq('id', memberId);
  if (error) throw error;
}

// ── Invitaciones ──────────────────────────────────────────────────────────────

// Devuelve el token bruto (mostrar una sola vez al invitante; nunca se almacena en BD).
// La inserción real ocurre en la RPC SECURITY DEFINER que almacena solo el SHA-256.
export async function createMarketplaceInvitation(params: {
  actorId: string;
  roleId: string;
  email: string;
}): Promise<{ rawToken: string }> {
  const { data, error } = await db.rpc('create_marketplace_invitation', {
    p_actor_id: params.actorId,
    p_role_id:  params.roleId,
    p_email:    params.email.toLowerCase().trim(),
  });
  if (error) throw error;
  return { rawToken: data as string };
}

export async function loadActorInvitations(actorId: string): Promise<MarketplaceInvitation[]> {
  const { data, error } = await db
    // v_marketplace_invitations_safe excluye token_hash
    .from('v_marketplace_invitations_safe')
    .select(`
      *,
      role:trade_marketplace_roles(id, nombre, priority)
    `)
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MarketplaceInvitation[];
}

export async function revokeMarketplaceInvitation(invitationId: string): Promise<void> {
  const { error } = await db
    .from('trade_marketplace_invitations')
    .update({ estado: 'revoked' })
    .eq('id', invitationId)
    .in('estado', ['pending', 'expired']);
  if (error) throw error;
}

// Reenviar invitación pendiente o expirada — devuelve nuevo rawToken (7 días más)
export async function resendMarketplaceInvitation(
  actorId: string,
  invitationId: string,
): Promise<{ rawToken: string }> {
  const { data, error } = await db.rpc('resend_supplier_invitation', {
    p_actor_id:      actorId,
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return { rawToken: data as string };
}

// ── RPC: aceptar invitación ───────────────────────────────────────────────────

export async function acceptMarketplaceInvitation(token: string): Promise<string> {
  const { data, error } = await db.rpc('accept_marketplace_invitation', { p_token: token });
  if (error) throw error;
  return data as string; // actor_id
}

// ── RPC: transferir ownership ─────────────────────────────────────────────────

export async function transferMarketplaceOwnership(
  actorId: string,
  newOwnerUserId: string,
): Promise<void> {
  const { error } = await db.rpc('transfer_marketplace_ownership', {
    p_actor_id:           actorId,
    p_new_owner_user_id:  newOwnerUserId,
  });
  if (error) throw error;
}

// ── Helpers de permisos (client-side, basados en membresías ya cargadas) ──────

export function hasPermission(
  membership: MarketplaceMyMembership | undefined,
  permission: string,
): boolean {
  if (!membership) return false;
  const perms = Array.isArray(membership.permissions) ? membership.permissions : [];
  return perms.includes(permission);
}

export function findMembershipForActor(
  memberships: MarketplaceMyMembership[],
  actorId: string,
): MarketplaceMyMembership | undefined {
  return memberships.find((m) => m.actor_id === actorId && m.activo);
}

export function isPlatformAdmin(memberships: MarketplaceMyMembership[]): boolean {
  return memberships.some(
    (m) =>
      m.actor_type === 'platform' &&
      m.activo &&
      ['platform_super_admin', 'admin'].includes(m.role_nombre),
  );
}

// ── RPC sin auth: preview de invitación ──────────────────────────────────────

export type InvitationPreviewEstado =
  | 'valid'
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'invalid_token';

export interface InvitationPreview {
  estado: InvitationPreviewEstado;
  actor_id?: string;
  actor_nombre?: string;
  role_nombre?: string;
  email?: string;
  expires_at?: string;
}

export async function previewMarketplaceInvitation(token: string): Promise<InvitationPreview> {
  const { data, error } = await db.rpc('preview_marketplace_invitation', { p_token: token });
  if (error) throw error;
  return data as InvitationPreview;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function loadActorAuditLog(
  actorId: string,
  opts?: { limit?: number; offset?: number },
): Promise<MarketplaceAuditEvent[]> {
  const limit  = opts?.limit  ?? 50;
  const offset = opts?.offset ?? 0;
  const { data, error } = await db
    .from('trade_marketplace_audit_log')
    .select('*')
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as MarketplaceAuditEvent[];
}

// ── Home: proveedores activos para la página principal ────────────────────────

export interface ActiveSupplier {
  id:         string;
  nombre:     string;
  slug:       string;
  logo_url:   string | null;
  verificado: boolean;
  metadata:   Record<string, unknown>;
}

export async function listActiveSuppliers(limit = 12): Promise<ActiveSupplier[]> {
  const { data, error } = await db
    .from('trade_marketplace_actors')
    .select('id, nombre, slug, logo_url, verificado, metadata')
    .eq('actor_type', 'supplier')
    .eq('estado', 'active')
    .order('nombre')
    .limit(limit);
  if (error) throw new Error(`[listActiveSuppliers] ${error.message}`);
  return (data ?? []) as ActiveSupplier[];
}
