import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, X, Shield, Trash2, Mail, Check, Minus,
  FileText, Receipt, BookUser, Package, Calendar, BarChart2,
  Settings, Wrench, StickyNote, ChevronDown, Phone, Car, Clock,
  Edit2, Send, Save, CheckCircle2, UserCheck,
} from 'lucide-react';
import {
  supabase, loadOrgMembers, updateMemberRol, revokeMember,
  loadWorkers, addWorker, deleteWorker, updateWorker,
  loadWorkerSchedules, saveWorkerSchedules,
} from '../lib/supabase';
import type { OrgMember, TradeWorker, TradeWorkerSchedule } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import type { Rol } from '../context/SessionContext';

// ─── Permisos por rol ───────────────────────────────────────────────────────

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
  { label: 'Facturas',        icon: <Receipt className="w-3.5 h-3.5" />,   admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Presupuestos',    icon: <FileText className="w-3.5 h-3.5" />,  admin: true,      oficina: true,      comercial: true,      tecnico: false,     visualizador: false },
  { label: 'Clientes CRM',    icon: <BookUser className="w-3.5 h-3.5" />,  admin: true,      oficina: true,      comercial: true,      tecnico: false,     visualizador: false },
  { label: 'Catálogo',        icon: <Package className="w-3.5 h-3.5" />,   admin: true,      oficina: true,      comercial: false,     tecnico: 'partial', visualizador: false },
  { label: 'Planificación',   icon: <Calendar className="w-3.5 h-3.5" />,  admin: true,      oficina: true,      comercial: false,     tecnico: 'partial', visualizador: 'partial' },
  { label: 'Ingresos',        icon: <BarChart2 className="w-3.5 h-3.5" />, admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Equipo',          icon: <Users className="w-3.5 h-3.5" />,     admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Mantenimiento',   icon: <Wrench className="w-3.5 h-3.5" />,   admin: true,      oficina: true,      comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Ajustes empresa', icon: <Settings className="w-3.5 h-3.5" />, admin: true,      oficina: false,     comercial: false,     tecnico: false,     visualizador: false },
  { label: 'Notas de campo',  icon: <StickyNote className="w-3.5 h-3.5" />,admin: true,     oficina: false,     comercial: false,     tecnico: true,      visualizador: false },
];

const ROL_DEFS: Record<Exclude<Rol, 'owner'>, {
  label: string; tagline: string; badge: string; accent: string; bg: string; note?: string;
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
    note: 'Ve y completa sus trabajos asignados, consulta catálogo y añade notas de campo.',
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

// ─── Constantes campo ───────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const ESPECIALIDADES_DISPONIBLES = [
  'Electricidad', 'Fontanería', 'Climatización', 'Gas', 'Carpintería',
  'Pintura', 'Albañilería', 'Cerrajería', 'Instalaciones', 'Mantenimiento',
  'Telecomunicaciones', 'Energía solar', 'Calderas', 'Frío industrial',
];

const ROL_CAMPO_CFG: Record<string, { label: string; color: string; desc: string }> = {
  tecnico:       { label: 'Técnico',        color: 'bg-teal-100 text-teal-700 border-teal-200',     desc: 'Realiza los trabajos técnicos en campo' },
  oficial:       { label: 'Oficial',        color: 'bg-indigo-100 text-indigo-700 border-indigo-200', desc: 'Oficial cualificado del gremio' },
  ayudante:      { label: 'Ayudante',       color: 'bg-slate-100 text-slate-600 border-slate-200',   desc: 'Apoya y asiste al técnico u oficial' },
  subcontratado: { label: 'Subcontratado',  color: 'bg-amber-100 text-amber-700 border-amber-200',   desc: 'Externo contratado puntualmente' },
  coordinador:   { label: 'Coordinador',    color: 'bg-purple-100 text-purple-700 border-purple-200', desc: 'Coordina equipos y supervisa trabajos' },
  jefe_equipo:   { label: 'Jefe de equipo', color: 'bg-rose-100 text-rose-700 border-rose-200',      desc: 'Responsable del equipo de campo' },
};

const ESTADO_CAMPO_CFG: Record<string, { label: string; dot: string }> = {
  disponible: { label: 'Disponible', dot: 'bg-emerald-400' },
  ocupado:    { label: 'Ocupado',    dot: 'bg-amber-400' },
  libre:      { label: 'Libre',      dot: 'bg-slate-300' },
  inactivo:   { label: 'Inactivo',   dot: 'bg-red-300' },
};

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface UnifiedPerson {
  key: string;
  member?: OrgMember;
  worker?: TradeWorker;
  isPropietario?: boolean;
  displayName: string;
  displayEmail?: string;
}

// ─── Helpers módulo ─────────────────────────────────────────────────────────

function colorFromName(name: string) {
  const colors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-indigo-500'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff;
  return colors[h % colors.length];
}

function getInitials(str: string) {
  if (!str) return '??';
  const parts = str.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

function emptyWorkerForm(): Partial<TradeWorker> {
  return {
    nombre: '', telefono: '', email: '', rol: 'tecnico',
    especialidades: [], max_trabajos_dia: 6,
    buffer_desplazamiento_min: 15, tiene_vehiculo: true,
    horario_inicio: '08:00', horario_fin: '18:00',
    estado_actual: 'disponible',
  };
}

function buildUnifiedList(
  ownerEmail: string,
  members: OrgMember[],
  workers: TradeWorker[],
): UnifiedPerson[] {
  const result: UnifiedPerson[] = [];
  const linkedWorkerIds = new Set<string>();

  result.push({
    key: 'owner',
    isPropietario: true,
    displayName: ownerEmail,
    displayEmail: ownerEmail,
  });

  for (const m of members) {
    const linked = m.worker_profile_id
      ? workers.find(w => w.id === m.worker_profile_id)
      : workers.find(w => w.email && m.email && w.email.toLowerCase() === m.email.toLowerCase());
    if (linked) linkedWorkerIds.add(linked.id);
    result.push({
      key: m.id,
      member: m,
      worker: linked,
      displayName: linked?.nombre || m.email || 'Sin nombre',
      displayEmail: m.email,
    });
  }

  for (const w of workers) {
    if (!linkedWorkerIds.has(w.id)) {
      result.push({
        key: w.id,
        worker: w,
        displayName: w.nombre,
        displayEmail: w.email || undefined,
      });
    }
  }

  return result;
}

// ─── Sub-componentes módulo ─────────────────────────────────────────────────

function PermIcon({ val }: { val: boolean | 'partial' }) {
  if (val === true)      return <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-emerald-600" /></span>;
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
                {f.icon}{f.label}
                {perm === 'partial' && <span className="text-[10px] text-amber-600 font-normal">(parcial)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function ScreenEquipo({ showToast }: Props) {
  const { user, org, rol: myRol, subscription } = useSession();

  const PLAN_LIMITS: Record<string, number> = { basico: 0, profesional: 0, empresa: 5, empresa_plus: 15 };
  const memberLimit = PLAN_LIMITS[subscription?.plan ?? 'basico'] ?? 0;

  const [members, setMembers]         = useState<OrgMember[]>([]);
  const [workers, setWorkers]         = useState<TradeWorker[]>([]);
  const [unified, setUnified]         = useState<UnifiedPerson[]>([]);
  const [loading, setLoading]         = useState(true);

  // Detail panel
  const [selected, setSelected]       = useState<UnifiedPerson | null>(null);
  const [detailSchedules, setDetailSchedules] = useState<TradeWorkerSchedule[]>([]);
  const [editingRolId, setEditingRolId] = useState<string | null>(null);

  // Invite modal (new email → app member)
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRol, setInviteRol]     = useState<Exclude<Rol, 'owner'>>('oficina');
  const [inviting, setInviting]       = useState(false);

  // Worker invite (from field worker → app)
  const [invitingWorker, setInvitingWorker] = useState<string | null>(null);

  // Worker form modal
  const [workerForm, setWorkerForm]   = useState<Partial<TradeWorker>>(emptyWorkerForm());
  const [workerFormSchedules, setWorkerFormSchedules] = useState<Omit<TradeWorkerSchedule,'id'>[]>([]);
  const [editingWorker, setEditingWorker] = useState<TradeWorker | null>(null);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [savingWorker, setSavingWorker] = useState(false);

  // Role management
  const [revoking, setRevoking]       = useState<string | null>(null);
  const [infoRol, setInfoRol]         = useState<Exclude<Rol, 'owner'>>('oficina');

  const canManage = myRol === 'owner' || myRol === 'admin';

  const fetchAll = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [mem, wrk] = await Promise.all([
        loadOrgMembers(org.id),
        loadWorkers(org.id),
      ]);
      setMembers(mem);
      setWorkers(wrk);
      setUnified(buildUnifiedList(user?.email ?? '', mem, wrk));
    } catch {
      showToast('Error cargando equipo', 'error');
    } finally {
      setLoading(false);
    }
  }, [org, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Detail panel ──────────────────────────────────────────────────────────

  async function openDetail(p: UnifiedPerson) {
    setSelected(p);
    setEditingRolId(null);
    if (p.worker) {
      try {
        const scheds = await loadWorkerSchedules(p.worker.id);
        setDetailSchedules(scheds);
      } catch { setDetailSchedules([]); }
    } else {
      setDetailSchedules([]);
    }
  }

  // ── App member invite (new email) ────────────────────────────────────────

  async function handleInviteMember() {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { email: inviteEmail.trim().toLowerCase(), rol: inviteRol, org_id: org.id },
      });
      if (error) throw new Error(error.message);
      if (data?.plan_restriction) { showToast(data.error ?? 'Tu plan no permite más miembros', 'error'); setInviteOpen(false); return; }
      showToast('Invitación enviada ✓', 'success');
      setInviteOpen(false);
      setInviteEmail('');
      await fetchAll();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error al invitar', 'error');
    } finally {
      setInviting(false);
    }
  }

  // ── Invite field worker to app ───────────────────────────────────────────

  async function handleInviteWorkerToApp(w: TradeWorker) {
    if (!org) return;
    if (!w.email?.trim()) { showToast('El trabajador no tiene email. Edítalo primero.', 'error'); return; }
    if (!confirm(`¿Invitar a ${w.nombre} (${w.email}) para acceder a la app como técnico?`)) return;
    setInvitingWorker(w.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { email: w.email.trim().toLowerCase(), rol: 'tecnico', org_id: org.id, worker_profile_id: w.id },
      });
      if (error) throw new Error(error.message);
      if (data?.plan_restriction) { showToast(data.error ?? 'Tu plan no permite más miembros', 'error'); return; }
      showToast(`Invitación enviada a ${w.email} ✓`, 'success');
      await fetchAll();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error al enviar invitación', 'error');
    } finally {
      setInvitingWorker(null);
    }
  }

  // ── Change role ──────────────────────────────────────────────────────────

  async function handleChangeRol(memberId: string, newRol: Rol) {
    try {
      await updateMemberRol(memberId, newRol);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, rol: newRol } : m));
      setEditingRolId(null);
      setSelected(prev => prev?.member?.id === memberId ? { ...prev, member: { ...prev.member!, rol: newRol } } : prev);
      showToast('Rol actualizado', 'success');
    } catch { showToast('Error actualizando rol', 'error'); }
  }

  // ── Revoke member ────────────────────────────────────────────────────────

  async function handleRevoke(m: OrgMember) {
    if (!confirm(`¿Revocar acceso a ${m.email}?`)) return;
    setRevoking(m.id);
    try {
      await revokeMember(m.id);
      setSelected(null);
      await fetchAll();
      showToast('Acceso revocado', 'info');
    } catch { showToast('Error revocando acceso', 'error'); }
    finally { setRevoking(null); }
  }

  // ── Worker form ──────────────────────────────────────────────────────────

  function openNewWorker() {
    setEditingWorker(null);
    setWorkerForm(emptyWorkerForm());
    setWorkerFormSchedules([1,2,3,4,5].map(d => ({
      worker_id: '', org_id: org?.id ?? '',
      dia_semana: d, activo: true,
      hora_inicio: '08:00', hora_fin: '18:00',
    })));
    setShowWorkerForm(true);
  }

  async function openEditWorker(w: TradeWorker) {
    setEditingWorker(w);
    setWorkerForm({ ...w });
    try {
      const scheds = await loadWorkerSchedules(w.id);
      setWorkerFormSchedules(scheds.length ? scheds.map(s => ({ ...s })) : [1,2,3,4,5].map(d => ({
        worker_id: w.id, org_id: org?.id ?? '', dia_semana: d, activo: true,
        hora_inicio: '08:00', hora_fin: '18:00',
      })));
    } catch { setWorkerFormSchedules([]); }
    setShowWorkerForm(true);
  }

  async function handleSaveWorker() {
    if (!org || !workerForm.nombre?.trim()) return;
    setSavingWorker(true);
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, workerForm);
        await saveWorkerSchedules(editingWorker.id, org.id, workerFormSchedules.map(s => ({ ...s, worker_id: editingWorker.id, org_id: org.id })));
        showToast('Trabajador actualizado', 'success');
      } else {
        const newW = await addWorker(org.id, { nombre: workerForm.nombre!, telefono: workerForm.telefono, email: workerForm.email, rol: workerForm.rol ?? 'tecnico' });
        await updateWorker(newW.id, {
          especialidades: workerForm.especialidades,
          max_trabajos_dia: workerForm.max_trabajos_dia,
          buffer_desplazamiento_min: workerForm.buffer_desplazamiento_min,
          tiene_vehiculo: workerForm.tiene_vehiculo,
          horario_inicio: workerForm.horario_inicio,
          horario_fin: workerForm.horario_fin,
          estado_actual: workerForm.estado_actual,
        });
        await saveWorkerSchedules(newW.id, org.id, workerFormSchedules.map(s => ({ ...s, worker_id: newW.id, org_id: org.id })));
        showToast('Trabajador creado', 'success');
      }
      setShowWorkerForm(false);
      setSelected(null);
      await fetchAll();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error al guardar', 'error');
    } finally {
      setSavingWorker(false);
    }
  }

  async function handleDeleteWorker(w: TradeWorker) {
    if (!confirm(`¿Dar de baja a ${w.nombre}?`)) return;
    try {
      await deleteWorker(w.id);
      setSelected(null);
      await fetchAll();
      showToast(`${w.nombre} dado de baja`, 'info');
    } catch { showToast('Error al eliminar', 'error'); }
  }

  function toggleEspecialidad(esp: string) {
    setWorkerForm(prev => {
      const cur = prev.especialidades ?? [];
      return { ...prev, especialidades: cur.includes(esp) ? cur.filter(e => e !== esp) : [...cur, esp] };
    });
  }

  function updateFormSchedule(idx: number, field: keyof Omit<TradeWorkerSchedule,'id'>, value: unknown) {
    setWorkerFormSchedules(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  // ── Render list row ──────────────────────────────────────────────────────

  function renderPersonRow(p: UnifiedPerson, idx: number, total: number) {
    const isLast = idx === total - 1;
    const appRolDef = p.member ? ROL_DEFS[p.member.rol as Exclude<Rol, 'owner'>] : null;
    const campoCfg = p.worker ? (ROL_CAMPO_CFG[p.worker.rol] ?? ROL_CAMPO_CFG.tecnico) : null;
    const estadoCfg = p.worker ? (ESTADO_CAMPO_CFG[p.worker.estado_actual ?? 'disponible'] ?? ESTADO_CAMPO_CFG.disponible) : null;
    const avatarColor = p.isPropietario ? 'bg-amber-400' : colorFromName(p.displayName);

    return (
      <div
        key={p.key}
        onClick={() => !p.isPropietario && openDetail(p)}
        className={`flex items-center gap-4 px-5 py-4 ${!isLast ? 'border-b border-slate-100' : ''} ${!p.isPropietario ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}`}
      >
        <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
          {getInitials(p.displayName)}
        </div>

        <div className="flex-grow min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{p.displayName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {p.isPropietario && <p className="text-xs text-slate-400">Tú · Propietario</p>}
            {!p.isPropietario && p.member && (
              <p className="text-xs text-slate-400">{appRolDef?.tagline ?? p.member.rol}</p>
            )}
            {!p.isPropietario && !p.member && p.worker && (
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${estadoCfg?.dot}`} />
                <span className="text-xs text-slate-400">{estadoCfg?.label} · Solo campo</span>
              </div>
            )}
            {p.worker && p.worker.especialidades && p.worker.especialidades.length > 0 && (
              <span className="text-[10px] text-slate-400 hidden md:inline">
                · {p.worker.especialidades.slice(0,2).join(', ')}{p.worker.especialidades.length > 2 ? ` +${p.worker.especialidades.length - 2}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {p.isPropietario && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Propietario</span>
          )}
          {!p.isPropietario && p.member && appRolDef && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${appRolDef.badge}`}>{appRolDef.label}</span>
          )}
          {p.worker && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${campoCfg?.color ?? ''}`}>{campoCfg?.label}</span>
          )}
          {!p.isPropietario && p.member && (
            <span className={`text-xs font-medium w-16 text-right ${p.member.activo ? 'text-emerald-600' : 'text-amber-600'}`}>
              {p.member.activo ? 'Activo' : 'Pendiente'}
            </span>
          )}
          {!p.isPropietario && !p.member && p.worker && (
            <span className="text-xs text-slate-400 w-16 text-right">Sin app</span>
          )}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalPeople = unified.length;
  const campoSoloCount = unified.filter(p => !p.member && !p.isPropietario && p.worker).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500">{totalPeople} persona{totalPeople !== 1 ? 's' : ''} en el equipo</p>
          {memberLimit > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{members.length}/{memberLimit} miembros adicionales con acceso a app</p>
          )}
          {memberLimit === 0 && canManage && (
            <p className="text-xs text-amber-500 mt-0.5">Actualiza tu plan para dar acceso a la app a más miembros</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNewWorker}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            Añadir trabajador
          </button>
          {canManage && (
            <button
              onClick={() => setInviteOpen(true)}
              disabled={memberLimit === 0}
              title={memberLimit === 0 ? 'Actualiza a Plan Empresa para añadir miembros con acceso app' : undefined}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Invitar miembro
            </button>
          )}
        </div>
      </div>

      {/* Lista unificada */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-5 py-8 text-center text-slate-400 text-sm">Cargando equipo...</div>
        ) : unified.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No hay miembros todavía.</p>
          </div>
        ) : (
          unified.map((p, idx) => renderPersonRow(p, idx, unified.length))
        )}
      </div>

      {campoSoloCount > 0 && (
        <p className="text-xs text-slate-400 -mt-3">
          <span className="font-medium">{campoSoloCount}</span> trabajador{campoSoloCount !== 1 ? 'es' : ''} de campo sin acceso a la app — pulsa sobre ellos para invitarles.
        </p>
      )}

      {/* Tabla de permisos por rol */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Permisos por rol</p>
        </div>
        <div className="flex gap-1.5 flex-wrap md:hidden">
          {INVITABLE_ROLES.map(r => (
            <button key={r} onClick={() => setInfoRol(r)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer border ${infoRol === r ? ROL_DEFS[r].badge + ' shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}>
              {ROL_DEFS[r].label}
            </button>
          ))}
        </div>
        <div className="md:hidden"><RolePermDetail rol={infoRol} /></div>
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
                    <span className="text-slate-400">{f.icon}</span>{f.label}
                  </td>
                  {INVITABLE_ROLES.map(r => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      <div className="flex justify-center"><PermIcon val={f[r]} /></div>
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

      {/* ══ PANEL DETALLE ══════════════════════════════════════════════════════ */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg border border-slate-200 shadow-2xl flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${colorFromName(selected.displayName)} flex items-center justify-center text-white font-bold`}>
                  {getInitials(selected.displayName)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selected.displayName}</p>
                  {selected.displayEmail && selected.displayEmail !== selected.displayName && (
                    <p className="text-xs text-slate-400">{selected.displayEmail}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* Sección: Acceso a la app */}
              {selected.member && (() => {
                const def = ROL_DEFS[selected.member.rol as Exclude<Rol, 'owner'>];
                return (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />Acceso a la app
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Rol</span>
                        {editingRolId === selected.member.id ? (
                          <select
                            autoFocus
                            defaultValue={selected.member.rol}
                            onChange={e => handleChangeRol(selected.member!.id, e.target.value as Rol)}
                            onBlur={() => setEditingRolId(null)}
                            className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 cursor-pointer focus:outline-none focus:border-blue-500"
                          >
                            {INVITABLE_ROLES.map(r => <option key={r} value={r}>{ROL_DEFS[r].label}</option>)}
                          </select>
                        ) : (
                          <button
                            onClick={() => canManage && setEditingRolId(selected.member!.id)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${def?.badge ?? ''} ${canManage ? 'cursor-pointer hover:opacity-80 flex items-center gap-1' : 'cursor-default'}`}
                          >
                            {def?.label ?? selected.member.rol}
                            {canManage && <ChevronDown className="w-3 h-3 opacity-60" />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Estado</span>
                        <span className={`text-xs font-semibold ${selected.member.activo ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {selected.member.activo ? 'Activo' : 'Invitación pendiente'}
                        </span>
                      </div>
                      {selected.member.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 font-medium">Email</span>
                          <a href={`mailto:${selected.member.email}`} className="text-xs text-blue-600 hover:underline">{selected.member.email}</a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Sección: Perfil de campo */}
              {selected.worker && (() => {
                const campoCfg = ROL_CAMPO_CFG[selected.worker.rol] ?? ROL_CAMPO_CFG.tecnico;
                const estadoCfg = ESTADO_CAMPO_CFG[selected.worker.estado_actual ?? 'disponible'] ?? ESTADO_CAMPO_CFG.disponible;
                return (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />Perfil de campo
                    </p>
                    <div className="space-y-3">
                      {/* Estado y categoría */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${campoCfg.color}`}>{campoCfg.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${estadoCfg.dot}`} />
                          <span className="text-xs text-slate-500">{estadoCfg.label}</span>
                        </div>
                      </div>

                      {/* Contacto */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {selected.worker.telefono && (
                          <a href={`tel:${selected.worker.telefono}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />{selected.worker.telefono}
                          </a>
                        )}
                        {selected.worker.email && (
                          <a href={`mailto:${selected.worker.email}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />{selected.worker.email}
                          </a>
                        )}
                      </div>

                      {/* Especialidades */}
                      {selected.worker.especialidades && selected.worker.especialidades.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Especialidades</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selected.worker.especialidades.map(esp => (
                              <span key={esp} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">{esp}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Config */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Carga máx.</p>
                          <p className="text-slate-900 font-bold">{selected.worker.max_trabajos_dia ?? 6} trabajos/día</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Buffer desplaz.</p>
                          <p className="text-slate-900 font-bold">{selected.worker.buffer_desplazamiento_min ?? 15} min</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Horario</p>
                          <p className="text-slate-900 font-bold">{selected.worker.horario_inicio ?? '08:00'} – {selected.worker.horario_fin ?? '18:00'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">Vehículo</p>
                          <p className={`font-bold ${selected.worker.tiene_vehiculo !== false ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {selected.worker.tiene_vehiculo !== false ? 'Sí' : 'No'}
                          </p>
                        </div>
                      </div>

                      {/* Horario semanal */}
                      {detailSchedules.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Horario semanal</p>
                          <div className="space-y-1">
                            {[0,1,2,3,4,5,6].map(d => {
                              const s = detailSchedules.find(sc => sc.dia_semana === d);
                              return (
                                <div key={d} className="flex items-center gap-3 text-xs">
                                  <span className={`w-8 font-bold text-[10px] ${s?.activo ? 'text-slate-700' : 'text-slate-300'}`}>{DIAS_SEMANA[d]}</span>
                                  {s?.activo ? <span className="text-slate-600">{s.hora_inicio} – {s.hora_fin}</span> : <span className="text-slate-300">—</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer acciones */}
            <div className="px-5 py-4 border-t border-slate-100 shrink-0 space-y-2">
              {/* Invitar a la app (solo campo) */}
              {selected.worker && !selected.member && (
                <button
                  onClick={() => handleInviteWorkerToApp(selected.worker!)}
                  disabled={invitingWorker === selected.worker.id || !selected.worker.email}
                  title={!selected.worker.email ? 'Añade email al trabajador para invitarlo' : undefined}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {invitingWorker === selected.worker.id ? 'Enviando...' : 'Invitar a la app como técnico'}
                </button>
              )}

              {/* Editar perfil campo */}
              {selected.worker && (
                <button
                  onClick={() => { setSelected(null); openEditWorker(selected.worker!); }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar perfil de campo
                </button>
              )}

              {/* Revocar acceso */}
              {selected.member && canManage && (
                <button
                  onClick={() => handleRevoke(selected.member!)}
                  disabled={revoking === selected.member.id}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {revoking === selected.member.id ? 'Revocando...' : 'Revocar acceso a la app'}
                </button>
              )}

              {/* Eliminar trabajador (sin acceso app) */}
              {selected.worker && !selected.member && (
                <button
                  onClick={() => handleDeleteWorker(selected.worker!)}
                  className="w-full py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs cursor-pointer transition-colors"
                >
                  Dar de baja como trabajador
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL INVITAR MIEMBRO ══════════════════════════════════════════════ */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <h3 className="text-slate-900 font-bold text-base">Invitar miembro al equipo</h3>
              <button onClick={() => setInviteOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              <div className="flex flex-col gap-5 p-6 flex-1 overflow-y-auto">
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
                      onKeyDown={e => e.key === 'Enter' && handleInviteMember()}
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Rol</label>
                  <div className="space-y-2">
                    {INVITABLE_ROLES.map(r => {
                      const def = ROL_DEFS[r];
                      const selected_r = inviteRol === r;
                      return (
                        <button key={r} onClick={() => setInviteRol(r)}
                          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${selected_r ? def.accent + ' shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${def.badge}`}>{def.label}</span>
                              <p className="text-xs text-slate-500 mt-1">{def.tagline}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected_r ? `${def.bg} border-transparent` : 'border-slate-300'}`}>
                              {selected_r && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="hidden md:flex flex-col p-6 border-l border-slate-100 w-64 shrink-0 overflow-y-auto bg-slate-50/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Permisos del rol</p>
                <RolePermDetail rol={inviteRol} />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setInviteOpen(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors cursor-pointer">Cancelar</button>
              <button onClick={handleInviteMember} disabled={inviting || !inviteEmail.trim()}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                {inviting ? 'Enviando...' : `Invitar como ${ROL_DEFS[inviteRol].label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TRABAJADOR ═══════════════════════════════════════════════════ */}
      {showWorkerForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg border border-slate-200 shadow-2xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-900">{editingWorker ? 'Editar trabajador' : 'Nuevo trabajador'}</h3>
              <button onClick={() => setShowWorkerForm(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Datos básicos */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={workerForm.nombre ?? ''}
                    onChange={e => setWorkerForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Ej: Juan García"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono</label>
                    <input type="tel" value={workerForm.telefono ?? ''} onChange={e => setWorkerForm(p => ({ ...p, telefono: e.target.value }))}
                      placeholder="600 000 000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                    <input type="email" value={workerForm.email ?? ''} onChange={e => setWorkerForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="tecnico@empresa.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Categoría profesional</label>
                    <select value={workerForm.rol ?? 'tecnico'} onChange={e => setWorkerForm(p => ({ ...p, rol: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer">
                      {Object.entries(ROL_CAMPO_CFG).map(([v, cfg]) => <option key={v} value={v}>{cfg.label} — {cfg.desc}</option>)}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Puesto de campo · El acceso a la app se gestiona arriba</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select value={workerForm.estado_actual ?? 'disponible'} onChange={e => setWorkerForm(p => ({ ...p, estado_actual: e.target.value as TradeWorker['estado_actual'] }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer">
                      {Object.entries(ESTADO_CAMPO_CFG).map(([v, cfg]) => <option key={v} value={v}>{cfg.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Especialidades */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Especialidades</label>
                <div className="flex flex-wrap gap-1.5">
                  {ESPECIALIDADES_DISPONIBLES.map(esp => {
                    const active = (workerForm.especialidades ?? []).includes(esp);
                    return (
                      <button key={esp} type="button" onClick={() => toggleEspecialidad(esp)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
                        {esp}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Capacidad */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Máx. trabajos/día</label>
                  <input type="number" min={1} max={20} value={workerForm.max_trabajos_dia ?? 6}
                    onChange={e => setWorkerForm(p => ({ ...p, max_trabajos_dia: parseInt(e.target.value) || 6 }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Buffer (min)</label>
                  <input type="number" min={0} max={60} value={workerForm.buffer_desplazamiento_min ?? 15}
                    onChange={e => setWorkerForm(p => ({ ...p, buffer_desplazamiento_min: parseInt(e.target.value) || 15 }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehículo</label>
                  <button type="button" onClick={() => setWorkerForm(p => ({ ...p, tiene_vehiculo: !p.tiene_vehiculo }))}
                    className={`w-full py-2 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${workerForm.tiene_vehiculo !== false ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    {workerForm.tiene_vehiculo !== false ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              {/* Horario semanal */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Horario semanal</label>
                <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                  {workerFormSchedules.map((s, idx) => (
                    <div key={s.dia_semana} className="flex items-center gap-2">
                      <button type="button" onClick={() => updateFormSchedule(idx, 'activo', !s.activo)}
                        className={`w-5 h-5 rounded cursor-pointer border-2 flex items-center justify-center shrink-0 ${s.activo ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                        {s.activo && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-xs font-bold text-slate-600 w-8">{DIAS_SEMANA[s.dia_semana]}</span>
                      {s.activo ? (
                        <>
                          <input type="time" value={s.hora_inicio} onChange={e => updateFormSchedule(idx, 'hora_inicio', e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 bg-white" />
                          <span className="text-xs text-slate-400">–</span>
                          <input type="time" value={s.hora_fin} onChange={e => updateFormSchedule(idx, 'hora_fin', e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 bg-white" />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No trabaja</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={() => setShowWorkerForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveWorker} disabled={savingWorker || !workerForm.nombre?.trim()}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {savingWorker ? 'Guardando...' : editingWorker ? 'Guardar cambios' : 'Crear trabajador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
