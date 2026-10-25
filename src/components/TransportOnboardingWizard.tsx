import React, { useState } from 'react';
import {
  Bus, Package, Layers, Building2, MapPin, CalendarDays,
  ChevronRight, ChevronLeft, Check, X, Loader2,
  Truck, Users, Star, Shield, Clock, Gauge,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import {
  loadWorkCalendar, saveWorkCalendar, DAY_NAMES, DEFAULT_CALENDAR,
  type WorkCalendar,
} from '../lib/workCalendar';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Reference limits for Transport Demo accounts.
 * INFORMATIVE ONLY — not enforced server-side in this version.
 * Do not present as contractual restrictions.
 * Future plan: server-side CHECK on insert, 2 drivers/vehicle, 29€/vehicle/month.
 */
export const TRANSPORT_DEMO_LIMITS = {
  maxVehicles: 3,
  maxDrivers: 5,
};

const ESPECIALIDADES = [
  {
    id: 'viajeros',
    label: 'Transporte de Viajeros',
    desc: 'Autocares, minibuses, VTC, excursiones, escolar',
    icon: <Bus className="w-6 h-6" />,
    color: 'bg-blue-50 border-blue-400 text-blue-800',
    activeColor: 'border-blue-500 bg-blue-50',
  },
  {
    id: 'mercancias',
    label: 'Transporte de Mercancías',
    desc: 'Logística, cargas completas, grupaje, ADR',
    icon: <Truck className="w-6 h-6" />,
    color: 'bg-amber-50 border-amber-400 text-amber-800',
    activeColor: 'border-amber-500 bg-amber-50',
  },
  {
    id: 'reparto',
    label: 'Reparto / Última Milla',
    desc: 'Mensajería, e-commerce, paquetería, farmacia',
    icon: <Package className="w-6 h-6" />,
    color: 'bg-emerald-50 border-emerald-400 text-emerald-800',
    activeColor: 'border-emerald-500 bg-emerald-50',
  },
  {
    id: 'combinada',
    label: 'Combinada',
    desc: 'Servicios de viajeros y mercancías',
    icon: <Layers className="w-6 h-6" />,
    color: 'bg-purple-50 border-purple-400 text-purple-800',
    activeColor: 'border-purple-500 bg-purple-50',
  },
];

const TIPOS_POR_ESPECIALIDAD: Record<string, { id: string; label: string }[]> = {
  viajeros: [
    { id: 'excursiones', label: 'Excursiones y turismo' },
    { id: 'traslados', label: 'Traslados aeropuerto/hotel' },
    { id: 'escolar', label: 'Transporte escolar' },
    { id: 'trabajadores', label: 'Trabajadores / empresa' },
    { id: 'multiday', label: 'Viajes multidía' },
    { id: 'agencias', label: 'Contratos con agencias' },
    { id: 'otros_viajeros', label: 'Otros servicios de viajeros' },
  ],
  mercancias: [
    { id: 'reparto_local', label: 'Reparto local / urbano' },
    { id: 'logistica', label: 'Logística y almacenaje' },
    { id: 'carga_completa', label: 'Cargas completas (FTL)' },
    { id: 'grupaje', label: 'Grupaje (LTL)' },
    { id: 'internacional', label: 'Internacional / export' },
    { id: 'frigorificos_adr', label: 'Frigoríficos / mercancías ADR' },
    { id: 'otros_mercancias', label: 'Otros servicios de mercancías' },
  ],
  reparto: [
    { id: 'mensajeria', label: 'Mensajería urgente' },
    { id: 'ecommerce', label: 'E-commerce / paquetería' },
    { id: 'farmacias', label: 'Farmacias / sanitario' },
    { id: 'alimentos', label: 'Alimentación y bebidas' },
    { id: 'otros_reparto', label: 'Otros servicios de reparto' },
  ],
  combinada: [
    { id: 'viajeros_y_mercancias', label: 'Viajeros y mercancías' },
    { id: 'mixto', label: 'Servicios mixtos según demanda' },
  ],
};

const STEPS = [
  { id: 1, title: 'Tu empresa',    icon: <Building2 className="w-4 h-4" /> },
  { id: 2, title: 'Especialidad',  icon: <Bus className="w-4 h-4" /> },
  { id: 3, title: 'Servicios',     icon: <MapPin className="w-4 h-4" /> },
  { id: 4, title: 'Tarifas',       icon: <Gauge className="w-4 h-4" /> },
  { id: 5, title: 'Flota',         icon: <Truck className="w-4 h-4" /> },
  { id: 6, title: 'Conductores',   icon: <Users className="w-4 h-4" /> },
  { id: 7, title: 'Calendario',    icon: <CalendarDays className="w-4 h-4" /> },
  { id: 8, title: 'Licencia',      icon: <Shield className="w-4 h-4" /> },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TransportOnboardingWizard({ onComplete, showToast }: Props) {
  const { org, user } = useSession();
  const orgId = org?.id ?? '';
  const orgAny = org as unknown as Record<string, unknown>;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);

  // Step 1 — empresa
  const [empresa, setEmpresa] = useState({
    nombre:         (orgAny?.nombre as string) ?? '',
    nif:            (orgAny?.nif as string) ?? '',
    direccion:      (orgAny?.direccion as string) ?? '',
    localidad:      ((orgAny?.localidad ?? orgAny?.ciudad) as string) ?? '',
    cp:             (orgAny?.cp as string) ?? '',
    provincia:      (orgAny?.provincia as string) ?? '',
    telefono_movil: ((orgAny?.telefono_movil ?? orgAny?.telefono) as string) ?? '',
    email:          (orgAny?.email as string) ?? '',
    iban:           (orgAny?.iban as string) ?? '',
    banco:          (orgAny?.banco as string) ?? '',
    titular_cuenta: (orgAny?.titular_cuenta as string) ?? '',
  });

  // Step 2 — especialidad
  const [especialidad, setEspecialidad] = useState<string>('');

  // Step 3 — tipos de servicio
  const [tiposServicio, setTiposServicio] = useState<Set<string>>(new Set());

  // Step 4 — tarifas (start empty; only saved when user enters explicit values)
  const [tarifas, setTarifas] = useState({
    precio_km:       null as number | null,
    precio_hora:     null as number | null,
    precio_jornada:  null as number | null,
    precio_trayecto: null as number | null,
    iva_default:     null as number | null,
  });

  // Step 7 — calendario
  const [wizCalendar] = useState<WorkCalendar>(() => loadWorkCalendar() ?? DEFAULT_CALENDAR);

  // ── Saves ──────────────────────────────────────────────────────────────────

  async function saveStep1() {
    if (!orgId) return;
    const orgData = {
      nombre:         empresa.nombre,
      nif:            empresa.nif,
      direccion:      empresa.direccion,
      localidad:      empresa.localidad,
      cp:             empresa.cp,
      provincia:      empresa.provincia,
      telefono_movil: empresa.telefono_movil,
      email:          empresa.email,
      iban:           empresa.iban,
      banco:          empresa.banco,
      titular_cuenta: empresa.titular_cuenta,
    };
    const { error } = await supabase.from('trade_organizations').update(orgData).eq('id', orgId);
    if (error) console.error('[TransportOnboarding saveStep1]', error.message);
    // Write to org-scoped key (prevents cross-org data bleed when switching accounts)
    // Also write to legacy tf_biz_config for BC with billing/invoice generation readers
    const bizData = {
      nombre:        empresa.nombre,
      nif:           empresa.nif,
      direccion:     empresa.direccion,
      localidad:     empresa.localidad,
      cp:            empresa.cp,
      provincia:     empresa.provincia,
      telefonoMovil: empresa.telefono_movil,
      email:         empresa.email,
      iban:          empresa.iban,
      banco:         empresa.banco,
      titularCuenta: empresa.titular_cuenta,
    };
    try {
      const stored = JSON.parse(localStorage.getItem(`tf_biz_config_${orgId}`) ?? '{}');
      localStorage.setItem(`tf_biz_config_${orgId}`, JSON.stringify({ ...stored, ...bizData }));
      // BC: keep global key updated so invoice generation still works
      const storedGlobal = JSON.parse(localStorage.getItem('tf_biz_config') ?? '{}');
      localStorage.setItem('tf_biz_config', JSON.stringify({ ...storedGlobal, ...bizData }));
    } catch { /* storage unavailable (private mode) — non-fatal */ }
  }

  async function saveStep2And3() {
    if (!orgId || !especialidad) return;
    // Store modalidad and service types in separate columns — not mixed in a single array
    await supabase.from('trade_organizations')
      .update({
        transport_modalidad:     especialidad,
        transport_service_types: Array.from(tiposServicio),
      } as Record<string, unknown>)
      .eq('id', orgId);
  }

  async function saveStep4() {
    if (!orgId) return;
    // Build rate object with only non-null values — do not save empty placeholders
    const rates: Record<string, number> = {};
    if (tarifas.precio_km !== null)       rates.precio_km = tarifas.precio_km;
    if (tarifas.precio_hora !== null)     rates.precio_hora = tarifas.precio_hora;
    if (tarifas.precio_jornada !== null)  rates.precio_jornada = tarifas.precio_jornada;
    if (tarifas.precio_trayecto !== null) rates.precio_trayecto = tarifas.precio_trayecto;

    // Persist to DB: device-independent storage (transport_rates JSONB + iva_default)
    if (Object.keys(rates).length > 0) {
      await supabase.from('trade_organizations')
        .update({ transport_rates: rates } as Record<string, unknown>)
        .eq('id', orgId);
    }
    if (tarifas.iva_default !== null) {
      await supabase.from('trade_organizations')
        .update({ iva_default: tarifas.iva_default })
        .eq('id', orgId);
    }

    // Org-scoped localStorage (transport-specific config, separate from installer config)
    try {
      const stored = JSON.parse(localStorage.getItem(`tf_transport_config_${orgId}`) ?? '{}');
      localStorage.setItem(`tf_transport_config_${orgId}`, JSON.stringify({
        ...stored,
        rates,
        iva_default: tarifas.iva_default,
      }));
    } catch { /* storage unavailable — rates already persisted to DB */ }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async function handleNext() {
    setSaving(true);
    try {
      if (step === 1) await saveStep1();
      if (step === 3) await saveStep2And3();
      if (step === 4) await saveStep4();
      if (step === 7) saveWorkCalendar(wizCalendar);
      setStep(s => Math.min(s + 1, STEPS.length));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('Error al guardar: ' + msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handlePrev() { setStep(s => Math.max(s - 1, 1)); }

  function handleSkip() { setConfirmSkip(true); }

  function doSkip() {
    if (orgId) supabase.from('trade_organizations').update({ is_onboarded: true }).eq('id', orgId).then(() => {});
    onComplete();
  }

  async function handleComplete() {
    setSaving(true);
    try {
      if (orgId) {
        await supabase.from('trade_organizations').update({ is_onboarded: true }).eq('id', orgId);
      }
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLast = step === STEPS.length;
  const tiposDisponibles = TIPOS_POR_ESPECIALIDAD[especialidad] ?? [];

  if (confirmSkip) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-900 mb-2">¿Saltar configuración?</h3>
          <p className="text-sm text-slate-500 mb-6">Podrás completarla desde Ajustes en cualquier momento.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmSkip(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
              Continuar
            </button>
            <button onClick={doSkip} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-white cursor-pointer transition-colors">
              Saltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white flex overflow-hidden">

      {/* Sidebar */}
      <div className="w-56 shrink-0 bg-slate-900 flex flex-col p-6">
        <div className="mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-3">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <p className="text-white font-black text-sm">TrabFlow</p>
          <p className="text-blue-400 text-xs font-semibold">Módulo Transporte</p>
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          {STEPS.map(s => {
            const done   = s.id < step;
            const active = s.id === step;
            return (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${active ? 'bg-blue-600' : done ? 'bg-slate-800' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${active ? 'bg-white text-blue-600' : done ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {done ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <p className={`text-xs font-semibold ${active ? 'text-white' : done ? 'text-slate-300' : 'text-slate-500'}`}>{s.title}</p>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-800">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Paso {step} de {STEPS.length}</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            {STEPS[step - 1].icon}
            <span className="text-sm font-semibold">{STEPS[step - 1].title}</span>
          </div>
          <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer transition-colors">
            <X className="w-3.5 h-3.5" />Saltar configuración
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-7">
          <div className="max-w-2xl space-y-6">

            {/* ── Step 1: Empresa ─────────────────────────────────── */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Datos de tu empresa</h2>
                  <p className="text-sm text-slate-500 mt-1">Aparecerán en presupuestos y facturas. Puedes modificarlos después en Ajustes.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre comercial / Razón social *</label>
                    <input type="text" value={empresa.nombre} onChange={e => setEmpresa(p => ({ ...p, nombre: e.target.value }))} placeholder="Autocares Mediterráneo S.L." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">NIF / CIF *</label>
                    <input type="text" value={empresa.nif} onChange={e => setEmpresa(p => ({ ...p, nif: e.target.value }))} placeholder="B-12345678" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono</label>
                    <input type="text" value={empresa.telefono_movil} onChange={e => setEmpresa(p => ({ ...p, telefono_movil: e.target.value }))} placeholder="966 123 456" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                    <input type="text" value={empresa.email} onChange={e => setEmpresa(p => ({ ...p, email: e.target.value }))} placeholder="info@miempresa.com" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Dirección</label>
                    <input type="text" value={empresa.direccion} onChange={e => setEmpresa(p => ({ ...p, direccion: e.target.value }))} placeholder="Polígono Industrial Norte, Nave 12" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Localidad</label>
                    <input type="text" value={empresa.localidad} onChange={e => setEmpresa(p => ({ ...p, localidad: e.target.value }))} placeholder="Valencia" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">C.P.</label>
                    <input type="text" value={empresa.cp} onChange={e => setEmpresa(p => ({ ...p, cp: e.target.value }))} placeholder="46001" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Provincia</label>
                    <input type="text" value={empresa.provincia} onChange={e => setEmpresa(p => ({ ...p, provincia: e.target.value }))} placeholder="Valencia" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="border-t border-slate-100 col-span-2 pt-4 space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Datos bancarios (para facturas)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">IBAN</label>
                        <input type="text" value={empresa.iban} onChange={e => setEmpresa(p => ({ ...p, iban: e.target.value }))} placeholder="ES12 3456 7890 1234 5678 9012" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Banco</label>
                        <input type="text" value={empresa.banco} onChange={e => setEmpresa(p => ({ ...p, banco: e.target.value }))} placeholder="BBVA" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Titular de la cuenta</label>
                        <input type="text" value={empresa.titular_cuenta} onChange={e => setEmpresa(p => ({ ...p, titular_cuenta: e.target.value }))} placeholder="Autocares Mediterráneo S.L." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2: Especialidad ─────────────────────────────── */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">¿Cuál es tu especialidad?</h2>
                  <p className="text-sm text-slate-500 mt-1">Selecciona el tipo de transporte principal de tu empresa. Esto personalizará el módulo para tu actividad.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ESPECIALIDADES.map(esp => {
                    const selected = especialidad === esp.id;
                    return (
                      <button
                        key={esp.id}
                        onClick={() => {
                          setEspecialidad(esp.id);
                          setTiposServicio(new Set());
                        }}
                        className={`flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${selected ? esp.activeColor + ' shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className={`p-2 rounded-lg ${selected ? 'bg-white/60' : 'bg-slate-100'}`}>
                          {esp.icon}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{esp.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{esp.desc}</p>
                        </div>
                        {selected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!especialidad && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2.5 rounded-lg">Selecciona una especialidad para continuar.</p>
                )}
              </>
            )}

            {/* ── Step 3: Tipos de servicio ───────────────────────── */}
            {step === 3 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tipos de servicio</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Selecciona los servicios que ofreces dentro de{' '}
                    <strong>{ESPECIALIDADES.find(e => e.id === especialidad)?.label ?? especialidad}</strong>.
                  </p>
                </div>
                {tiposDisponibles.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {tiposDisponibles.map(tipo => {
                      const sel = tiposServicio.has(tipo.id);
                      return (
                        <button
                          key={tipo.id}
                          onClick={() => setTiposServicio(prev => {
                            const next = new Set(prev);
                            sel ? next.delete(tipo.id) : next.add(tipo.id);
                            return next;
                          })}
                          className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left text-sm font-semibold cursor-pointer transition-all ${sel ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                        >
                          {sel && (
                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {!sel && <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />}
                          <span className="text-xs">{tipo.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Vuelve al paso anterior y elige una especialidad.</p>
                )}
                <p className="text-xs text-slate-400">Selecciona todos los que apliquen. Puedes cambiarlos después.</p>
              </>
            )}

            {/* ── Step 4: Tarifas ─────────────────────────────────── */}
            {step === 4 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tarifas comerciales</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Configura las tarifas reales de tu empresa. Los campos vacíos no se guardarán.
                    Puedes completarlos ahora o más tarde desde Ajustes.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 mb-1">
                  <strong>Ejemplos orientativos (no se guardan automáticamente):</strong>{' '}
                  €/km: 0,90 · €/h: 45 · €/jornada: 320
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Precio por kilómetro',  key: 'precio_km',       suffix: '€/km',      color: 'blue',    step: 0.01, placeholder: 'Ej. 0,90', hint: 'Tarifa base para servicios por distancia.' },
                    { label: 'Precio por hora',        key: 'precio_hora',     suffix: '€/h',       color: 'amber',   step: 1,    placeholder: 'Ej. 45',   hint: 'Tarifa base para servicios por tiempo.' },
                    { label: 'Precio por jornada',     key: 'precio_jornada',  suffix: '€/jornada',  color: 'emerald', step: 1,    placeholder: 'Ej. 320',  hint: 'Jornada completa (8-10h). Solo si aplica a tu modelo.' },
                    { label: 'Precio por trayecto',    key: 'precio_trayecto', suffix: '€/trayecto', color: 'purple',  step: 1,    placeholder: 'Opcional', hint: 'Precio fijo por ruta definida. Dejar vacío si no aplica.' },
                    { label: 'IVA por defecto',        key: 'iva_default',     suffix: '%',          color: 'slate',   step: 1,    placeholder: '10 ó 21',  hint: 'Viajeros: 10%. Mercancías: 21%. Confirmar con asesor fiscal.' },
                  ].map(f => (
                    <div key={f.key} className={`bg-${f.color}-50 border border-${f.color}-100 rounded-xl p-4`}>
                      <label className={`text-xs font-bold text-${f.color}-600 uppercase tracking-wider block mb-2`}>{f.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={f.step}
                          value={tarifas[f.key as keyof typeof tarifas] ?? ''}
                          placeholder={f.placeholder}
                          onChange={e => setTarifas(p => ({
                            ...p,
                            [f.key]: e.target.value === '' ? null : parseFloat(e.target.value),
                          }))}
                          className={`flex-1 bg-white border border-${f.color}-200 rounded-lg px-3 py-2 text-xl font-bold text-slate-900 focus:outline-none focus:border-${f.color}-500 placeholder:text-slate-300`}
                        />
                        <span className="text-slate-500 font-semibold text-sm">{f.suffix}</span>
                      </div>
                      <p className={`text-[11px] text-${f.color}-500 mt-1.5`}>{f.hint}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Step 5: Flota ─────────────────────────────────────── */}
            {step === 5 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tu flota de vehículos</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    En el módulo <strong>Transporte → Flota</strong> puedes registrar cada vehículo con su matrícula, tipo, capacidad y documentación.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-blue-900 text-sm">Registro de flota disponible</p>
                      <p className="text-xs text-blue-700 mt-1">Una vez termines la configuración, accede a <strong>Transporte → Flota</strong> para añadir tus vehículos.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {['Matrícula y marca', 'Tipo de vehículo', 'Capacidad y plazas', 'ITV y seguro', 'Estado operativo', 'Asignación conductores'].map(item => (
                          <div key={item} className="flex items-center gap-1.5 text-blue-800">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Plan Demo: hasta {TRANSPORT_DEMO_LIMITS.maxVehicles} vehículos</p>
                    <p className="text-xs text-amber-700 mt-0.5">En el plan demo puedes registrar hasta {TRANSPORT_DEMO_LIMITS.maxVehicles} vehículos. El plan de producción no tiene límite por vehículo.</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 6: Conductores ──────────────────────────────── */}
            {step === 6 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tu equipo de conductores</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    En <strong>Transporte → Conductores</strong> gestionas tu equipo: permisos, disponibilidad y asignación a servicios.
                  </p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-emerald-900 text-sm">Gestión de conductores disponible</p>
                      <p className="text-xs text-emerald-700 mt-1">Añade tu equipo una vez termines. Cada conductor tiene su perfil, disponibilidad y partes de trabajo.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {['Datos del conductor', 'Tipo de carné', 'Disponibilidad', 'Partes de servicio', 'Asignación a rutas', 'App móvil conductor'].map(item => (
                          <div key={item} className="flex items-center gap-1.5 text-emerald-800">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Users className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Plan Demo: hasta {TRANSPORT_DEMO_LIMITS.maxDrivers} conductores</p>
                    <p className="text-xs text-amber-700 mt-0.5">En el plan demo puedes registrar hasta {TRANSPORT_DEMO_LIMITS.maxDrivers} conductores activos. El plan de producción no tiene límite.</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 7: Calendario ───────────────────────────────── */}
            {step === 7 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Horario y festivos</h2>
                  <p className="text-sm text-slate-500 mt-1">Configura el horario base de tu empresa. Afecta a la agenda y a la planificación de servicios.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Días laborables</p>
                    <div className="flex gap-2 flex-wrap">
                      {DAY_NAMES.map((name, i) => {
                        const active = wizCalendar.workDays[i]?.active ?? false;
                        return (
                          <button
                            key={name}
                            onClick={() => {
                              wizCalendar.workDays[i] = {
                                ...(wizCalendar.workDays[i] ?? { start: '08:00', end: '20:00' }),
                                active: !active,
                              };
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Hora inicio (días activos)</label>
                      <input type="time"
                        defaultValue={wizCalendar.workDays[1]?.start ?? '08:00'}
                        onChange={e => {
                          Object.keys(wizCalendar.workDays).forEach(k => {
                            if (wizCalendar.workDays[Number(k)]?.active) {
                              wizCalendar.workDays[Number(k)].start = e.target.value;
                            }
                          });
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Hora fin (días activos)</label>
                      <input type="time"
                        defaultValue={wizCalendar.workDays[1]?.end ?? '20:00'}
                        onChange={e => {
                          Object.keys(wizCalendar.workDays).forEach(k => {
                            if (wizCalendar.workDays[Number(k)]?.active) {
                              wizCalendar.workDays[Number(k)].end = e.target.value;
                            }
                          });
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Festivos registrados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {wizCalendar.holidays.slice(0, 8).map(h => (
                        <span key={h.id} className="bg-red-50 text-red-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-red-200">
                          {h.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">Puedes ajustar los festivos en Ajustes → Calendario.</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 8: Licencia ─────────────────────────────────── */}
            {step === 8 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tu plan: Transporte Demo</h2>
                  <p className="text-sm text-slate-500 mt-1">Acceso completo al módulo de transporte durante el periodo de prueba.</p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-lg">Transporte Demo</p>
                      <p className="text-blue-100 text-xs">Activo durante el periodo de prueba</p>
                    </div>
                    <div className="ml-auto">
                      <span className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">DEMO</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <Truck className="w-4 h-4" />,  label: `~${TRANSPORT_DEMO_LIMITS.maxVehicles} vehículos (referencia)` },
                      { icon: <Users className="w-4 h-4" />,  label: `~${TRANSPORT_DEMO_LIMITS.maxDrivers} conductores (referencia)` },
                      { icon: <MapPin className="w-4 h-4" />, label: 'Partes de servicio' },
                      { icon: <Clock className="w-4 h-4" />,  label: 'Agenda y ruta del día' },
                      { icon: <Star className="w-4 h-4" />,   label: 'Presupuestos y facturas' },
                      { icon: <Shield className="w-4 h-4" />, label: 'Soporte incluido' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 bg-white/10 rounded-lg p-2.5">
                        <span className="text-blue-200">{item.icon}</span>
                        <span className="text-xs font-semibold text-white">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Plan de producción (próximamente)</p>
                  <p className="text-sm text-slate-700">
                    El plan completo de <strong>Transporte Profesional</strong> incluirá flota ilimitada, integraciones con tacógrafos digitales, facturación automática y soporte prioritario.
                  </p>
                  <p className="text-xs text-slate-500 mt-2">Contacta con nosotros para conocer la tarifa para tu empresa.</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Todo listo para empezar</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {empresa.nombre ? `${empresa.nombre} tiene` : 'Tu empresa tiene'} acceso completo al módulo de transporte.
                      Pulsa <strong>Finalizar</strong> para acceder al panel.
                    </p>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer nav */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />Anterior
          </button>

          {isLast ? (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Finalizar configuración
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={saving || (step === 2 && !especialidad)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Siguiente<ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
