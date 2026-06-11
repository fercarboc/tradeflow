import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, X, Shield, Trash2, Mail, Check, Minus,
  FileText, Receipt, BookUser, Package, Calendar, BarChart2,
  Settings, Wrench, StickyNote, ChevronDown,
} from 'lucide-react';
import { supabase, loadOrgMembers, updateMemberRol, revokeMember } from '../lib/supabase';
import type { OrgMember } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import type { Rol } from '../context/SessionContext';

// ─── Permisos detallados por rol ────────────────────────────────────────────

interface FeaturePerm {
  label: string;
  icon: React.ReactNode;
  admin: boolean | 'partial';
  oficina: boolean | 'partial';
  comercial: boolean | 'partial';
  tecnico: boolean | 'partial';
  visualizador: boolean | 'partial';
}

const FEATURES: FeaturePerm[] = [
  { label: 'Facturas',       icon: <Receipt className="w-3.5 h-3.5" />,   admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Presupuestos',   icon: <FileText className="w-3.5 h-3.5" />,  admin: true,      oficina: true,      comercial: true,      tecnico: false,     visualizador: false },
  { label: 'Clientes CRM',   icon: <BookUser className="w-3.5 h-3.5" />,  admin: true,      oficina: true,      comercial: true,      tecnico: false,     visualizador: false },
  { label: 'Catálogo',       icon: <Package className="w-3.5 h-3.5" />,   admin: true,      oficina: true,      comercial: false,     tecnico: 'partial', visualizador: false },
  { label: 'Planificación',  icon: <Calendar className="w-3.5 h-3.5" />,  admin: true,      oficina: true,      comercial: false,     tecnico: 'partial', visualizador: 'partial' },
  { label: 'Ingresos',       icon: <BarChart2 className="w-3.5 h-3.5" />, admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Equipo',         icon: <Users className="w-3.5 h-3.5" />,     admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Mantenimiento',  icon: <Wrench className="w-3.5 h-3.5" />,   admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Ajustes empresa',icon: <Settings className="w-3.5 h-3.5" />, admin: true,      oficina: false,     comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Notas de campo', icon: <StickyNote className="w-3.5 h-3.5" />,admin: true,      oficina: false,     comercial: false,     tecnico: true,      visualizador: false },
];

const ROL_DEFS: Record<Exclude<Rol, 'owner'>, {
  label: string;
  tagline: string;
  badge: string;
  accent: string;
  bg: string;
  note?: string;
}> = {
  admin: {
    label: 'Admin',
    tagline: 'Igual que el propietario',
    badge: 'bg-purple-100 text-purple-700 border border-purple-200',
    accent: 'border-purple-500 bg-purple-50',
    bg: 'bg-purple-500',
    note: 'Acceso total excepto gestión de suscripción.',
  },
  oficina: {
    label: 'Oficina',
    tagline: 'Todo el trabajo diario',
    badge: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    accent: 'border-indigo-500 bg-indigo-50',
    bg: 'bg-indigo-500',
    note: 'Puede facturar, presupuestar y gestionar equipo. Sin acceso a ajustes de empresa ni suscripción.',
  },
  comercial: {
    label: 'Comercial',
    tagline: 'Presupuestos y clientes',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    accent: 'border-blue-500 bg-blue-50',
    bg: 'bg-blue-500',
    note: 'Crea y edita presupuestos, gestiona clientes. No ve facturas ni trabajos.',
  },
  tecnico: {
    label: 'Técnico de campo',
    tagline: 'Sólo sus trabajos asignados',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    accent: 'border-emerald-500 bg-emerald-50',
    bg: 'bg-emerald-500',
    note: 'Ve y completa sus trabajos asignados, consulta catálogo y añade notas de campo. No factura ni presupuesta.',
  },
  visualizador: {
    label: 'Visualizador',
    tagline: 'Solo lectura',
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    accent: 'border-slate-400 bg-slate-50',
    bg: 'bg-slate-400',
    note: 'Puede ver los trabajos planificados. Sin editar ni crear nada.',
  },
};

const INVITABLE_ROLES = Object.keys(ROL_DEFS) as Exclude<Rol, 'owner'>[];

function PermIcon({ val }: { val: boolean | 'partial' }) {
  if (val === true)    return <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-emerald-600" /></span>;
  if (val === 'partial') return <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Minus className="w-3 h-3 text-amber-600" /></span>;
  return <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><X className="w-3 h-3 text-slate-400" /></span>;
}

function RolePermDetail({ rol }: { rol: Exclude<Rol, 'owner'> }) {
  const def = ROL_DEFS[rol];
  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${def.accent}`}>
      <div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${def.badge}`}>{def.label}</span>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">{def.note}</p>
      </div>
      <div className="space-y-1.5">
        {FEATURES.map(f => {
          const perm = f[rol];
          return (
            <div key={f.label} className="flex items-center gap-2.5">
              <PermIcon val={perm} />
              <span className={`flex items-center gap-1.5 text-xs ${perm ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                {f.icon}
                {f.label}
                {perm === 'partial' && <span className="text-[10px] text-amber-600 font-normal">(parcial)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

export default function ScreenEquipo({ showToast }: Props) {
  const { user, org, rol: myRol, subscription } = useSession();

  const PLAN_MEMBER_LIMITS: Record<string, number> = { basico: 0, profesional: 0, empresa: 5, empresa_plus: 15 };
  const memberLimit = PLAN_MEMBER_LIMITS[subscription?.plan ?? 'basico'] ?? 0;

  const [members, setMembers]       = useState<OrgMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRol, setInviteRol]   = useState<Exclude<Rol, 'owner'>>('oficina');
  const [inviting, setInviting]     = useState(false);
  const [revoking, setRevoking]     = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [infoRol, setInfoRol]       = useState<Exclude<Rol, 'owner'>>('oficina');

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
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { email: inviteEmail.trim().toLowerCase(), rol: inviteRol, org_id: org.id },
      });
      if (error) throw new Error(error.message);
      if (data?.plan_restriction) {
        showToast(data.error ?? 'Tu plan no permite más miembros', 'error');
        setInviteOpen(false);
        return;
      }
      showToast('Invitación enviada ✓', 'success');
      setInviteOpen(false);
      setInviteEmail('');
      const updated = await loadOrgMembers(org.id);
      setMembers(updated);
    } catch (e: unknown) {
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
    if (!confirm(`¿Revocar acceso a ${email}?`)) return;
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
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{members.length + 1} miembro{members.length !== 0 ? 's' : ''}</p>
          {memberLimit > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{members.length}/{memberLimit} miembros adicionales usados</p>
          )}
          {memberLimit === 0 && canManage && (
            <p className="text-xs text-amber-500 mt-0.5">Tu plan no permite miembros adicionales</p>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            disabled={memberLimit === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            title={memberLimit === 0 ? 'Actualiza a Plan Empresa para añadir miembros' : undefined}
          >
            <UserPlus className="w-4 h-4" />
            Invitar miembro
          </button>
        )}
      </div>

      {/* Lista de miembros */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Propietario */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0">
            {initials(user?.email ?? 'TF')}
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.email}</p>
            <p className="text-xs text-slate-400">Tú · Propietario</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Propietario</span>
          <span className="text-xs text-emerald-600 font-medium w-16 text-right">Activo</span>
        </div>

        {loading && <div className="px-5 py-8 text-center text-slate-400 text-sm">Cargando equipo...</div>}
        {!loading && members.length === 0 && (
          <div className="px-5 py-10 text-center">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No hay miembros invitados.</p>
            <p className="text-xs text-slate-400 mt-1">Invita a tu equipo para colaborar juntos.</p>
          </div>
        )}
        {members.map((m, idx) => {
          const def = ROL_DEFS[m.rol as Exclude<Rol, 'owner'>];
          const isLast = idx === members.length - 1;
          return (
            <div key={m.id} className={`flex items-center gap-4 px-5 py-4 ${!isLast ? 'border-b border-slate-100' : ''}`}>
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                {initials(m.email ?? '??')}
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{m.email}</p>
                <p className="text-xs text-slate-400">{def?.tagline ?? m.rol} · {m.activo ? 'Activo' : 'Invitación pendiente'}</p>
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
                    <option key={r} value={r}>{ROL_DEFS[r].label}</option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => canManage && setEditingId(m.id)}
                  disabled={!canManage}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${def?.badge ?? 'bg-slate-100 text-slate-600 border border-slate-200'} ${canManage ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} flex items-center gap-1`}
                  title={canManage ? 'Click para cambiar rol' : undefined}
                >
                  {def?.label ?? m.rol}
                  {canManage && <ChevronDown className="w-3 h-3 opacity-60" />}
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

      {/* ── Tabla de permisos por rol ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-bold text-slate-700 uppercase tracking-wide text-xs">Permisos por rol</p>
        </div>

        {/* Selector de rol a consultar (móvil) */}
        <div className="flex gap-1.5 flex-wrap md:hidden">
          {INVITABLE_ROLES.map(r => (
            <button
              key={r}
              onClick={() => setInfoRol(r)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer border ${infoRol === r ? ROL_DEFS[r].badge + ' shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}
            >
              {ROL_DEFS[r].label}
            </button>
          ))}
        </div>
        <div className="md:hidden">
          <RolePermDetail rol={infoRol} />
        </div>

        {/* Tabla desktop */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[10px] w-40">Función</th>
                {INVITABLE_ROLES.map(r => (
                  <th key={r} className="px-3 py-3 text-center">
                    <div className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${ROL_DEFS[r].badge}`}>{ROL_DEFS[r].label}</div>
                    <p className="text-[9px] text-slate-400 font-normal mt-1 leading-tight">{ROL_DEFS[r].tagline}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {FEATURES.map(f => (
                <tr key={f.label} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-600 font-medium flex items-center gap-2">
                    <span className="text-slate-400">{f.icon}</span>
                    {f.label}
                  </td>
                  {INVITABLE_ROLES.map(r => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      <div className="flex justify-center">
                        <PermIcon val={f[r]} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-100">
                <td className="px-4 py-2 text-[10px] text-slate-400 italic" colSpan={6}>
                  ✓ Acceso completo &nbsp;·&nbsp; <span className="text-amber-600">— Parcial</span> &nbsp;·&nbsp; <span className="text-slate-300">✗ Sin acceso</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modal invitación ─────────────────────────────────────────────────── */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <h3 className="text-slate-900 font-bold text-base">Invitar miembro al equipo</h3>
              <button onClick={() => setInviteOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

              {/* Left: email + role selector */}
              <div className="flex flex-col gap-5 p-6 flex-1 overflow-y-auto">

                {/* Email */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
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

                {/* Role cards */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Rol</label>
                  <div className="space-y-2">
                    {INVITABLE_ROLES.map(r => {
                      const def = ROL_DEFS[r];
                      const selected = inviteRol === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setInviteRol(r)}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${selected ? def.accent + ' shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${def.badge}`}>{def.label}</span>
                              <p className="text-xs text-slate-500 mt-1">{def.tagline}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? `${def.bg} border-transparent` : 'border-slate-300'}`}>
                              {selected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Right: permissions detail */}
              <div className="hidden md:flex flex-col p-6 border-l border-slate-100 w-64 shrink-0 overflow-y-auto bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Permisos del rol</p>
                <RolePermDetail rol={inviteRol} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
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
                {inviting ? 'Enviando...' : `Invitar como ${ROL_DEFS[inviteRol].label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
