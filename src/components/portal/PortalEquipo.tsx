import React, { useEffect, useState } from 'react';
import { MarketplaceMyMembership, MarketplaceActorMember, MarketplaceRole } from '../../lib/api/marketplace-actors';
import {
  loadActorMembers, loadActorInvitations, loadMarketplaceRoles,
  createMarketplaceInvitation, revokeMarketplaceInvitation, deactivateMember,
  updateMemberRole, MarketplaceInvitation, hasPermission,
} from '../../lib/api/marketplace-actors';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
  onReload:   () => Promise<void>;
}

export default function PortalEquipo({ actorId, membership, onReload }: Props) {
  const [members,      setMembers]      = useState<MarketplaceActorMember[]>([]);
  const [invitations,  setInvitations]  = useState<MarketplaceInvitation[]>([]);
  const [roles,        setRoles]        = useState<MarketplaceRole[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showInvite,   setShowInvite]   = useState(false);
  const [rawToken,     setRawToken]     = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  const canInvite  = hasPermission(membership, 'members:invite');
  const canManage  = hasPermission(membership, 'members:manage');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, inv, r] = await Promise.all([
        loadActorMembers(actorId),
        loadActorInvitations(actorId),
        loadMarketplaceRoles('supplier'),
      ]);
      setMembers(m);
      setInvitations(inv);
      setRoles(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [actorId]);

  if (loading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  const pendingInvitations = invitations.filter((i) => i.estado === 'pending');

  return (
    <div className="min-h-full p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Equipo</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {members.filter((m) => m.activo).length} miembro{members.filter((m) => m.activo).length !== 1 ? 's' : ''} activo{members.filter((m) => m.activo).length !== 1 ? 's' : ''}
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => { setShowInvite(true); setRawToken(null); }}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            Invitar
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Miembros */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Miembros
        </h2>
        <div className="space-y-2">
          {members.filter((m) => m.activo).map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              roles={roles}
              isSelf={false}
              canManage={canManage}
              currentUserPriority={membership.role_priority}
              onUpdate={load}
            />
          ))}
        </div>
      </section>

      {/* Invitaciones pendientes */}
      {pendingInvitations.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Invitaciones pendientes
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <InvitationRow
                key={inv.id}
                invitation={inv}
                canManage={canManage}
                onRevoke={async () => {
                  await revokeMarketplaceInvitation(inv.id);
                  load();
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Modal de invitación */}
      {showInvite && (
        <InviteModal
          actorId={actorId}
          roles={roles}
          currentUserPriority={membership.role_priority}
          rawToken={rawToken}
          onInvited={(token) => { setRawToken(token); load(); }}
          onClose={() => { setShowInvite(false); setRawToken(null); }}
        />
      )}
    </div>
  );
}

interface MemberRowProps {
  member:               MarketplaceActorMember;
  roles:                MarketplaceRole[];
  isSelf:               boolean;
  canManage:            boolean;
  currentUserPriority:  number;
  onUpdate:             () => void;
}

function MemberRow({ member, roles, canManage, currentUserPriority, onUpdate }: MemberRowProps) {
  const [busy, setBusy] = useState(false);
  const memberPriority = member.role?.priority ?? 0;
  const canModify = canManage && memberPriority < currentUserPriority;

  const handleDeactivate = async () => {
    if (!canModify || busy) return;
    if (!confirm('¿Desactivar a este miembro?')) return;
    setBusy(true);
    try {
      await deactivateMember(member.id);
      onUpdate();
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (roleId: string) => {
    if (!canModify || busy) return;
    setBusy(true);
    try {
      await updateMemberRole(member.id, roleId);
      onUpdate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
        {(member.user_id ?? '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {member.user_id}
        </p>
        <p className="text-xs text-slate-400">
          Activo desde {member.accepted_at
            ? new Date(member.accepted_at).toLocaleDateString('es-ES')
            : '—'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {canModify ? (
          <select
            value={member.role_id}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={busy}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            {roles
              .filter((r) => r.priority < currentUserPriority)
              .map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
          </select>
        ) : (
          <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 capitalize">
            {member.role?.nombre ?? 'miembro'}
          </span>
        )}
        {canModify && (
          <button
            onClick={handleDeactivate}
            disabled={busy}
            className="rounded-md p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Desactivar miembro"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface InvitationRowProps {
  invitation: MarketplaceInvitation;
  canManage:  boolean;
  onRevoke:   () => void;
}

function InvitationRow({ invitation, canManage, onRevoke }: InvitationRowProps) {
  const [busy, setBusy] = useState(false);
  const expired = new Date(invitation.expires_at) < new Date();

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${expired ? 'border-slate-200 dark:border-slate-800 opacity-60' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{invitation.email}</p>
        <p className="text-xs text-slate-400">
          {invitation.role?.nombre ?? 'Rol desconocido'} · {expired ? 'Expirada' : `Expira ${new Date(invitation.expires_at).toLocaleDateString('es-ES')}`}
        </p>
      </div>
      {canManage && !expired && (
        <button
          onClick={async () => { setBusy(true); try { await onRevoke(); } finally { setBusy(false); } }}
          disabled={busy}
          className="text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          {busy ? '...' : 'Revocar'}
        </button>
      )}
    </div>
  );
}

interface InviteModalProps {
  actorId:             string;
  roles:               MarketplaceRole[];
  currentUserPriority: number;
  rawToken:            string | null;
  onInvited:           (token: string) => void;
  onClose:             () => void;
}

function InviteModal({ actorId, roles, currentUserPriority, rawToken, onInvited, onClose }: InviteModalProps) {
  const [email,   setEmail]   = useState('');
  const [roleId,  setRoleId]  = useState('');
  const [busy,    setBusy]    = useState(false);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  const availableRoles = roles.filter((r) => r.priority < currentUserPriority);

  useEffect(() => {
    if (availableRoles.length > 0 && !roleId) {
      setRoleId(availableRoles[availableRoles.length - 1].id);
    }
  }, [availableRoles.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !roleId || busy) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const { rawToken: token } = await createMarketplaceInvitation({
        actorId, roleId, email: email.trim(),
      });
      onInvited(token);
      setEmail('');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Error al crear invitación');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (!rawToken) return;
    navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Invitar miembro</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {rawToken ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                  ¡Invitación creada!
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Comparte este enlace de invitación. Solo es válido una vez y por 72 horas.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
                    {rawToken}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 transition-colors"
                  >
                    {copied ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => { setEmail(''); onClose(); }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 transition-colors"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Correo electrónico
                </label>
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
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Rol
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Seleccionar rol...</option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy || !email.trim() || !roleId}
                  className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
                >
                  {busy ? 'Enviando...' : 'Invitar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
