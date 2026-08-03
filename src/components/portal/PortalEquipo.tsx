import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import { hasPermission } from '../../lib/api/marketplace-actors';
import {
  AuditLogEntry, AuditLogPage, TeamInvitation, TeamMember, TeamMemberPage, TeamRole,
  createSupplierInvitation, deactivateTeamMember, getSupplierAuditLog,
  getSupplierInvitations, getSupplierRoles, getSupplierTeam,
  reactivateTeamMember, resendSupplierInvitation, revokeSupplierInvitation,
  updateTeamMemberRole,
} from '../../lib/api/marketplace-portal';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

type Tab = 'miembros' | 'invitaciones' | 'roles' | 'actividad';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Ahora mismo';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `Hace ${d} d`;
  return fmtDate(iso);
}

function initials(nombre: string, email: string): string {
  const n = nombre || email || '?';
  return n.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?';
}

function rolePriorityColor(priority: number): string {
  if (priority >= 100) return 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
  if (priority >= 80)  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
  if (priority >= 60)  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  if (priority >= 50)  return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
}

function invEstadoLabel(estado: string): string {
  switch (estado) {
    case 'pending':   return 'Pendiente';
    case 'accepted':  return 'Aceptada';
    case 'expired':   return 'Expirada';
    case 'cancelled': return 'Revocada';
    default:          return estado;
  }
}

function invEstadoColor(estado: string): string {
  switch (estado) {
    case 'pending':   return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'accepted':  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'expired':   return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'cancelled': return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    default:          return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
  }
}

function auditEventLabel(tipo: string): string {
  const map: Record<string, string> = {
    member_invited:      'Miembro invitado',
    member_joined:       'Miembro unido',
    member_deactivated:  'Miembro desactivado',
    member_reactivated:  'Miembro reactivado',
    member_role_changed: 'Rol cambiado',
    invitation_revoked:  'Invitación revocada',
    invitation_resent:   'Invitación reenviada',
  };
  return map[tipo] ?? tipo.replace(/_/g, ' ');
}

function auditEventColor(tipo: string): string {
  if (tipo.includes('deactivated') || tipo.includes('revoked'))
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (tipo.includes('reactivated') || tipo.includes('joined'))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15-6.7M20 15a9 9 0 0 1-15 6.7" />
    </svg>
  );
}

function IconBan() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      {dir === 'left'
        ? <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />}
    </svg>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

interface TabBarProps {
  active:   Tab;
  onChange: (t: Tab) => void;
  counts:   { invitaciones: number };
}

function TabBar({ active, onChange, counts }: TabBarProps) {
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'miembros',     label: 'Miembros' },
    { id: 'invitaciones', label: 'Invitaciones', badge: counts.invitaciones > 0 ? counts.invitaciones : undefined },
    { id: 'roles',        label: 'Roles' },
    { id: 'actividad',    label: 'Actividad' },
  ];
  return (
    <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
            active === t.id
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t.label}
          {t.badge !== undefined && (
            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 text-xs font-semibold leading-none">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre, email, activo }: { nombre: string; email: string; activo: boolean }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
      activo
        ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
        : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
    }`}>
      {initials(nombre, email)}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ── Empty ─────────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4 text-slate-400 dark:text-slate-500">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 max-w-xs">{subtitle}</p>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-slate-200 dark:bg-slate-800" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

interface PaginationProps {
  page:       number;
  pageSize:   number;
  total:      number;
  onPage:     (p: number) => void;
}

function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = page * pageSize + 1;
  const end   = Math.min((page + 1) * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <p className="text-xs text-slate-400">{start}–{end} de {total}</p>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        ><IconChevron dir="left" /></button>
        <span className="text-xs text-slate-500 tabular-nums">{page + 1} / {totalPages}</span>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
          className="rounded p-1 text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        ><IconChevron dir="right" /></button>
      </div>
    </div>
  );
}

// ── RoleSelect ────────────────────────────────────────────────────────────────

interface RoleSelectProps {
  value:      string;
  roles:      TeamRole[];
  maxPrio:    number;
  busy:       boolean;
  onChange:   (roleId: string) => void;
}

function RoleSelect({ value, roles, maxPrio, busy, onChange }: RoleSelectProps) {
  const available = roles.filter((r) => r.priority < maxPrio);
  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
    >
      {available.map((r) => (
        <option key={r.id} value={r.id}>{r.nombre}</option>
      ))}
    </select>
  );
}

// ── MemberRow ─────────────────────────────────────────────────────────────────

interface MemberRowProps {
  member:     TeamMember;
  selfMemberId: string;
  canManage:    boolean;
  callerPrio:   number;
  roles:        TeamRole[];
  onDeactivate:   () => Promise<void>;
  onReactivate:   () => Promise<void>;
  onRoleChange:   (roleId: string) => Promise<void>;
}

function MemberRow({
  member, selfMemberId, canManage, callerPrio, roles,
  onDeactivate, onReactivate, onRoleChange,
}: MemberRowProps) {
  const [busy, setBusy] = useState(false);
  const isSelf = member.id === selfMemberId;
  const canModify = canManage && member.role_priority < callerPrio && !isSelf;

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <tr className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!member.activo ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar nombre={member.nombre} email={member.email} activo={member.activo} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
              {member.nombre}
              {isSelf && <span className="ml-1.5 text-xs text-slate-400">(tú)</span>}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-[160px]">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {canModify ? (
          <RoleSelect
            value={member.role_id}
            roles={roles}
            maxPrio={callerPrio}
            busy={busy}
            onChange={(id) => act(() => onRoleChange(id))}
          />
        ) : (
          <Badge label={member.role_nombre} className={rolePriorityColor(member.role_priority)} />
        )}
      </td>
      <td className="px-4 py-3">
        <Badge
          label={member.activo ? 'Activo' : 'Inactivo'}
          className={member.activo
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}
        />
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
        {fmtRelative(member.last_accessed_at)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
        {fmtDate(member.accepted_at ?? member.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        {canModify && (
          member.activo ? (
            <button
              onClick={() => act(onDeactivate)}
              disabled={busy}
              title="Desactivar miembro"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <IconBan /><span>Desactivar</span>
            </button>
          ) : (
            <button
              onClick={() => act(onReactivate)}
              disabled={busy}
              title="Reactivar miembro"
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
            >
              <IconCheck /><span>Reactivar</span>
            </button>
          )
        )}
      </td>
    </tr>
  );
}

// ── InvitationRow ─────────────────────────────────────────────────────────────

interface InvitationRowProps {
  inv:       TeamInvitation;
  canInvite: boolean;
  onRevoke:  () => Promise<void>;
  onResend:  () => Promise<string>;
}

function InvitationRow({ inv, canInvite, onRevoke, onResend }: InvitationRowProps) {
  const [busy,     setBusy]     = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  const isExpired = new Date(inv.expires_at) < new Date();
  const canRevoke = canInvite && inv.estado === 'pending';
  const canResend = canInvite && (inv.estado === 'pending' || inv.estado === 'expired' || isExpired);

  const handleCopy = () => {
    if (!rawToken) return;
    const url = `${window.location.origin}/aceptar-invitacion?token=${rawToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-900 dark:text-slate-100 truncate max-w-[180px]">{inv.email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge label={inv.role_nombre} className={rolePriorityColor(inv.role_priority)} />
      </td>
      <td className="px-4 py-3">
        <Badge label={invEstadoLabel(inv.estado)} className={invEstadoColor(inv.estado)} />
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
        {inv.estado === 'pending' && !isExpired ? fmtDate(inv.expires_at) : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{fmtDate(inv.created_at)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {rawToken && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
            >
              <IconCopy />
              {copied ? '¡Copiado!' : 'Copiar enlace de invitación'}
            </button>
          )}
          {canResend && !rawToken && (
            <button
              disabled={busy}
              onClick={() => act(async () => {
                const token = await onResend();
                setRawToken(token);
              })}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors disabled:opacity-50"
              title="Reenviar invitación"
            >
              <IconRefresh /><span>Reenviar</span>
            </button>
          )}
          {canRevoke && (
            <button
              disabled={busy}
              onClick={() => act(onRevoke)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              title="Revocar invitación"
            >
              <IconBan /><span>Revocar</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── InviteModal ───────────────────────────────────────────────────────────────

interface InviteModalProps {
  actorId:    string;
  roles:      TeamRole[];
  callerPrio: number;
  onClose:    () => void;
  onCreated:  () => void;
}

function InviteModal({ actorId, roles, callerPrio, onClose, onCreated }: InviteModalProps) {
  const [email,    setEmail]    = useState('');
  const [roleId,   setRoleId]   = useState('');
  const [busy,     setBusy]     = useState(false);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  const available = roles.filter((r) => r.priority < callerPrio);

  useEffect(() => {
    if (available.length > 0 && !roleId) {
      setRoleId(available[available.length - 1].id);
    }
  }, [available.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !roleId || busy) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const { rawToken: token } = await createSupplierInvitation(actorId, email.trim(), roleId);
      setRawToken(token);
      onCreated();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Error al crear invitación');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (!rawToken) return;
    const url = `${window.location.origin}/aceptar-invitacion?token=${rawToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Invitar miembro</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          {rawToken ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">¡Invitación creada!</p>
                <p className="text-xs text-slate-500 mb-3">Comparte el enlace. Es válido una sola vez, durante 7 días.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                    {`${window.location.origin}/aceptar-invitacion?token=${rawToken}`}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 hover:border-teal-500 hover:text-teal-500 transition-colors"
                  >
                    {copied ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setRawToken(null); setEmail(''); }}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-600 hover:border-teal-500 hover:text-teal-500 transition-colors"
                >
                  Invitar a otro
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Rol</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Seleccionar rol...</option>
                  {available.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre} — {r.descripcion ?? ''}</option>
                  ))}
                </select>
              </div>
              {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-600 hover:border-slate-300 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={busy || !email.trim() || !roleId}
                  className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors">
                  {busy ? 'Enviando…' : 'Invitar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RoleCard ──────────────────────────────────────────────────────────────────

function RoleCard({ role }: { role: TeamRole }) {
  const PERM_LABELS: Record<string, string> = {
    'offerings:read':    'Ver catálogo',
    'offerings:write':   'Editar catálogo',
    'offerings:manage':  'Gestionar catálogo',
    'offerings:import':  'Importar catálogo',
    'orders:read':       'Ver pedidos',
    'orders:manage':     'Gestionar pedidos',
    'orders:fulfillment':'Gestión logística',
    'analytics:read':    'Ver analítica',
    'analytics:export':  'Exportar analítica',
    'billing:read':      'Ver facturación',
    'billing:manage':    'Gestionar facturación',
    'members:read':      'Ver equipo',
    'members:invite':    'Invitar miembros',
    'members:manage':    'Gestionar equipo',
    'config:read':       'Ver configuración',
    'config:write':      'Editar configuración',
    'actor:admin':       'Administración total',
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{role.nombre}</p>
          {role.descripcion && <p className="text-xs text-slate-400 mt-0.5">{role.descripcion}</p>}
        </div>
        <Badge label={`P${role.priority}`} className={rolePriorityColor(role.priority)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {role.permissions.map((p) => (
          <span key={p} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
            {PERM_LABELS[p] ?? p}
          </span>
        ))}
        {role.permissions.length === 0 && (
          <span className="text-xs text-slate-400">Sin permisos asignados</span>
        )}
      </div>
    </div>
  );
}

// ── AuditRow ──────────────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = Object.keys(entry.event_data ?? {}).length > 0;

  return (
    <div className="flex gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex flex-col items-center pt-1">
        <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
        <div className="w-px flex-1 bg-slate-100 dark:bg-slate-800 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge label={auditEventLabel(entry.event_type)} className={auditEventColor(entry.event_type)} />
            <span className="text-xs text-slate-500">{entry.user_email ?? entry.user_nombre}</span>
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap tabular-nums shrink-0">{fmtRelative(entry.created_at)}</span>
        </div>
        {hasData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {expanded ? 'Ocultar datos' : 'Ver datos'}
          </button>
        )}
        {expanded && hasData && (
          <pre className="mt-2 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 overflow-x-auto">
            {JSON.stringify(entry.event_data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Tab: Miembros ─────────────────────────────────────────────────────────────

interface MembersTabProps {
  actorId:      string;
  membership:   MarketplaceMyMembership;
  roles:        TeamRole[];
  selfMemberId: string;
}

function MembersTab({ actorId, membership, roles, selfMemberId }: MembersTabProps) {
  const PAGE_SIZE = 20;
  const [data,    setData]    = useState<TeamMemberPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<boolean | undefined>(undefined);
  const [page,    setPage]    = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canManage = hasPermission(membership, 'members:manage');

  const load = useCallback(async (s: string, f: boolean | undefined, p: number) => {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await getSupplierTeam(actorId, { search: s || undefined, activo: f, limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      setData(res);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(search, filter, page); }, [page]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(0); load(val, filter, 0); }, 350);
  };

  const handleFilter = (val: boolean | undefined) => {
    setFilter(val);
    setPage(0);
    load(search, val, 0);
  };

  const refresh = () => load(search, filter, page);

  const handleDeactivate = async (memberId: string) => {
    await deactivateTeamMember(actorId, memberId);
    await refresh();
  };

  const handleReactivate = async (memberId: string) => {
    await reactivateTeamMember(actorId, memberId);
    await refresh();
  };

  const handleRoleChange = async (memberId: string, roleId: string) => {
    await updateTeamMemberRole(actorId, memberId, roleId);
    await refresh();
  };

  const callerPrio = membership.role_priority;

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch /></span>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar miembro…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
          {([['Todos', undefined], ['Activos', true], ['Inactivos', false]] as [string, boolean | undefined][]).map(([label, val]) => (
            <button
              key={label}
              onClick={() => handleFilter(val)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                filter === val
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {errMsg && <div className="mx-6 mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">{errMsg}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              {['Miembro', 'Rol', 'Estado', 'Último acceso', 'Alta', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} cols={6} />)
              : data?.items.length === 0
                ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm14 7l-3-3m0 0l-3 3m3-3v9" /></svg>}
                        title="Sin miembros"
                        subtitle={search ? 'Prueba con otra búsqueda' : 'Invita a personas desde la pestaña Invitaciones'}
                      />
                    </td>
                  </tr>
                )
                : data?.items.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    selfMemberId={selfMemberId}
                    canManage={canManage}
                    callerPrio={callerPrio}
                    roles={roles}
                    onDeactivate={() => handleDeactivate(m.id)}
                    onReactivate={() => handleReactivate(m.id)}
                    onRoleChange={(roleId) => handleRoleChange(m.id, roleId)}
                  />
                ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.totalCount ?? 0}
        onPage={setPage}
      />
    </div>
  );
}

// ── Tab: Invitaciones ─────────────────────────────────────────────────────────

interface InvitationsTabProps {
  actorId:       string;
  membership:    MarketplaceMyMembership;
  roles:         TeamRole[];
  onCountChange: (n: number) => void;
}

function InvitationsTab({ actorId, membership, roles, onCountChange }: InvitationsTabProps) {
  const [items,   setItems]   = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const canInvite = hasPermission(membership, 'members:invite');
  const callerPrio = membership.role_priority;

  const load = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const data = await getSupplierInvitations(actorId);
      setItems(data);
      onCountChange(data.filter((i) => i.estado === 'pending').length);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Error al cargar invitaciones');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(); }, []);

  const handleRevoke = async (invId: string) => {
    await revokeSupplierInvitation(actorId, invId);
    await load();
  };

  const handleResend = async (invId: string): Promise<string> => {
    const { rawToken } = await resendSupplierInvitation(actorId, invId);
    await load();
    return rawToken;
  };

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <p className="text-sm text-slate-500">
          {items.filter((i) => i.estado === 'pending').length} pendiente{items.filter((i) => i.estado === 'pending').length !== 1 ? 's' : ''}
        </p>
        {canInvite && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            <IconPlus />
            Nueva invitación
          </button>
        )}
      </div>

      {errMsg && <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{errMsg}</div>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              {['Email', 'Rol', 'Estado', 'Expira', 'Enviada', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} cols={6} />)
              : items.length === 0
                ? (
                  <tr><td colSpan={6}>
                    <EmptyState
                      icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                      title="Sin invitaciones"
                      subtitle="Usa el botón Nueva invitación para añadir miembros al equipo"
                    />
                  </td></tr>
                )
                : items.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    inv={inv}
                    canInvite={canInvite}
                    onRevoke={() => handleRevoke(inv.id)}
                    onResend={() => handleResend(inv.id)}
                  />
                ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <InviteModal
          actorId={actorId}
          roles={roles}
          callerPrio={callerPrio}
          onClose={() => setShowModal(false)}
          onCreated={() => { load(); }}
        />
      )}
    </div>
  );
}

// ── Tab: Roles ────────────────────────────────────────────────────────────────

function RolesTab({ roles, loading }: { roles: TeamRole[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }
  return (
    <div className="p-6">
      <p className="text-xs text-slate-400 mb-4">Los roles del sistema definen qué puede hacer cada miembro del equipo proveedor.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {roles.slice().sort((a, b) => b.priority - a.priority).map((r) => (
          <RoleCard key={r.id} role={r} />
        ))}
      </div>
    </div>
  );
}

// ── Tab: Actividad ────────────────────────────────────────────────────────────

function ActivityTab({ actorId, membership }: { actorId: string; membership: MarketplaceMyMembership }) {
  const PAGE_SIZE = 30;
  const [data,    setData]    = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [page,    setPage]    = useState(0);

  const canView = hasPermission(membership, 'members:manage');

  const load = useCallback(async (p: number) => {
    if (!canView) return;
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await getSupplierAuditLog(actorId, { limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      setData(res);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Error al cargar actividad');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(page); }, [page]);

  if (!canView) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
          title="Acceso restringido"
          subtitle="Solo los gestores y superiores pueden ver el log de actividad del equipo"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <p className="text-sm text-slate-500">Historial de cambios en el equipo</p>
      </div>

      {errMsg && <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{errMsg}</div>}

      <div className="px-6 py-4">
        {loading
          ? <div className="space-y-4 animate-pulse">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 rounded bg-slate-200 dark:bg-slate-800" />)}</div>
          : data?.items.length === 0
            ? (
              <EmptyState
                icon={<svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                title="Sin actividad registrada"
                subtitle="Los cambios en el equipo aparecerán aquí"
              />
            )
            : <div>{data?.items.map((e) => <AuditRow key={e.id} entry={e} />)}</div>}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.totalCount ?? 0} onPage={(p) => { setPage(p); }} />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PortalEquipo({ actorId, membership }: Props) {
  const [tab,           setTab]           = useState<Tab>('miembros');
  const [roles,         setRoles]         = useState<TeamRole[]>([]);
  const [rolesLoading,  setRolesLoading]  = useState(true);
  const [pendingInvCount, setPendingInvCount] = useState(0);

  const selfMemberId = membership.member_id;
  const canInvite  = hasPermission(membership, 'members:invite');

  useEffect(() => {
    getSupplierRoles(actorId)
      .then(setRoles)
      .finally(() => setRolesLoading(false));
  }, [actorId]);

  return (
    <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Equipo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de acceso y permisos</p>
        </div>
        {canInvite && tab !== 'invitaciones' && (
          <button
            onClick={() => setTab('invitaciones')}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            <IconPlus />
            Invitar
          </button>
        )}
      </div>

      {/* Tabs */}
      <TabBar
        active={tab}
        onChange={setTab}
        counts={{ invitaciones: pendingInvCount }}
      />

      {/* Content */}
      <div className="flex-1 bg-white dark:bg-slate-900">
        {tab === 'miembros' && (
          <MembersTab
            key={actorId}
            actorId={actorId}
            membership={membership}
            roles={roles}
            selfMemberId={selfMemberId}
          />
        )}
        {tab === 'invitaciones' && (
          <InvitationsTab
            key={actorId}
            actorId={actorId}
            membership={membership}
            roles={roles}
            onCountChange={setPendingInvCount}
          />
        )}
        {tab === 'roles' && (
          <RolesTab roles={roles} loading={rolesLoading} />
        )}
        {tab === 'actividad' && (
          <ActivityTab key={actorId} actorId={actorId} membership={membership} />
        )}
      </div>
    </div>
  );
}
