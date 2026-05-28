import React, { useState, useEffect } from 'react';
import { Users, UserPlus, X, Shield, Trash2, Mail } from 'lucide-react';
import { supabase, loadOrgMembers, updateMemberRol, revokeMember } from '../lib/supabase';
import type { OrgMember } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import type { Rol } from '../context/SessionContext';

const ROL_META: Record<string, { label: string; badge: string }> = {
  owner:        { label: 'Propietario', badge: 'bg-amber-100 text-amber-700 border border-amber-200' },
  admin:        { label: 'Admin',       badge: 'bg-purple-100 text-purple-700 border border-purple-200' },
  comercial:    { label: 'Comercial',   badge: 'bg-blue-100 text-blue-700 border border-blue-200' },
  tecnico:      { label: 'Técnico',     badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  visualizador: { label: 'Visualizador',badge: 'bg-slate-100 text-slate-600 border border-slate-200' },
};

const INVITABLE_ROLES: { value: Rol; label: string }[] = [
  { value: 'admin',        label: 'Admin' },
  { value: 'comercial',    label: 'Comercial' },
  { value: 'tecnico',      label: 'Técnico' },
  { value: 'visualizador', label: 'Visualizador' },
];

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

export default function ScreenEquipo({ showToast }: Props) {
  const { user, org, rol: myRol } = useSession();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRol, setInviteRol] = useState<Rol>('tecnico');
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canManage = myRol === 'owner' || myRol === 'admin';

  useEffect(() => {
    if (!org) return;
    loadOrgMembers(org.id)
      .then(setMembers)
      .catch(() => showToast('Error cargando equipo', 'error'))
      .finally(() => setLoading(false));
  }, [org]);

  async function handleInvite() {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('send-invite', {
        body: { email: inviteEmail.trim().toLowerCase(), rol: inviteRol, org_id: org.id },
      });
      if (error) throw new Error(error.message);
      showToast('Invitación enviada', 'success');
      setInviteOpen(false);
      setInviteEmail('');
      const updated = await loadOrgMembers(org.id);
      setMembers(updated);
    } catch (e) {
      showToast((e as Error).message ?? 'Error al invitar', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRol(memberId: string, newRol: Rol) {
    try {
      await updateMemberRol(memberId, newRol);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, rol: newRol } : m));
      setEditingId(null);
      showToast('Rol actualizado', 'success');
    } catch {
      showToast('Error actualizando rol', 'error');
    }
  }

  async function handleRevoke(memberId: string, email: string) {
    if (!confirm(`Revocar acceso a ${email}?`)) return;
    setRevoking(memberId);
    try {
      await revokeMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      showToast('Acceso revocado', 'info');
    } catch {
      showToast('Error revocando acceso', 'error');
    } finally {
      setRevoking(null);
    }
  }

  const initials = (email: string) => email.slice(0, 2).toUpperCase();

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length + 1} miembro{members.length !== 0 ? 's' : ''}</p>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Invitar miembro
          </button>
        )}
      </div>

      {/* Lista de miembros */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

        {/* Fila del propietario */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
            {initials(user?.email ?? 'TF')}
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.email}</p>
            <p className="text-xs text-slate-400">Tú</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROL_META.owner.badge}`}>
            {ROL_META.owner.label}
          </span>
          <span className="text-xs text-emerald-600 font-medium w-16 text-right">Activo</span>
        </div>

        {/* Miembros invitados */}
        {loading && (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">Cargando equipo...</div>
        )}
        {!loading && members.length === 0 && (
          <div className="px-5 py-10 text-center">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No hay miembros invitados.</p>
            <p className="text-xs text-slate-400 mt-1">Invita a tu equipo para colaborar juntos.</p>
          </div>
        )}
        {members.map((m, idx) => {
          const meta = ROL_META[m.rol] ?? ROL_META.visualizador;
          const isLast = idx === members.length - 1;
          return (
            <div
              key={m.id}
              className={`flex items-center gap-4 px-5 py-4 ${!isLast ? 'border-b border-slate-100' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                {initials(m.email ?? '??')}
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{m.email}</p>
                <p className="text-xs text-slate-400">{m.activo ? 'Activo' : 'Invitación pendiente'}</p>
              </div>

              {editingId === m.id ? (
                <select
                  autoFocus
                  defaultValue={m.rol}
                  onChange={e => handleChangeRol(m.id, e.target.value as Rol)}
                  onBlur={() => setEditingId(null)}
                  className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 cursor-pointer focus:outline-none focus:border-blue-500"
                >
                  {INVITABLE_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => canManage && setEditingId(m.id)}
                  disabled={!canManage}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge} ${canManage ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                  title={canManage ? 'Click para cambiar rol' : undefined}
                >
                  {meta.label}
                </button>
              )}

              <span className={`text-xs font-medium w-20 text-right ${m.activo ? 'text-emerald-600' : 'text-amber-600'}`}>
                {m.activo ? 'Activo' : 'Pendiente'}
              </span>

              {canManage && (
                <button
                  onClick={() => handleRevoke(m.id, m.email ?? '')}
                  disabled={revoking === m.id}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Revocar acceso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel informativo de roles */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p><strong className="text-purple-600">Admin:</strong> <span className="text-slate-600">Acceso completo excepto suscripción y ajustes de empresa.</span></p>
          <p><strong className="text-blue-600">Comercial:</strong> <span className="text-slate-600">Crea presupuestos y gestiona clientes. Sin facturas.</span></p>
          <p><strong className="text-emerald-600">Técnico:</strong> <span className="text-slate-600">Solo ve sus trabajos asignados en el planificador.</span></p>
          <p><strong className="text-slate-500">Visualizador:</strong> <span className="text-slate-500">Solo lectura, sin crear ni editar nada.</span></p>
        </div>
      </div>

      {/* Modal de invitación */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-slate-900 font-bold text-base">Invitar miembro</h3>
              <button onClick={() => setInviteOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                    onKeyDown={e => e.key === 'Enter' && handleInvite()}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Rol
                </label>
                <select
                  value={inviteRol}
                  onChange={e => setInviteRol(e.target.value as Rol)}
                  className="w-full bg-white border border-slate-300 rounded-lg text-slate-900 text-sm px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {INVITABLE_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setInviteOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {inviting ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
