/**
 * Asistente paso a paso para emitir un DeCA (mercancías) o una hoja de ruta (viajeros).
 * Una pregunta por pantalla, botones grandes, pensado para el móvil del conductor.
 * En PC se muestra como ventana centrada.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, X, MapPin, Plus, Loader2, Clock, Truck, Bus, AlertTriangle,
  CheckCircle2, Delete, Search,
} from 'lucide-react';
import { loadVehicles, loadConductores, type TradeVehicle } from '../../lib/transport';
import { loadClients, type TradeClient, type TradeWorker } from '../../lib/supabase';
import {
  emitTransportDoc, reverseGeocode, loadOrgTransportista,
  isValidNif, normalizeNif, isValidPlate, normalizePlate,
  madridToday, madridNowHHMM, fmtFechaEs, fmtPesoKg,
  MERCANCIAS_FRECUENTES, NATURALEZA_SERVICIO_OPCIONES, NATURALEZA_SERVICIO_LABEL,
  type TransportDocTipo, type TransportDocInput, type TransportControlDoc,
  type NaturalezaServicio, type EmitResult, TransportDocError,
} from '../../lib/transportDocs';

interface Props {
  orgId: string;
  tipo: TransportDocTipo;
  onClose: () => void;
  onEmitted: (r: EmitResult) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  /** Datos de partida (p. ej. desde un servicio o viaje ya planificado). */
  prefill?: Partial<TransportDocInput>;
  /** Si se indica, el nuevo documento sustituye a este (modificación). */
  sustituye?: TransportControlDoc;
}

interface Form {
  vehicle_id: string | null;
  matricula_vehiculo: string;
  client_id: string | null;
  cargador_nombre: string;
  cargador_nif: string;
  cargador_domicilio: string;
  origen: string;
  destino: string;
  paradas: { nombre: string; hora: string }[];
  naturaleza_mercancia: string;
  peso_kg: number;
  sin_peso: boolean;
  otra_magnitud: string;
  fecha_servicio: string;
  hora_salida: string;
  fin_fecha: string;
  fin_hora: string;
  sin_remolque: boolean;
  matricula_remolque: string;
  autorizacion_especial: string;
  conductor_id: string | null;
  conductor_nombre: string;
  conductor_nif: string;
  naturaleza_servicio: NaturalezaServicio | '';
  servicio_referencia: string;
  observaciones: string;
  motivo: string;
}

function initialForm(p: Partial<TransportDocInput> | undefined, s: TransportControlDoc | undefined): Form {
  const src: Partial<TransportDocInput> = s ? {
    ...s, paradas: s.paradas, peso_kg: s.peso_kg ?? undefined,
    naturaleza_servicio: s.naturaleza_servicio ?? undefined,
  } as Partial<TransportDocInput> : (p ?? {});
  const fin = src.fecha_fin ? new Date(src.fecha_fin) : null;
  const finParts = fin ? {
    f: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fin),
    h: new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(fin),
  } : { f: '', h: '' };
  const hoy = madridToday();
  return {
    vehicle_id: src.vehicle_id ?? null,
    matricula_vehiculo: src.matricula_vehiculo ?? '',
    client_id: src.client_id ?? null,
    cargador_nombre: src.cargador_nombre ?? '',
    cargador_nif: src.cargador_nif ?? '',
    cargador_domicilio: src.cargador_domicilio ?? '',
    origen: src.origen ?? '',
    destino: src.destino ?? '',
    paradas: (src.paradas ?? []).map(x => ({ nombre: x.nombre, hora: x.hora ?? '' })),
    naturaleza_mercancia: src.naturaleza_mercancia ?? '',
    peso_kg: src.peso_kg ?? 0,
    sin_peso: !!src.otra_magnitud && src.peso_kg == null,
    otra_magnitud: src.otra_magnitud ?? '',
    fecha_servicio: src.fecha_servicio && src.fecha_servicio >= hoy ? src.fecha_servicio : hoy,
    hora_salida: src.hora_salida?.slice(0, 5) ?? '',
    fin_fecha: finParts.f,
    fin_hora: finParts.h,
    sin_remolque: !src.matricula_remolque,
    matricula_remolque: src.matricula_remolque ?? '',
    autorizacion_especial: src.autorizacion_especial ?? '',
    conductor_id: src.conductor_id ?? null,
    conductor_nombre: src.conductor_nombre ?? '',
    conductor_nif: src.conductor_nif ?? '',
    naturaleza_servicio: (src.naturaleza_servicio as NaturalezaServicio) ?? '',
    servicio_referencia: src.servicio_referencia ?? '',
    observaciones: src.observaciones ?? '',
    motivo: '',
  };
}

type StepId =
  | 'vehiculo' | 'cargador' | 'ruta' | 'mercancia' | 'fecha' | 'remolque'
  | 'conductor' | 'naturaleza' | 'fechas_viaje' | 'observaciones' | 'resumen';

const STEPS: Record<TransportDocTipo, StepId[]> = {
  deca:      ['vehiculo', 'cargador', 'ruta', 'mercancia', 'fecha', 'remolque', 'observaciones', 'resumen'],
  hoja_ruta: ['vehiculo', 'cargador', 'conductor', 'naturaleza', 'ruta', 'fechas_viaje', 'observaciones', 'resumen'],
};

// ── Piezas de UI ──────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-lg text-gray-900 placeholder-gray-300 focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-100';
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-2xl border-2 px-4 py-3.5 text-left text-base font-medium transition-colors ${
        active ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-white text-gray-800 hover:border-amber-400'
      }`}>
      {children}
    </button>
  );
}

function Hint({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <p className={`mt-2 text-sm font-medium ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{ok ? '✓ ' : ''}{children}</p>;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function TransportDocWizard({ orgId, tipo, onClose, onEmitted, showToast, prefill, sustituye }: Props) {
  const [form, setForm] = useState<Form>(() => initialForm(prefill, sustituye));
  const [stepIdx, setStepIdx] = useState(0);
  const [vehicles, setVehicles] = useState<TradeVehicle[]>([]);
  const [conductores, setConductores] = useState<TradeWorker[]>([]);
  const [clients, setClients] = useState<TradeClient[]>([]);
  const [orgNifOk, setOrgNifOk] = useState<boolean | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locatedMsg, setLocatedMsg] = useState<string | null>(null);
  const [emitting, setEmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = STEPS[tipo];
  const step = steps[stepIdx];
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadVehicles(orgId).catch(() => [] as TradeVehicle[]),
      loadConductores(orgId).catch(() => [] as TradeWorker[]),
      loadClients(orgId).catch(() => [] as TradeClient[]),
      loadOrgTransportista(orgId).catch(() => ({ nombre: '', nif: null, direccion: null })),
    ]).then(([v, c, cl, org]) => {
      if (!alive) return;
      setVehicles(v.filter(x => x.activo !== false && x.estado !== 'baja'));
      setConductores(c.filter(x => x.activo !== false));
      setClients(cl);
      setOrgNifOk(!!org.nif && isValidNif(org.nif));
    });
    return () => { alive = false; };
  }, [orgId]);

  const vehiculosTipo = useMemo(() => vehicles.filter(v =>
    tipo === 'deca' ? v.modalidad !== 'viajeros' : (v.modalidad === 'viajeros' || v.modalidad === 'mixto')
  ), [vehicles, tipo]);

  const clientesFiltrados = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 6);
    return clients.filter(c => `${c.nombre} ${c.apellidos ?? ''} ${c.nif ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [clients, clientQuery]);

  // ── Validación por paso ─────────────────────────────────────────────────────
  const stepError = (s: StepId): string | null => {
    switch (s) {
      case 'vehiculo':
        return isValidPlate(form.matricula_vehiculo) ? null : 'Escriba una matrícula válida';
      case 'cargador':
        if (!form.cargador_nombre.trim()) return tipo === 'deca' ? 'Falta el nombre del cargador' : 'Falta el nombre del contratante';
        if (!form.cargador_nif.trim() || !isValidNif(form.cargador_nif)) return 'El NIF no es válido';
        if (tipo === 'deca' && !form.cargador_domicilio.trim()) return 'Falta el domicilio del cargador';
        return null;
      case 'ruta':
        if (!form.origen.trim()) return 'Falta el lugar de origen';
        if (!form.destino.trim()) return 'Falta el lugar de destino';
        if (form.paradas.some(p => p.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora))) return 'Revise la hora de las paradas';
        return null;
      case 'mercancia':
        if (!form.naturaleza_mercancia.trim()) return 'Indique qué lleva';
        if (form.sin_peso) return form.otra_magnitud.trim() ? null : 'Indique la cantidad (bultos, m³, litros…)';
        return form.peso_kg > 0 ? null : 'Indique el peso';
      case 'fecha':
        if (!form.fecha_servicio || form.fecha_servicio < madridToday()) return 'La fecha no puede ser anterior a hoy';
        return form.hora_salida ? null : 'Indique la hora de salida';
      case 'fechas_viaje':
        if (!form.fecha_servicio || form.fecha_servicio < madridToday()) return 'La fecha no puede ser anterior a hoy';
        if (!form.hora_salida) return 'Indique la hora de salida';
        if (form.fin_fecha && `${form.fin_fecha}T${form.fin_hora || '23:59'}` <= `${form.fecha_servicio}T${form.hora_salida}`) {
          return 'El regreso debe ser posterior a la salida';
        }
        return null;
      case 'remolque':
        return form.sin_remolque || isValidPlate(form.matricula_remolque) ? null : 'Escriba la matrícula del remolque o pulse «No llevo remolque»';
      case 'conductor':
        if (!form.conductor_nombre.trim()) return 'Falta el nombre del conductor';
        return form.conductor_nif.trim() && isValidNif(form.conductor_nif) ? null : 'El NIF del conductor no es válido';
      case 'naturaleza':
        if (!form.naturaleza_servicio) return 'Elija el tipo de servicio';
        if ((form.naturaleza_servicio === 'refuerzo_regular' || form.naturaleza_servicio === 'colaboracion_regular_especial') && !form.servicio_referencia.trim()) {
          return 'Indique la línea o el transporte al que da servicio';
        }
        return null;
      case 'observaciones':
        return null;
      case 'resumen':
        return sustituye && !form.motivo.trim() ? 'Indique el motivo de la modificación' : null;
    }
  };

  const currentError = stepError(step);
  const goNext = () => { if (!currentError) { setError(null); setStepIdx(i => Math.min(i + 1, steps.length - 1)); } else setError(currentError); };
  const goBack = () => { setError(null); if (stepIdx === 0) onClose(); else setStepIdx(i => i - 1); };

  // ── Acciones ────────────────────────────────────────────────────────────────
  const locate = () => {
    if (!navigator.geolocation) { showToast('Este dispositivo no permite la ubicación', 'error'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const addr = await reverseGeocode(orgId, pos.coords.latitude, pos.coords.longitude);
        if (addr) { set('origen', addr); setLocatedMsg('Ubicación puesta. Revísela y corríjala si hace falta.'); }
        else showToast('No se encontró una dirección para su ubicación', 'info');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'No se pudo obtener la dirección', 'error');
      } finally { setLocating(false); }
    }, () => { setLocating(false); showToast('Permita el acceso a la ubicación para usar esta opción', 'error'); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };

  const pickClient = (c: TradeClient) => {
    const domicilio = [c.direccion, [c.cp, c.ciudad].filter(Boolean).join(' '), c.provincia ? `(${c.provincia})` : '']
      .filter(Boolean).join(', ');
    setForm(f => ({
      ...f, client_id: c.id,
      cargador_nombre: [c.nombre, c.apellidos].filter(Boolean).join(' '),
      cargador_nif: c.nif ?? '', cargador_domicilio: domicilio,
    }));
    setClientQuery('');
  };

  const buildInput = (): TransportDocInput => {
    let fechaFin: string | null = null;
    if (tipo === 'hoja_ruta' && form.fin_fecha) {
      // Hora peninsular → ISO con desfase correcto
      const local = `${form.fin_fecha}T${form.fin_hora || '23:59'}:00`;
      const guess = new Date(`${local}Z`);
      const off = new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).getTime() - new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
      fechaFin = new Date(guess.getTime() - off).toISOString();
    }
    return {
      vehicle_id: form.vehicle_id, matricula_vehiculo: normalizePlate(form.matricula_vehiculo),
      client_id: form.client_id,
      cargador_nombre: form.cargador_nombre.trim(),
      cargador_nif: normalizeNif(form.cargador_nif),
      cargador_domicilio: form.cargador_domicilio.trim() || null,
      origen: form.origen.trim(), destino: form.destino.trim(),
      paradas: form.paradas.filter(p => p.nombre.trim()).map(p => ({ nombre: p.nombre.trim(), hora: p.hora || null })),
      fecha_servicio: form.fecha_servicio, hora_salida: form.hora_salida || null, fecha_fin: fechaFin,
      naturaleza_mercancia: tipo === 'deca' ? form.naturaleza_mercancia.trim() : null,
      peso_kg: tipo === 'deca' && !form.sin_peso ? form.peso_kg : null,
      otra_magnitud: tipo === 'deca' && form.sin_peso ? form.otra_magnitud.trim() : null,
      autorizacion_especial: tipo === 'deca' ? form.autorizacion_especial.trim() || null : null,
      matricula_remolque: tipo === 'deca' && !form.sin_remolque ? normalizePlate(form.matricula_remolque) : null,
      conductor_id: form.conductor_id,
      conductor_nombre: form.conductor_nombre.trim() || null,
      conductor_nif: form.conductor_nif.trim() ? normalizeNif(form.conductor_nif) : null,
      naturaleza_servicio: tipo === 'hoja_ruta' ? (form.naturaleza_servicio || null) : null,
      servicio_referencia: tipo === 'hoja_ruta' ? form.servicio_referencia.trim() || null : null,
      observaciones: form.observaciones.trim() || null,
      service_id: prefill?.service_id ?? sustituye?.service_id ?? null,
      trip_id: prefill?.trip_id ?? sustituye?.trip_id ?? null,
    };
  };

  const emitir = async () => {
    const err = steps.map(stepError).find(Boolean);
    if (err) { setError(err); return; }
    setEmitting(true); setError(null);
    try {
      const r = await emitTransportDoc(orgId, tipo, buildInput(), sustituye ? { sustituyeA: sustituye.id, motivo: form.motivo.trim() } : {});
      showToast(`${tipo === 'deca' ? 'DeCA' : 'Hoja de ruta'} ${r.numero} emitido`, 'success');
      onEmitted(r);
    } catch (e) {
      setError(e instanceof TransportDocError || e instanceof Error ? e.message : 'No se pudo emitir el documento');
    } finally { setEmitting(false); }
  };

  // ── Render de cada paso ─────────────────────────────────────────────────────
  const titulo = tipo === 'deca' ? 'DeCA de mercancías' : 'Hoja de ruta de viajeros';

  const renderStep = () => {
    switch (step) {
      case 'vehiculo': {
        const okPlate = isValidPlate(form.matricula_vehiculo);
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">{tipo === 'deca' ? '¿Con qué camión va?' : '¿Con qué autobús va?'}</h2>
            {vehiculosTipo.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {vehiculosTipo.map(v => (
                  <Chip key={v.id} active={form.vehicle_id === v.id}
                    onClick={() => setForm(f => ({ ...f, vehicle_id: v.id, matricula_vehiculo: v.matricula }))}>
                    <span className="flex items-center gap-2">
                      {tipo === 'deca' ? <Truck size={18} className="text-amber-600" /> : <Bus size={18} className="text-amber-600" />}
                      <span><span className="font-mono font-bold">{v.matricula}</span><span className="block text-xs text-gray-500">{v.nombre}</span></span>
                    </span>
                  </Chip>
                ))}
              </div>
            )}
            <p className="mt-5 text-base text-gray-500">{vehiculosTipo.length ? 'O escriba la matrícula:' : 'Escriba la matrícula:'}</p>
            <input className={`${inputCls} mt-2 text-center font-mono text-2xl tracking-widest uppercase`}
              value={form.matricula_vehiculo} placeholder="1234 BCD" autoCapitalize="characters"
              onChange={e => setForm(f => ({ ...f, matricula_vehiculo: e.target.value.toUpperCase(), vehicle_id: null }))} />
            {form.matricula_vehiculo && <Hint ok={okPlate}>{okPlate ? 'Matrícula correcta' : 'Matrícula no válida'}</Hint>}
          </>
        );
      }

      case 'cargador':
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">{tipo === 'deca' ? '¿Para quién es el porte?' : '¿Quién contrata el viaje?'}</h2>
            <p className="mt-1 text-base text-gray-500">{tipo === 'deca' ? 'Cargador contractual: quien le contrata el transporte.' : 'Persona, empresa o entidad que contrata el servicio.'}</p>
            {clients.length > 0 && (
              <div className="mt-4">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className={`${inputCls} pl-11 text-base`} placeholder="Buscar en mis clientes…"
                    value={clientQuery} onChange={e => setClientQuery(e.target.value)} />
                </div>
                {(clientQuery || !form.cargador_nombre) && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {clientesFiltrados.map(c => (
                      <button key={c.id} type="button" onClick={() => pickClient(c)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-sm hover:border-amber-400 ${form.client_id === c.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                        <span className="font-semibold text-gray-900">{[c.nombre, c.apellidos].filter(Boolean).join(' ')}</span>
                        {c.nif && <span className="ml-2 font-mono text-xs text-gray-500">{c.nif}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>Nombre o razón social</label>
                <input className={inputCls} value={form.cargador_nombre} placeholder="Ej.: Distribuciones Norte S.L."
                  onChange={e => setForm(f => ({ ...f, cargador_nombre: e.target.value, client_id: null }))} />
              </div>
              <div>
                <label className={labelCls}>NIF / CIF</label>
                <input className={`${inputCls} font-mono uppercase`} value={form.cargador_nif} placeholder="B12345678" autoCapitalize="characters"
                  onChange={e => set('cargador_nif', e.target.value.toUpperCase())} />
                {form.cargador_nif && <Hint ok={isValidNif(form.cargador_nif)}>{isValidNif(form.cargador_nif) ? 'NIF correcto' : 'NIF no válido'}</Hint>}
              </div>
              {tipo === 'deca' && (
                <div>
                  <label className={labelCls}>Domicilio</label>
                  <input className={inputCls} value={form.cargador_domicilio} placeholder="Calle, número, CP y localidad"
                    onChange={e => set('cargador_domicilio', e.target.value)} />
                </div>
              )}
            </div>
          </>
        );

      case 'ruta':
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">¿De dónde a dónde?</h2>
            <button type="button" onClick={locate} disabled={locating}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-400 bg-emerald-50 py-4 text-lg font-bold text-emerald-800 disabled:opacity-60">
              {locating ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
              {tipo === 'deca' ? 'Cargo aquí donde estoy' : 'Salgo de aquí donde estoy'}
            </button>
            {locatedMsg && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800">✓ {locatedMsg}</p>}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>{tipo === 'deca' ? 'Lugar de carga' : 'Origen'}</label>
                <input className={inputCls} value={form.origen} placeholder="Calle o pueblo" onChange={e => set('origen', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{tipo === 'deca' ? 'Lugar de descarga' : 'Destino'}</label>
                <input className={inputCls} value={form.destino} placeholder="Calle o pueblo" onChange={e => set('destino', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Paradas {tipo === 'deca' ? '(opcional)' : 'intermedias (si las hay)'}</label>
                {form.paradas.map((p, i) => (
                  <div key={i} className="mb-2 flex items-center gap-2">
                    <input className={`${inputCls} text-base`} value={p.nombre} placeholder="Lugar de la parada"
                      onChange={e => set('paradas', form.paradas.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} />
                    {tipo === 'hoja_ruta' && (
                      <input type="time" className="w-28 rounded-2xl border-2 border-gray-200 px-2 py-3.5 text-base" value={p.hora}
                        onChange={e => set('paradas', form.paradas.map((x, j) => j === i ? { ...x, hora: e.target.value } : x))} />
                    )}
                    <button type="button" aria-label="Quitar parada" className="p-2 text-gray-500"
                      onClick={() => set('paradas', form.paradas.filter((_, j) => j !== i))}><X size={22} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => set('paradas', [...form.paradas, { nombre: '', hora: '' }])}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 py-3 font-semibold text-amber-800">
                  <Plus size={18} /> Añadir parada
                </button>
              </div>
            </div>
          </>
        );

      case 'mercancia': {
        const add = (kg: number) => set('peso_kg', Math.round((form.peso_kg + kg) * 100) / 100);
        const esOtro = form.naturaleza_mercancia && !MERCANCIAS_FRECUENTES.includes(form.naturaleza_mercancia);
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">¿Qué lleva y cuánto pesa?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {MERCANCIAS_FRECUENTES.map(m => (
                <Chip key={m} active={form.naturaleza_mercancia === m} onClick={() => set('naturaleza_mercancia', m)}>{m}</Chip>
              ))}
            </div>
            <input className={`${inputCls} mt-2 text-base ${esOtro ? 'border-emerald-400' : ''}`} placeholder="Otra mercancía (escríbala)"
              value={esOtro ? form.naturaleza_mercancia : ''} onChange={e => set('naturaleza_mercancia', e.target.value)} />

            {!form.sin_peso ? (
              <>
                <p className={`${labelCls} mt-6`}>Peso · toque para sumar</p>
                <div className="flex items-center justify-center rounded-2xl border-2 border-amber-400 bg-white py-4">
                  <input inputMode="decimal" aria-label="Peso en kg"
                    className="w-40 bg-transparent text-right font-mono text-4xl font-bold text-gray-900 focus:outline-none"
                    value={form.peso_kg ? String(form.peso_kg) : ''} placeholder="0"
                    onChange={e => { const n = Number(e.target.value.replace(',', '.')); if (Number.isFinite(n) && n >= 0) set('peso_kg', n); }} />
                  <span className="ml-2 text-xl text-gray-500">kg</span>
                </div>
                {form.peso_kg > 0 && <p className="mt-1 text-center text-sm text-gray-500">{fmtPesoKg(form.peso_kg)}</p>}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[[100, '+100 kg'], [500, '+500 kg'], [1000, '+1 t'], [5000, '+5 t'], [10000, '+10 t'], [20000, '+20 t']].map(([kg, l]) => (
                    <button key={l} type="button" onClick={() => add(kg as number)}
                      className="rounded-2xl border-2 border-amber-400 bg-white py-3.5 text-lg font-semibold text-amber-900 active:bg-amber-50">{l}</button>
                  ))}
                </div>
                <button type="button" onClick={() => set('peso_kg', 0)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 py-3 text-gray-600"><Delete size={18} /> Poner a cero</button>
                <button type="button" onClick={() => set('sin_peso', true)} className="mt-3 w-full text-sm text-gray-500 underline">
                  El peso exacto es difícil de saber
                </button>
              </>
            ) : (
              <div className="mt-6">
                <label className={labelCls}>Cantidad (otra medida)</label>
                <input className={inputCls} value={form.otra_magnitud} placeholder="Ej.: 24 palés, 30 m³, 12.000 litros"
                  onChange={e => set('otra_magnitud', e.target.value)} />
                <button type="button" onClick={() => set('sin_peso', false)} className="mt-3 w-full text-sm text-gray-500 underline">Indicar el peso en kg</button>
              </div>
            )}
          </>
        );
      }

      case 'fecha':
      case 'fechas_viaje': {
        const hoy = madridToday(), manana = madridToday(1);
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">{step === 'fecha' ? '¿Qué día es el porte?' : '¿Cuándo empieza y termina el viaje?'}</h2>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Chip active={form.fecha_servicio === hoy} onClick={() => set('fecha_servicio', hoy)}><span className="block text-center font-semibold">Hoy</span></Chip>
              <Chip active={form.fecha_servicio === manana} onClick={() => set('fecha_servicio', manana)}><span className="block text-center font-semibold">Mañana</span></Chip>
              <label className={`flex cursor-pointer items-center justify-center rounded-2xl border-2 px-2 text-center font-semibold ${form.fecha_servicio > manana ? 'border-emerald-400 bg-emerald-50' : 'border-amber-200 bg-white'}`}>
                <span className="text-base">Otro día</span>
                <input type="date" min={hoy} className="sr-only" value={form.fecha_servicio}
                  onChange={e => e.target.value && set('fecha_servicio', e.target.value)} />
              </label>
            </div>
            <input type="date" min={hoy} className={`${inputCls} mt-2 text-center font-bold`} value={form.fecha_servicio}
              onChange={e => e.target.value && set('fecha_servicio', e.target.value)} />

            <p className="mt-6 text-lg font-semibold text-gray-900">¿A qué hora sale?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Chip active={false} onClick={() => { set('fecha_servicio', hoy); set('hora_salida', madridNowHHMM()); }}>
                <span className="flex items-center justify-center gap-2 font-semibold"><Clock size={18} /> Ahora</span>
              </Chip>
              <input type="time" className={`${inputCls} text-center font-bold ${form.hora_salida ? '!border-emerald-400 bg-emerald-50' : ''}`} value={form.hora_salida}
                onChange={e => set('hora_salida', e.target.value)} aria-label="Hora de salida" />
            </div>

            {step === 'fechas_viaje' && (
              <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                <p className="text-base font-semibold text-gray-900">Regreso / fin <span className="font-normal text-gray-500">(opcional)</span></p>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <input type="date" min={form.fecha_servicio} className={`${inputCls} text-base`} value={form.fin_fecha}
                    onChange={e => set('fin_fecha', e.target.value)} aria-label="Día de regreso" />
                  <input type="time" className="w-32 rounded-2xl border-2 border-gray-200 px-2 text-base" value={form.fin_hora}
                    onChange={e => set('fin_hora', e.target.value)} aria-label="Hora de regreso" />
                </div>
                {form.fin_fecha && <button type="button" className="mt-2 text-sm text-gray-500 underline" onClick={() => setForm(f => ({ ...f, fin_fecha: '', fin_hora: '' }))}>Quitar regreso</button>}
              </div>
            )}
          </>
        );
      }

      case 'remolque':
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">¿Lleva remolque o semirremolque?</h2>
            <button type="button" onClick={() => setForm(f => ({ ...f, sin_remolque: true, matricula_remolque: '' }))}
              className={`mt-5 w-full rounded-2xl border-2 py-4 text-lg font-bold ${form.sin_remolque ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-white text-gray-800'}`}>
              No llevo remolque
            </button>
            <p className="mt-5 text-base text-gray-500">Si lleva, escriba su matrícula:</p>
            <input className={`${inputCls} mt-2 text-center font-mono text-2xl tracking-widest uppercase`} placeholder="R1234 BCD"
              value={form.matricula_remolque} autoCapitalize="characters"
              onChange={e => setForm(f => ({ ...f, matricula_remolque: e.target.value.toUpperCase(), sin_remolque: !e.target.value }))} />
            <details className="mt-6 rounded-2xl bg-gray-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">¿Necesita autorización especial de circulación? (transportes especiales)</summary>
              <input className={`${inputCls} mt-3 text-base`} value={form.autorizacion_especial} placeholder="Nº de autorización"
                onChange={e => set('autorizacion_especial', e.target.value)} />
            </details>
          </>
        );

      case 'conductor': {
        const okNif = !!form.conductor_nif && isValidNif(form.conductor_nif);
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">¿Quién conduce?</h2>
            {conductores.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {conductores.map(c => (
                  <Chip key={c.id} active={form.conductor_id === c.id}
                    onClick={() => setForm(f => ({ ...f, conductor_id: c.id, conductor_nombre: c.nombre, conductor_nif: c.nif ?? '' }))}>
                    {c.nombre}{c.nif && <span className="block font-mono text-xs text-gray-500">{c.nif}</span>}
                  </Chip>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelCls}>Nombre y apellidos</label>
                <input className={inputCls} value={form.conductor_nombre}
                  onChange={e => setForm(f => ({ ...f, conductor_nombre: e.target.value, conductor_id: null }))} />
              </div>
              <div>
                <label className={labelCls}>NIF / NIE</label>
                <input className={`${inputCls} font-mono uppercase`} value={form.conductor_nif} placeholder="12345678Z" autoCapitalize="characters"
                  onChange={e => set('conductor_nif', e.target.value.toUpperCase())} />
                {form.conductor_nif && <Hint ok={okNif}>{okNif ? 'NIF correcto' : 'NIF no válido'}</Hint>}
                {form.conductor_id && okNif && !conductores.find(c => c.id === form.conductor_id)?.nif && (
                  <p className="mt-1 text-xs text-gray-500">Se guardará en la ficha del conductor para la próxima vez.</p>
                )}
              </div>
            </div>
          </>
        );
      }

      case 'naturaleza':
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">¿Qué servicio es?</h2>
            <p className="mt-1 text-sm text-gray-500">Los 4 servicios que reconoce la Orden FOM/1230/2013</p>
            <div className="mt-4 flex flex-col gap-2">
              {NATURALEZA_SERVICIO_OPCIONES.map(o => (
                <Chip key={o.value} active={form.naturaleza_servicio === o.value} onClick={() => set('naturaleza_servicio', o.value)}>
                  <span className="block text-lg font-semibold">{o.label}</span>
                  <span className="block text-sm text-gray-500">{o.hint}</span>
                </Chip>
              ))}
            </div>
            {(form.naturaleza_servicio === 'refuerzo_regular' || form.naturaleza_servicio === 'colaboracion_regular_especial') && (
              <div className="mt-4">
                <label className={labelCls}>{form.naturaleza_servicio === 'refuerzo_regular' ? 'Línea regular que se refuerza' : 'Transporte regular especial con el que colabora'}</label>
                <input className={inputCls} value={form.servicio_referencia} placeholder="Ej.: VAC-123 Santander - Burgos / Colegio X ruta 2"
                  onChange={e => set('servicio_referencia', e.target.value)} />
              </div>
            )}
          </>
        );

      case 'observaciones':
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-900">¿Quiere añadir observaciones?</h2>
            <p className="mt-1 text-base text-gray-500">Opcional. {tipo === 'deca' ? 'Por ejemplo: persona de contacto, muelle, reservas.' : 'Por ejemplo: nº de viajeros, persona de contacto, punto de recogida.'}</p>
            <textarea className={`${inputCls} mt-4 min-h-[140px] text-base`} value={form.observaciones} maxLength={1000}
              onChange={e => set('observaciones', e.target.value)} />
            {tipo === 'deca' && conductores.length > 0 && (
              <div className="mt-4">
                <label className={labelCls}>Conductor (opcional)</label>
                <select className={`${inputCls} text-base`} value={form.conductor_id ?? ''}
                  onChange={e => { const c = conductores.find(x => x.id === e.target.value); setForm(f => ({ ...f, conductor_id: c?.id ?? null, conductor_nombre: c?.nombre ?? '', conductor_nif: c?.nif ?? '' })); }}>
                  <option value="">Sin indicar</option>
                  {conductores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
          </>
        );

      case 'resumen':
        return <Resumen tipo={tipo} form={form} sustituye={sustituye} setMotivo={v => set('motivo', v)} />;
    }
  };

  const isLast = step === 'resumen';
  const nextLabel = step === 'observaciones'
    ? (tipo === 'deca' ? 'Ver mi DeCA' : 'Ver mi hoja de ruta')
    : 'Siguiente';

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex h-full w-full flex-col bg-slate-50 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-3xl sm:shadow-2xl">
        {/* Cabecera */}
        <div className="shrink-0 px-5 pt-4 sm:px-7">
          <div className="flex items-center justify-between">
            <button type="button" onClick={goBack} className="flex items-center gap-1.5 py-2 text-base font-medium text-slate-600">
              <ArrowLeft size={20} /> Atrás
            </button>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Paso {stepIdx + 1} de {steps.length}</span>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-slate-500"><X size={22} /></button>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-amber-700">{sustituye ? `Modificar ${sustituye.numero}` : titulo}</p>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3 sm:px-7">
          {orgNifOk === false && (
            <div className="mb-4 flex gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={18} className="shrink-0" />
              <span>Falta el <b>NIF de su empresa</b> (Ajustes → Empresa). Es obligatorio como transportista y sin él no se puede emitir.</span>
            </div>
          )}
          {renderStep()}
          {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        </div>

        {/* Pie */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:rounded-b-3xl sm:px-7" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {isLast ? (
            <button type="button" onClick={emitir} disabled={emitting || orgNifOk === false}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-bold tracking-wide text-white shadow disabled:opacity-50">
              {emitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              {sustituye ? 'Emitir documento modificado' : (tipo === 'deca' ? 'Emitir DeCA' : 'Emitir hoja de ruta')}
            </button>
          ) : (
            <button type="button" onClick={goNext}
              className={`w-full rounded-2xl border-2 py-4 text-lg font-bold uppercase tracking-[0.15em] transition-colors ${
                currentError ? 'border-amber-200 text-amber-800/50' : 'border-amber-500 bg-white text-gray-900'
              }`}>
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vista previa antes de emitir ──────────────────────────────────────────────

function Resumen({ tipo, form, sustituye, setMotivo }: { tipo: TransportDocTipo; form: Form; sustituye?: TransportControlDoc; setMotivo: (v: string) => void }) {
  const paradas = form.paradas.filter(p => p.nombre.trim()).map(p => p.hora ? `${p.nombre} (${p.hora})` : p.nombre).join(' → ');
  const rows: [string, string][] = tipo === 'deca' ? [
    ['Cargador contractual', `${form.cargador_nombre}\nNIF ${normalizeNif(form.cargador_nif)}\n${form.cargador_domicilio}`],
    ['Transportista efectivo', 'Su empresa (datos de Ajustes)'],
    ['Lugar de carga', form.origen],
    ['Lugar de descarga', form.destino],
    ['Mercancía', form.naturaleza_mercancia],
    ['Peso', form.sin_peso ? form.otra_magnitud : fmtPesoKg(form.peso_kg)],
    ['Matrícula', normalizePlate(form.matricula_vehiculo)],
    ['Remolque', form.sin_remolque ? '—' : normalizePlate(form.matricula_remolque)],
    ['Fecha', `${fmtFechaEs(form.fecha_servicio)} · Salida ${form.hora_salida}`],
    ['Observaciones', [form.observaciones, paradas ? `Paradas: ${paradas}` : ''].filter(Boolean).join('\n') || '—'],
  ] : [
    ['Empresa transportista', 'Su empresa (datos de Ajustes)'],
    ['Contratante', `${form.cargador_nombre}\nNIF ${normalizeNif(form.cargador_nif)}`],
    ['Origen', form.origen],
    ['Destino', form.destino],
    ['Paradas', paradas || 'Sin paradas'],
    ['Fecha', `${fmtFechaEs(form.fecha_servicio)} · Salida ${form.hora_salida}${form.fin_fecha ? `\nRegreso ${fmtFechaEs(form.fin_fecha)} ${form.fin_hora}` : ''}`],
    ['Autobús', normalizePlate(form.matricula_vehiculo)],
    ['Conductor', `${form.conductor_nombre}\nNIF ${normalizeNif(form.conductor_nif)}`],
    ['Servicio', `${form.naturaleza_servicio ? NATURALEZA_SERVICIO_LABEL[form.naturaleza_servicio] : ''}${form.servicio_referencia ? `\n${form.servicio_referencia}` : ''}`],
    ['Observaciones', form.observaciones || '—'],
  ];
  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900">Revise antes de emitir</h2>
      <p className="mt-1 text-sm text-gray-500">Una vez emitido no se puede editar: si algo cambia, se emite uno nuevo que lo sustituye.</p>
      <div className="mt-4 overflow-hidden rounded-2xl border-2 border-slate-800 bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="border-b border-slate-200 last:border-0">
            <p className="bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
            <p className="whitespace-pre-line px-3 py-2 text-base font-semibold text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      {sustituye && (
        <div className="mt-4">
          <label className={labelCls}>Motivo de la modificación</label>
          <input className={inputCls} value={form.motivo} placeholder="Ej.: cambio de vehículo por avería" onChange={e => setMotivo(e.target.value)} />
          <p className="mt-1 text-xs text-gray-500">El documento {sustituye.numero} quedará como «sustituido» y se conservará.</p>
        </div>
      )}
    </>
  );
}
