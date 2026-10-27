/**
 * ScreenTransporteConductores — TX-COND-1A/1B
 * Lista, alta, ficha y edición de conductores usando trade_workers.
 * No almacena DNI ni fecha de nacimiento.
 * TrabFlow no verifica habilitaciones oficiales.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User, UserCheck, UserX, Bus, Search, AlertCircle, Lock,
  Plus, ChevronLeft, Edit2, Check, X, Save, Loader2, AlertTriangle,
  Calendar, Tag, Phone, Mail, ClipboardList, Info,
} from 'lucide-react';
import { loadConductores, createConductor, updateWorker } from '../lib/transport';
import { useSession } from '../context/SessionContext';
import type { TradeWorker } from '../lib/supabase';

// ── Catálogos ─────────────────────────────────────────────────────────────────

export const CATEGORIAS_PERMISO = [
  'D', 'D1', 'D+E', 'D1+E',
  'C', 'C1', 'C+E', 'C1+E',
  'B', 'BE',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

function initials(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

export function expiryStatus(dateStr: string | null | undefined): ExpiryStatus {
  if (!dateStr) return 'none';
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);   // normaliza a medianoche local (YYYY-MM-DD se parsea como UTC)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return 'expired';
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  return diffDays <= 60 ? 'soon' : 'ok';
}

function ExpiryBadge({ label, date }: { label: string; date: string | null | undefined }) {
  const st = expiryStatus(date);
  if (st === 'none') return null;
  const style = {
    expired: 'bg-red-100 text-red-700 border-red-200',
    soon:    'bg-amber-100 text-amber-700 border-amber-200',
    ok:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  }[st];
  const icon = st === 'expired' ? '⚠' : st === 'soon' ? '⏰' : '✓';
  const fmt = date ? new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${style}`}>
      {icon} {label} {fmt}
    </span>
  );
}

// ── Tipos de vista ────────────────────────────────────────────────────────────

type View = 'list' | 'ficha' | 'nuevo';

// ── Valores por defecto del formulario ───────────────────────────────────────

interface ConductorForm {
  nombre: string;
  telefono: string;
  email: string;
  identificador_interno: string;
  categorias_permiso: string[];
  permiso_caducidad: string;
  cap_caducidad: string;
  fecha_incorporacion: string;
  observaciones_profesionales: string;
}

const EMPTY_FORM: ConductorForm = {
  nombre: '',
  telefono: '',
  email: '',
  identificador_interno: '',
  categorias_permiso: [],
  permiso_caducidad: '',
  cap_caducidad: '',
  fecha_incorporacion: '',
  observaciones_profesionales: '',
};

function workerToForm(w: TradeWorker): ConductorForm {
  return {
    nombre:                       w.nombre ?? '',
    telefono:                     w.telefono ?? '',
    email:                        w.email ?? '',
    identificador_interno:        w.identificador_interno ?? '',
    categorias_permiso:           w.categorias_permiso ?? [],
    permiso_caducidad:            w.permiso_caducidad ?? '',
    cap_caducidad:                w.cap_caducidad ?? '',
    fecha_incorporacion:          w.fecha_incorporacion ?? '',
    observaciones_profesionales:  w.observaciones_profesionales ?? '',
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ScreenTransporteConductores({ orgId, showToast }: Props) {
  const { rol } = useSession();
  const canEdit = rol === 'owner';

  const [conductores, setConductores] = useState<TradeWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<TradeWorker | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadConductores(orgId);
      setConductores(data);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => { void load(); }, [load]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return conductores
      .filter(c => showInactive ? true : c.activo !== false)
      .filter(c => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.nombre.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.identificador_interno ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if ((a.activo ?? true) !== (b.activo ?? true)) {
          return (a.activo ?? true) ? -1 : 1;
        }
        return a.nombre.localeCompare(b.nombre);
      });
  }, [conductores, search, showInactive]);

  const totalActivos = conductores.filter(c => c.activo !== false).length;

  // ── Navigation helpers ────────────────────────────────────────────────────
  function openFicha(c: TradeWorker) {
    setSelected(c);
    setView('ficha');
  }

  function backToList() {
    setSelected(null);
    setView('list');
  }

  function openNuevo() {
    setSelected(null);
    setView('nuevo');
  }

  // ── Refresh after save ────────────────────────────────────────────────────
  async function afterSave(updated: TradeWorker, msg: string) {
    setConductores(prev => {
      const idx = prev.findIndex(c => c.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
    showToast(msg, 'success');
    setSelected(updated);
    setView('ficha');
  }

  // ── List view ─────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="h-full flex flex-col bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Conductores</h2>
                <p className="text-[11px] text-slate-400">
                  {totalActivos} activo{totalActivos !== 1 ? 's' : ''} · {conductores.length} total
                </p>
              </div>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={openNuevo}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo conductor
              </button>
            )}
          </div>
        </div>

        {/* Aviso informativo */}
        <div className="mx-4 sm:mx-6 mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2.5 shrink-0">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 leading-relaxed">
            TrabFlow no verifica habilitaciones CAP ni permisos de conducción. La validación de documentación es responsabilidad de la empresa.
          </p>
        </div>

        {!canEdit && (
          <div className="mx-4 sm:mx-6 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 shrink-0">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">Solo el propietario puede crear o editar conductores. Vista de solo lectura.</p>
          </div>
        )}

        {/* Barra buscador + toggle inactivos */}
        <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive(v => !v)}
            className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              showInactive
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {showInactive ? 'Todos' : 'Solo activos'}
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 pb-6">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          )}

          {!loading && conductores.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bus className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-semibold text-slate-500">No hay conductores todavía</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={openNuevo}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  + Añadir el primero
                </button>
              )}
            </div>
          )}

          {!loading && conductores.length > 0 && filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-400">
              Ningún conductor coincide con la búsqueda.
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-2 pt-1">
              {filtered.map(c => {
                const isActive = c.activo !== false;
                const permisoSt = expiryStatus(c.permiso_caducidad);
                const capSt = expiryStatus(c.cap_caducidad);
                const hasAlert = permisoSt === 'expired' || permisoSt === 'soon' || capSt === 'expired' || capSt === 'soon';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openFicha(c)}
                    className={`w-full text-left bg-white rounded-xl border px-4 py-3 flex items-start gap-3 transition-all hover:shadow-sm cursor-pointer ${
                      isActive
                        ? hasAlert ? 'border-amber-200' : 'border-indigo-100 hover:border-indigo-300'
                        : 'border-slate-100 opacity-60'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {initials(c.nombre)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                          {c.nombre}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-1.5 py-0.5">
                            Inactivo
                          </span>
                        )}
                        {c.identificador_interno && (
                          <span className="text-[10px] text-slate-400">#{c.identificador_interno}</span>
                        )}
                      </div>

                      {/* Contacto */}
                      {(c.telefono || c.email) && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {[c.telefono, c.email].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      {/* Categorías */}
                      {(c.categorias_permiso ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(c.categorias_permiso ?? []).map(cat => (
                            <span key={cat} className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Badges de caducidad */}
                      {(c.permiso_caducidad || c.cap_caducidad) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <ExpiryBadge label="Permiso" date={c.permiso_caducidad} />
                          <ExpiryBadge label="CAP" date={c.cap_caducidad} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Ficha individual ──────────────────────────────────────────────────────
  if (view === 'ficha' && selected) {
    return (
      <ConductorFicha
        conductor={selected}
        orgId={orgId}
        canEdit={canEdit}
        onBack={backToList}
        onSaved={afterSave}
        showToast={showToast}
      />
    );
  }

  // ── Nuevo conductor ───────────────────────────────────────────────────────
  if (view === 'nuevo') {
    return (
      <ConductorForm
        mode="nuevo"
        orgId={orgId}
        canEdit={canEdit}
        existingNames={conductores.map(c => c.nombre.toLowerCase())}
        onBack={backToList}
        onSaved={async (c) => {
          setConductores(prev => [...prev, c]);
          showToast(`Conductor ${c.nombre} creado`, 'success');
          setSelected(c);
          setView('ficha');
        }}
        showToast={showToast}
      />
    );
  }

  return null;
}

// ── Ficha (vista + modo edición) ──────────────────────────────────────────────

function ConductorFicha({
  conductor, orgId, canEdit, onBack, onSaved, showToast,
}: {
  conductor: TradeWorker;
  orgId: string;
  canEdit: boolean;
  onBack: () => void;
  onSaved: (c: TradeWorker, msg: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<ConductorForm>(workerToForm(conductor));
  const [confirming, setConfirming] = useState(false);

  function field<K extends keyof ConductorForm>(key: K, val: ConductorForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleCategoria(cat: string) {
    setForm(f => ({
      ...f,
      categorias_permiso: f.categorias_permiso.includes(cat)
        ? f.categorias_permiso.filter(c => c !== cat)
        : [...f.categorias_permiso, cat],
    }));
  }

  function cancelEdit() {
    setForm(workerToForm(conductor));
    setEditing(false);
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateWorker(conductor.id, orgId, {
        nombre:                      form.nombre.trim(),
        telefono:                    form.telefono || undefined,
        email:                       form.email    || undefined,
        identificador_interno:       form.identificador_interno || null,
        categorias_permiso:          form.categorias_permiso,
        permiso_caducidad:           form.permiso_caducidad || null,
        cap_caducidad:               form.cap_caducidad     || null,
        fecha_incorporacion:         form.fecha_incorporacion || null,
        observaciones_profesionales: form.observaciones_profesionales || null,
      });
      setEditing(false);
      onSaved(updated, `${updated.nombre} actualizado`);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo() {
    setSaving(true);
    try {
      const updated = await updateWorker(conductor.id, orgId, { activo: !(conductor.activo ?? true) });
      setConfirming(false);
      onSaved(updated, updated.activo ? `${updated.nombre} reactivado` : `${updated.nombre} desactivado`);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const isActive   = conductor.activo !== false;
  const permisoSt  = expiryStatus(conductor.permiso_caducidad);
  const capSt      = expiryStatus(conductor.cap_caducidad);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-800 truncate">{conductor.nombre}</span>
          {!isActive && (
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-1.5 py-0.5">
              Inactivo
            </span>
          )}
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Editar
          </button>
        )}
        {canEdit && editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 space-y-4">
        {/* Aviso caducidades */}
        {!editing && (permisoSt === 'expired' || permisoSt === 'soon' || capSt === 'expired' || capSt === 'soon') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              {[
                permisoSt === 'expired' && 'El permiso de conducción ha caducado.',
                permisoSt === 'soon'    && 'El permiso de conducción caduca en menos de 60 días.',
                capSt === 'expired'     && 'El CAP ha caducado.',
                capSt === 'soon'        && 'El CAP caduca en menos de 60 días.',
              ].filter(Boolean).join(' ')}
            </p>
          </div>
        )}

        {/* Sección: Datos básicos */}
        <Section title="Datos básicos" icon={<User className="w-3.5 h-3.5" />}>
          <FieldRow label="Nombre *">
            {editing
              ? <input
                  type="text"
                  value={form.nombre}
                  onChange={e => field('nombre', e.target.value)}
                  className={inputClass}
                />
              : <span className="text-sm text-slate-800">{conductor.nombre}</span>
            }
          </FieldRow>
          <FieldRow label="Teléfono">
            {editing
              ? <input type="tel" value={form.telefono} onChange={e => field('telefono', e.target.value)} className={inputClass} />
              : <span className="text-sm text-slate-700">{conductor.telefono || <em className="text-slate-400 not-italic">—</em>}</span>
            }
          </FieldRow>
          <FieldRow label="Email">
            {editing
              ? <input type="email" value={form.email} onChange={e => field('email', e.target.value)} className={inputClass} />
              : <span className="text-sm text-slate-700">{conductor.email || <em className="text-slate-400 not-italic">—</em>}</span>
            }
          </FieldRow>
          <FieldRow label="ID interno">
            {editing
              ? <input
                  type="text"
                  placeholder="Número de empleado (opcional)"
                  value={form.identificador_interno}
                  onChange={e => field('identificador_interno', e.target.value)}
                  className={inputClass}
                />
              : <span className="text-sm text-slate-700">{conductor.identificador_interno || <em className="text-slate-400 not-italic">—</em>}</span>
            }
          </FieldRow>
        </Section>

        {/* Sección: Habilitación profesional */}
        <Section title="Habilitación profesional" icon={<Tag className="w-3.5 h-3.5" />}>
          <div className="space-y-1 pb-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Categorías de permiso</label>
            {editing
              ? (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {CATEGORIAS_PERMISO.map(cat => {
                    const active = form.categorias_permiso.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoria(cat)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )
              : (conductor.categorias_permiso ?? []).length > 0
                ? (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(conductor.categorias_permiso ?? []).map(cat => (
                      <span key={cat} className="text-[11px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-2 py-0.5">
                        {cat}
                      </span>
                    ))}
                  </div>
                )
                : <span className="text-sm text-slate-400 italic">Sin categorías registradas</span>
            }
          </div>

          <FieldRow label="Caducidad permiso">
            {editing
              ? <input type="date" value={form.permiso_caducidad} onChange={e => field('permiso_caducidad', e.target.value)} className={inputClass} />
              : conductor.permiso_caducidad
                ? <ExpiryBadge label="Permiso" date={conductor.permiso_caducidad} />
                : <span className="text-slate-400 text-sm italic">—</span>
            }
          </FieldRow>
          <FieldRow label="Caducidad CAP">
            {editing
              ? <input type="date" value={form.cap_caducidad} onChange={e => field('cap_caducidad', e.target.value)} className={inputClass} />
              : conductor.cap_caducidad
                ? <ExpiryBadge label="CAP" date={conductor.cap_caducidad} />
                : <span className="text-slate-400 text-sm italic">—</span>
            }
          </FieldRow>
        </Section>

        {/* Sección: Incorporación y notas */}
        <Section title="Incorporación y notas" icon={<ClipboardList className="w-3.5 h-3.5" />}>
          <FieldRow label="Fecha incorporación">
            {editing
              ? <input type="date" value={form.fecha_incorporacion} onChange={e => field('fecha_incorporacion', e.target.value)} className={inputClass} />
              : <span className="text-sm text-slate-700">
                  {conductor.fecha_incorporacion
                    ? new Date(conductor.fecha_incorporacion).toLocaleDateString('es-ES')
                    : <em className="text-slate-400 not-italic">—</em>}
                </span>
            }
          </FieldRow>
          <FieldRow label="Observaciones">
            {editing
              ? <textarea
                  value={form.observaciones_profesionales}
                  onChange={e => field('observaciones_profesionales', e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Notas internas sobre el conductor…"
                />
              : <span className="text-sm text-slate-700 whitespace-pre-line">
                  {conductor.observaciones_profesionales || <em className="text-slate-400 not-italic">—</em>}
                </span>
            }
          </FieldRow>
        </Section>

        {/* Activar / Desactivar */}
        {canEdit && !editing && (
          <div className="pt-2">
            {confirming
              ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-3">
                    {isActive
                      ? `¿Desactivar a ${conductor.nombre}? Sus servicios y partes históricos se conservan.`
                      : `¿Reactivar a ${conductor.nombre}?`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleToggleActivo}
                      disabled={saving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50 ${
                        isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {isActive ? 'Sí, desactivar' : 'Sí, reactivar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )
              : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  {isActive ? 'Desactivar conductor' : 'Reactivar conductor'}
                </button>
              )}
          </div>
        )}

        {/* Aviso no certificación */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            TrabFlow registra los datos indicados pero no verifica su validez oficial ni certifica habilitaciones. La comprobación de permisos y CAP es responsabilidad de la organización.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Formulario alta ───────────────────────────────────────────────────────────

function ConductorForm({
  mode, orgId, canEdit, existingNames, onBack, onSaved, showToast,
}: {
  mode: 'nuevo';
  orgId: string;
  canEdit: boolean;
  existingNames: string[];
  onBack: () => void;
  onSaved: (c: TradeWorker) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [form, setForm] = useState<ConductorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <Lock className="w-8 h-8 text-slate-300" />
        <p className="text-sm text-slate-500 text-center">
          Solo el propietario puede crear nuevos conductores.
        </p>
        <button type="button" onClick={onBack} className="text-xs font-semibold text-indigo-600 cursor-pointer">
          ← Volver
        </button>
      </div>
    );
  }

  function field<K extends keyof ConductorForm>(key: K, val: ConductorForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleCategoria(cat: string) {
    setForm(f => ({
      ...f,
      categorias_permiso: f.categorias_permiso.includes(cat)
        ? f.categorias_permiso.filter(c => c !== cat)
        : [...f.categorias_permiso, cat],
    }));
  }

  const isDuplicate = form.nombre.trim() && existingNames.includes(form.nombre.trim().toLowerCase());

  async function handleCreate() {
    if (!form.nombre.trim()) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await createConductor(orgId, {
        nombre:                      form.nombre.trim(),
        telefono:                    form.telefono    || undefined,
        email:                       form.email       || undefined,
        identificador_interno:       form.identificador_interno || undefined,
        categorias_permiso:          form.categorias_permiso.length > 0 ? form.categorias_permiso : undefined,
        permiso_caducidad:           form.permiso_caducidad || undefined,
        cap_caducidad:               form.cap_caducidad     || undefined,
        fecha_incorporacion:         form.fecha_incorporacion || undefined,
        observaciones_profesionales: form.observaciones_profesionales || undefined,
      });
      onSaved(created);
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-800">Nuevo conductor</span>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !form.nombre.trim()}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Crear conductor
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 space-y-4">
        {isDuplicate && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Ya existe un conductor con ese nombre. Revisa antes de continuar.</p>
          </div>
        )}

        <Section title="Datos básicos" icon={<User className="w-3.5 h-3.5" />}>
          <FieldRow label="Nombre *">
            <input
              type="text"
              autoFocus
              placeholder="Nombre completo"
              value={form.nombre}
              onChange={e => field('nombre', e.target.value)}
              className={inputClass}
            />
          </FieldRow>
          <FieldRow label="Teléfono">
            <input type="tel" value={form.telefono} onChange={e => field('telefono', e.target.value)} className={inputClass} placeholder="600 000 000" />
          </FieldRow>
          <FieldRow label="Email">
            <input type="email" value={form.email} onChange={e => field('email', e.target.value)} className={inputClass} placeholder="correo@empresa.com" />
          </FieldRow>
          <FieldRow label="ID interno">
            <input
              type="text"
              placeholder="Número de empleado (opcional)"
              value={form.identificador_interno}
              onChange={e => field('identificador_interno', e.target.value)}
              className={inputClass}
            />
          </FieldRow>
        </Section>

        <Section title="Habilitación profesional" icon={<Tag className="w-3.5 h-3.5" />}>
          <div className="space-y-1 pb-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Categorías de permiso</label>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {CATEGORIAS_PERMISO.map(cat => {
                const active = form.categorias_permiso.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategoria(cat)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
          <FieldRow label="Caducidad permiso">
            <input type="date" value={form.permiso_caducidad} onChange={e => field('permiso_caducidad', e.target.value)} className={inputClass} />
          </FieldRow>
          <FieldRow label="Caducidad CAP">
            <input type="date" value={form.cap_caducidad} onChange={e => field('cap_caducidad', e.target.value)} className={inputClass} />
          </FieldRow>
        </Section>

        <Section title="Incorporación y notas" icon={<ClipboardList className="w-3.5 h-3.5" />}>
          <FieldRow label="Fecha incorporación">
            <input type="date" value={form.fecha_incorporacion} onChange={e => field('fecha_incorporacion', e.target.value)} className={inputClass} />
          </FieldRow>
          <FieldRow label="Observaciones">
            <textarea
              value={form.observaciones_profesionales}
              onChange={e => field('observaciones_profesionales', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Notas internas sobre el conductor…"
            />
          </FieldRow>
        </Section>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            TrabFlow registra los datos indicados pero no verifica su validez oficial ni certifica habilitaciones.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Componentes de UI menores ─────────────────────────────────────────────────

const inputClass =
  'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none';

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-slate-400">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <span className="text-[11px] font-semibold text-slate-400 sm:w-36 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
