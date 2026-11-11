/**
 * Expediciones (cargas) de mercancías: alta, asignación a viaje, recogida,
 * entrega con nombre del receptor, incidencias y emisión del DeCA.
 * Pensada para móvil (conductor) y válida en PC (tráfico).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package, Plus, X, Loader2, Search, MapPin, ArrowRight, Truck, CheckCircle2,
  AlertTriangle, Ban, Pencil, FileCheck, Phone, Weight, Boxes, Calendar, QrCode,
} from 'lucide-react';
import {
  loadReceivedDocs, extractReceivedData, shipmentPrefillFromExtracted, linkReceivedToShipment, RECEIVED_TIPO_LABEL,
  type ReceivedDocInput, type ReceivedDoc,
} from '../../lib/transportReceivedDocs';
import { ReceivedDocWizard } from '../transport-docs/ReceivedDocs';
import { Sparkles, ScanLine } from 'lucide-react';
import {
  loadShipments, createShipment, updateShipment, markPicked, markDelivered, markIncident,
  cancelShipment, assignTrip, emptyShipmentInput, validateShipment, shipmentEstadoMeta,
  tipoCargaLabel, canEditShipment, canPick, canDeliver, SHIPMENT_ESTADOS,
  type TradeTransportShipment, type ShipmentInput, type ShipmentEstado,
} from '../../lib/transportShipments';
import { loadTransportTrips, TIPO_CARGA_OPTIONS, type TradeTransportTrip } from '../../lib/transportTrips';
import { loadVehiclesAll, type TradeVehicle } from '../../lib/transport';
import { loadClients, loadWorkers, supabase, type TradeClient, type TradeWorker } from '../../lib/supabase';
import {
  madridToday, fmtFechaEs, fmtPesoKg, decaPrefillFromShipment, MERCANCIAS_FRECUENTES,
  type TransportDocInput,
} from '../../lib/transportDocs';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  /** Abre el asistente de DeCA con los datos de la expedición. */
  onEmitDeca: (prefill: Partial<TransportDocInput>) => void;
  /** Escanear el DeCA que entrega el cliente para esta carga. */
  onScanDeca?: (link: Partial<ReceivedDocInput>) => void;
  /** Abrir «Nueva expedición» rellenada a partir de un documento recibido. */
  initialFromReceived?: ReceivedDoc | null;
  onConsumeInitialFromReceived?: () => void;
}

type Filtro = 'activas' | ShipmentEstado | 'todas';

const inputCls = 'w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-300 focus:border-amber-400 focus:outline-none';
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1';

export default function ScreenTransporteExpediciones({ orgId, showToast, onEmitDeca, onScanDeca, initialFromReceived, onConsumeInitialFromReceived }: Props) {
  const [items, setItems] = useState<TradeTransportShipment[]>([]);
  const [trips, setTrips] = useState<TradeTransportTrip[]>([]);
  const [vehicles, setVehicles] = useState<TradeVehicle[]>([]);
  const [workers, setWorkers] = useState<TradeWorker[]>([]);
  const [clients, setClients] = useState<TradeClient[]>([]);
  const [decaBy, setDecaBy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ edit?: TradeTransportShipment; fromReceived?: ReceivedDoc } | null>(null);
  useEffect(() => {
    if (initialFromReceived) { setForm({ fromReceived: initialFromReceived }); onConsumeInitialFromReceived?.(); }
  }, [initialFromReceived, onConsumeInitialFromReceived]);
  const [selected, setSelected] = useState<TradeTransportShipment | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sh, tr, ve, wo, cl, docs] = await Promise.all([
        loadShipments(orgId),
        loadTransportTrips(orgId).catch(() => [] as TradeTransportTrip[]),
        loadVehiclesAll(orgId).catch(() => [] as TradeVehicle[]),
        loadWorkers(orgId).catch(() => [] as TradeWorker[]),
        loadClients(orgId).catch(() => [] as TradeClient[]),
        supabase.from('trade_transport_control_docs').select('numero, shipment_id').eq('org_id', orgId).eq('estado', 'vigente').not('shipment_id', 'is', null),
      ]);
      setItems(sh); setTrips(tr); setVehicles(ve); setWorkers(wo); setClients(cl);
      const map: Record<string, string> = {};
      for (const d of (docs.data ?? []) as { numero: string; shipment_id: string }[]) map[d.shipment_id] = d.numero;
      setDecaBy(map);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudieron cargar las expediciones', 'error');
    } finally { setLoading(false); }
  }, [orgId, showToast]);

  useEffect(() => { reload(); }, [reload]);

  const tripById = useMemo(() => Object.fromEntries(trips.map(t => [t.id, t])), [trips]);
  const visibles = useMemo(() => {
    const text = q.trim().toLowerCase();
    return items.filter(s => {
      if (filtro === 'activas' && !['pendiente', 'recogida', 'incidencia'].includes(s.estado)) return false;
      if (filtro !== 'activas' && filtro !== 'todas' && s.estado !== filtro) return false;
      if (!text) return true;
      return `${s.referencia} ${s.cargador_nombre} ${s.destinatario_nombre ?? ''} ${s.origen} ${s.destino} ${s.referencia_cargador ?? ''}`.toLowerCase().includes(text);
    });
  }, [items, filtro, q]);

  const counts = useMemo(() => ({
    pendiente: items.filter(s => s.estado === 'pendiente').length,
    recogida: items.filter(s => s.estado === 'recogida').length,
    incidencia: items.filter(s => s.estado === 'incidencia').length,
  }), [items]);

  const replace = (s: TradeTransportShipment) => { setItems(prev => prev.map(x => x.id === s.id ? s : x)); setSelected(s); };

  const emitDeca = (s: TradeTransportShipment) => {
    const trip = s.trip_id ? tripById[s.trip_id] : null;
    const vehicle = trip?.vehicle_id ? vehicles.find(v => v.id === trip.vehicle_id) : null;
    const conductor = trip?.conductor_id ? workers.find(w => w.id === trip.conductor_id) : null;
    onEmitDeca(decaPrefillFromShipment(s, trip, vehicle, conductor));
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Package className="text-amber-600" size={22} /> Expediciones</h1>
          <p className="mt-0.5 text-sm text-gray-500">Cada carga de un cliente: recogida, entrega y su DeCA.</p>
        </div>
        <button type="button" onClick={() => setForm({})}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-white shadow-sm active:scale-95">
          <Plus size={18} /> Nueva expedición
        </button>
      </div>

      {/* Resumen */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {([['pendiente', 'Por recoger'], ['recogida', 'En tránsito'], ['incidencia', 'Incidencias']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)}
            className={`rounded-2xl border bg-white p-3 text-left ${filtro === k ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'}`}>
            <span className="block text-2xl font-black text-gray-900">{counts[k]}</span>
            <span className="block text-xs font-semibold text-gray-500">{l}</span>
          </button>
        ))}
      </div>

      {/* Filtros y búsqueda */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {([['activas', 'Activas'], ...SHIPMENT_ESTADOS.map(e => [e.value, e.label]), ['todas', 'Todas']] as [Filtro, string][]).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFiltro(v)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${filtro === v ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>{l}</button>
        ))}
      </div>
      <div className="relative mt-2">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className={`${inputCls} pl-10`} placeholder="Buscar por cliente, destino, referencia…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {/* Lista */}
      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <Package className="mx-auto text-gray-300" size={36} />
            <p className="mt-2 font-semibold text-gray-700">{items.length ? 'No hay expediciones con este filtro' : 'Aún no hay expediciones'}</p>
            <p className="text-sm text-gray-500">Cree una por cada carga que le encarguen.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibles.map(s => {
              const meta = shipmentEstadoMeta(s.estado);
              const trip = s.trip_id ? tripById[s.trip_id] : null;
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setSelected(s)} className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-500">{s.referencia}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.color}`}>{meta.label}</span>
                      {decaBy[s.id] && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">DeCA</span>}
                      <span className="ml-auto text-xs text-gray-500">{fmtFechaEs(s.fecha_recogida)}</span>
                    </div>
                    <p className="mt-1 font-bold text-gray-900">{s.cargador_nombre}</p>
                    <p className="flex items-center gap-1 truncate text-sm text-gray-700">{s.origen} <ArrowRight size={14} className="shrink-0 text-gray-400" /> {s.destino}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {s.naturaleza}{s.peso_kg ? ` · ${fmtPesoKg(Number(s.peso_kg))}` : ''}{s.num_bultos ? ` · ${s.num_bultos} bultos` : ''}
                      {trip ? ` · Viaje: ${trip.referencia || trip.titulo}` : ' · Sin viaje'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {form && (
        <ShipmentForm
          orgId={orgId} edit={form.edit} fromReceived={form.fromReceived} trips={trips} clients={clients} showToast={showToast}
          onClose={() => setForm(null)}
          onSaved={s => { setForm(null); setItems(prev => form.edit ? prev.map(x => x.id === s.id ? s : x) : [s, ...prev]); setSelected(s); }}
        />
      )}

      {selected && !form && (
        <ShipmentDetail
          s={selected} orgId={orgId} trips={trips} vehicles={vehicles} workers={workers}
          decaNumero={decaBy[selected.id]} showToast={showToast}
          onClose={() => setSelected(null)}
          onChanged={replace}
          onEdit={() => setForm({ edit: selected })}
          onEmitDeca={() => emitDeca(selected)}
          onScanDeca={onScanDeca ? () => {
            const t = selected.trip_id ? tripById[selected.trip_id] : null;
            const v = t?.vehicle_id ? vehicles.find(x => x.id === t.vehicle_id) : null;
            onScanDeca({
              shipment_id: selected.id, trip_id: selected.trip_id, emisor_nombre: selected.cargador_nombre,
              fecha_servicio: selected.fecha_recogida, origen: selected.origen, destino: selected.destino,
              matricula: v?.matricula ?? null,
            });
          } : undefined}
        />
      )}
    </div>
  );
}

// ── Formulario ────────────────────────────────────────────────────────────────

function ShipmentForm({ orgId, edit, fromReceived, trips, clients, showToast, onClose, onSaved }: {
  orgId: string; edit?: TradeTransportShipment; fromReceived?: ReceivedDoc; trips: TradeTransportTrip[]; clients: TradeClient[];
  showToast: Props['showToast']; onClose: () => void; onSaved: (s: TradeTransportShipment) => void;
}) {
  const [f, setF] = useState<ShipmentInput>(() => {
    const base = emptyShipmentInput(madridToday());
    if (!edit) return base;
    // Solo los campos editables (no id, estado, fechas de seguimiento…)
    return Object.fromEntries(Object.keys(base).map(k => [k, edit[k as keyof TradeTransportShipment]])) as unknown as ShipmentInput;
  });
  const [clientQ, setClientQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof ShipmentInput>(k: K, v: ShipmentInput[K]) => setF(p => ({ ...p, [k]: v }));

  // ── Rellenar desde el DeCA del cliente (lectura con IA, siempre revisable) ──
  const [importar, setImportar] = useState<null | 'menu' | 'scan'>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<{ confianza: string; dudosos: string[]; fuente: string } | null>(null);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const [guardados, setGuardados] = useState<ReceivedDoc[]>([]);

  const applyFromDoc = async (doc: ReceivedDoc) => {
    setImportar(null); setLeyendo(true); setErr(null);
    try {
      const datos = doc.datos_extraidos ?? await extractReceivedData(orgId, doc.id);
      const p = shipmentPrefillFromExtracted(datos, clients);
      setF(prev => {
        const next = { ...prev } as Record<string, unknown>;
        for (const [k, v] of Object.entries(p)) if (v !== null && v !== '') next[k] = v;
        return next as unknown as ShipmentInput;
      });
      setReceivedId(doc.id);
      const ETIQ: Record<string, string> = {
        numero: 'nº de documento', fecha_transporte: 'fecha', hora_salida: 'hora', cargador_nombre: 'nombre del cargador',
        cargador_nif: 'NIF del cargador', cargador_domicilio: 'domicilio del cargador', origen: 'lugar de recogida',
        destino: 'lugar de entrega', naturaleza_mercancia: 'mercancía', peso_kg: 'peso', num_bultos: 'bultos',
        matricula_vehiculo: 'matrícula', observaciones: 'observaciones',
      };
      setAviso({ confianza: datos.confianza, dudosos: (datos.campos_dudosos ?? []).map(c => ETIQ[c] ?? c.replace(/_/g, ' ')), fuente: doc.emisor_nombre || doc.numero_documento || RECEIVED_TIPO_LABEL[doc.tipo] });
      showToast('Datos leídos del documento: revíselos antes de guardar', 'info');
    } catch (x) {
      setErr(x instanceof Error ? `No se pudo leer el documento: ${x.message}` : 'No se pudo leer el documento');
    } finally { setLeyendo(false); }
  };

  useEffect(() => { if (fromReceived) applyFromDoc(fromReceived); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirMenuImportar = async () => {
    setImportar('menu');
    try {
      const docs = await loadReceivedDocs(orgId);
      setGuardados(docs.filter(d => d.tipo === 'deca' && !d.shipment_id).slice(0, 6));
    } catch { setGuardados([]); }
  };

  const tripsAbiertos = trips.filter(t => t.estado !== 'cancelado' && t.estado !== 'completado');
  const clientes = clientQ.trim()
    ? clients.filter(c => `${c.nombre} ${c.apellidos ?? ''} ${c.nif ?? ''}`.toLowerCase().includes(clientQ.toLowerCase())).slice(0, 6)
    : [];

  const save = async () => {
    const e = validateShipment(f);
    if (e) { setErr(e); return; }
    setSaving(true); setErr(null);
    try {
      const s = edit ? await updateShipment(orgId, edit.id, f) : await createShipment(orgId, f);
      if (!edit && receivedId) await linkReceivedToShipment(orgId, receivedId, s.id).catch(() => undefined);
      showToast(edit ? 'Expedición actualizada' : `Expedición ${s.referencia} creada`, 'success');
      onSaved(s);
    } catch (x) { setErr(x instanceof Error ? x.message : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={edit ? `Editar ${edit.referencia}` : 'Nueva expedición'} onClose={onClose}
      footer={<button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-lg font-bold text-white disabled:opacity-50">
        {saving && <Loader2 className="animate-spin" size={18} />} Guardar
      </button>}>
      {!edit && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3">
          {leyendo ? (
            <p className="flex items-center gap-2 font-semibold text-emerald-900"><Loader2 className="animate-spin" size={18} /> Leyendo el documento… (unos segundos)</p>
          ) : aviso ? (
            <div className="text-sm text-emerald-900">
              <p className="flex items-center gap-1.5 font-bold"><Sparkles size={16} /> Rellenado desde: {aviso.fuente}</p>
              <p className="mt-0.5">Revise todos los datos antes de guardar.{aviso.confianza !== 'alta' ? ' El documento se leía con dificultad.' : ''}</p>
              {aviso.dudosos.length > 0 && <p className="mt-0.5 font-semibold text-amber-800">Compruebe sobre todo: {aviso.dudosos.join(', ')}</p>}
            </div>
          ) : importar === 'menu' ? (
            <div className="space-y-2">
              <button type="button" onClick={() => setImportar('scan')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white"><ScanLine size={18} /> Escanear el DeCA ahora</button>
              {guardados.length > 0 && <p className="pt-1 text-xs font-bold uppercase tracking-wider text-emerald-800">O elija uno ya guardado</p>}
              {guardados.map(d => (
                <button key={d.id} type="button" onClick={() => applyFromDoc(d)}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-sm">
                  <b>{d.emisor_nombre || 'DeCA recibido'}</b>
                  <span className="text-gray-500">{d.fecha_servicio ? ` · ${fmtFechaEs(d.fecha_servicio)}` : ''}{d.numero_documento ? ` · ${d.numero_documento}` : ''}</span>
                </button>
              ))}
              <button type="button" onClick={() => setImportar(null)} className="w-full text-sm text-emerald-800 underline">Rellenar a mano</button>
            </div>
          ) : (
            <button type="button" onClick={abrirMenuImportar} className="flex w-full items-center gap-3 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700"><Sparkles size={22} /></span>
              <span><span className="block font-bold text-emerald-900">Rellenar desde el DeCA del cliente</span>
                <span className="block text-sm text-emerald-800">Escanee el QR o haga una foto y se completa solo</span></span>
            </button>
          )}
        </div>
      )}

      <Section title="Cliente (cargador)">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${inputCls} pl-9`} placeholder="Buscar en mis clientes…" value={clientQ} onChange={e => setClientQ(e.target.value)} />
        </div>
        {clientes.map(c => (
          <button key={c.id} type="button" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-amber-400"
            onClick={() => {
              setF(p => ({ ...p, client_id: c.id, cargador_nombre: [c.nombre, c.apellidos].filter(Boolean).join(' '), cargador_nif: c.nif ?? null,
                cargador_domicilio: [c.direccion, [c.cp, c.ciudad].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null }));
              setClientQ('');
            }}>
            <b>{[c.nombre, c.apellidos].filter(Boolean).join(' ')}</b> {c.nif && <span className="font-mono text-xs text-gray-500">{c.nif}</span>}
          </button>
        ))}
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><label className={labelCls}>Nombre</label><input className={inputCls} value={f.cargador_nombre} onChange={e => setF(p => ({ ...p, cargador_nombre: e.target.value, client_id: null }))} /></div>
          <div><label className={labelCls}>NIF</label><input className={`${inputCls} font-mono uppercase`} value={f.cargador_nif ?? ''} onChange={e => set('cargador_nif', e.target.value.toUpperCase())} /></div>
        </div>
        <div className="mt-2"><label className={labelCls}>Domicilio</label><input className={inputCls} value={f.cargador_domicilio ?? ''} onChange={e => set('cargador_domicilio', e.target.value)} /></div>
      </Section>

      <Section title="Recogida y entrega">
        <div className="grid gap-2 sm:grid-cols-2">
          <div><label className={labelCls}>Recoger en</label><input className={inputCls} value={f.origen} placeholder="Calle o pueblo" onChange={e => set('origen', e.target.value)} /></div>
          <div><label className={labelCls}>Entregar en</label><input className={inputCls} value={f.destino} placeholder="Calle o pueblo" onChange={e => set('destino', e.target.value)} /></div>
          <div><label className={labelCls}>Fecha de recogida</label><input type="date" className={inputCls} value={f.fecha_recogida} onChange={e => set('fecha_recogida', e.target.value)} /></div>
          <div><label className={labelCls}>Hora (opcional)</label><input type="time" className={inputCls} value={f.hora_recogida?.slice(0, 5) ?? ''} onChange={e => set('hora_recogida', e.target.value || null)} /></div>
          <div><label className={labelCls}>Destinatario</label><input className={inputCls} value={f.destinatario_nombre ?? ''} onChange={e => set('destinatario_nombre', e.target.value)} /></div>
          <div><label className={labelCls}>Teléfono destinatario</label><input inputMode="tel" className={inputCls} value={f.destinatario_telefono ?? ''} onChange={e => set('destinatario_telefono', e.target.value)} /></div>
        </div>
      </Section>

      <Section title="Mercancía">
        <div className="flex flex-wrap gap-1.5">
          {MERCANCIAS_FRECUENTES.map(m => (
            <button key={m} type="button" onClick={() => set('naturaleza', m)}
              className={`rounded-full border px-3 py-1.5 text-sm ${f.naturaleza === m ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900' : 'border-gray-200 bg-white text-gray-700'}`}>{m}</button>
          ))}
        </div>
        <input className={`${inputCls} mt-2`} placeholder="Qué es (o escríbalo)" value={f.naturaleza} onChange={e => set('naturaleza', e.target.value)} />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1"><label className={labelCls}>Tipo de carga</label>
            <select className={inputCls} value={f.tipo_carga} onChange={e => set('tipo_carga', e.target.value as ShipmentInput['tipo_carga'])}>
              {TIPO_CARGA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></div>
          <div><label className={labelCls}>Peso (kg)</label><input inputMode="decimal" className={inputCls} value={f.peso_kg ?? ''} onChange={e => set('peso_kg', e.target.value ? Number(e.target.value.replace(',', '.')) : null)} /></div>
          <div><label className={labelCls}>Bultos</label><input inputMode="numeric" className={inputCls} value={f.num_bultos ?? ''} onChange={e => set('num_bultos', e.target.value ? parseInt(e.target.value, 10) : null)} /></div>
          <div><label className={labelCls}>m³</label><input inputMode="decimal" className={inputCls} value={f.volumen_m3 ?? ''} onChange={e => set('volumen_m3', e.target.value ? Number(e.target.value.replace(',', '.')) : null)} /></div>
        </div>
        <div className="mt-2"><label className={labelCls}>Albarán / pedido del cliente</label><input className={inputCls} value={f.referencia_cargador ?? ''} onChange={e => set('referencia_cargador', e.target.value)} /></div>
      </Section>

      <Section title="Viaje">
        <select className={inputCls} value={f.trip_id ?? ''} onChange={e => set('trip_id', e.target.value || null)}>
          <option value="">Sin asignar todavía</option>
          {tripsAbiertos.map(t => <option key={t.id} value={t.id}>{t.referencia ? `${t.referencia} · ` : ''}{t.titulo} ({fmtFechaEs(t.fecha_inicio)})</option>)}
        </select>
        <textarea className={`${inputCls} mt-2 min-h-[70px]`} placeholder="Observaciones" value={f.observaciones ?? ''} onChange={e => set('observaciones', e.target.value)} />
      </Section>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      {importar === 'scan' && (
        <ReceivedDocWizard orgId={orgId} allowDeca allowHojaRuta={false} defaultTipo="deca" showToast={showToast}
          onClose={() => setImportar('menu')} onSaved={d => applyFromDoc(d)} />
      )}
    </Modal>
  );
}

// ── Ficha ─────────────────────────────────────────────────────────────────────

function ShipmentDetail({ s, orgId, trips, vehicles, workers, decaNumero, showToast, onClose, onChanged, onEdit, onEmitDeca, onScanDeca }: {
  s: TradeTransportShipment; orgId: string; trips: TradeTransportTrip[]; vehicles: TradeVehicle[]; workers: TradeWorker[];
  decaNumero?: string; showToast: Props['showToast'];
  onClose: () => void; onChanged: (s: TradeTransportShipment) => void; onEdit: () => void; onEmitDeca: () => void;
  onScanDeca?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<null | 'entrega' | 'incidencia'>(null);
  const [texto, setTexto] = useState('');
  const meta = shipmentEstadoMeta(s.estado);
  const trip = s.trip_id ? trips.find(t => t.id === s.trip_id) : null;
  const vehiculo = trip?.vehicle_id ? vehicles.find(v => v.id === trip.vehicle_id) : null;
  const conductor = trip?.conductor_id ? workers.find(w => w.id === trip.conductor_id) : null;
  const abierta = s.estado !== 'entregada' && s.estado !== 'cancelada';

  const run = async (fn: () => Promise<TradeTransportShipment>, ok: string) => {
    setBusy(true);
    try { onChanged(await fn()); showToast(ok, 'success'); setPrompt(null); setTexto(''); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo actualizar', 'error'); }
    finally { setBusy(false); }
  };

  const fmtTs = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Modal title={s.referencia ?? 'Expedición'} onClose={onClose}
      footer={abierta ? (
        <div className="space-y-2">
          {prompt ? (
            <div className="space-y-2">
              <input autoFocus className={inputCls} value={texto} onChange={e => setTexto(e.target.value)}
                placeholder={prompt === 'entrega' ? 'Nombre de quien recibe' : 'Qué ha pasado'} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setPrompt(null); setTexto(''); }} className="rounded-xl border border-gray-200 py-3 font-semibold text-gray-700">Volver</button>
                <button type="button" disabled={busy || (prompt === 'incidencia' && !texto.trim())}
                  onClick={() => run(() => prompt === 'entrega' ? markDelivered(orgId, s.id, texto.trim()) : markIncident(orgId, s.id, texto.trim()),
                    prompt === 'entrega' ? 'Entrega registrada' : 'Incidencia registrada')}
                  className={`rounded-xl py-3 font-bold text-white disabled:opacity-50 ${prompt === 'entrega' ? 'bg-emerald-600' : 'bg-amber-500'}`}>Confirmar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {canPick(s) && (
                  <button type="button" disabled={busy} onClick={() => run(() => markPicked(orgId, s.id), 'Recogida registrada')}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50"><Truck size={18} /> Recogida</button>
                )}
                {canDeliver(s) && (
                  <button type="button" disabled={busy} onClick={() => setPrompt('entrega')}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"><CheckCircle2 size={18} /> Entregada</button>
                )}
              </div>
              <button type="button" onClick={onEmitDeca}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-400 py-3 font-bold text-amber-900">
                <FileCheck size={18} /> {decaNumero ? `Emitir otro DeCA (actual ${decaNumero})` : 'Emitir DeCA de esta carga'}
              </button>
              {onScanDeca && (
                <button type="button" onClick={onScanDeca}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 py-3 font-bold text-emerald-800">
                  <QrCode size={18} /> El cliente me da su DeCA: escanear
                </button>
              )}
              <div className="grid grid-cols-3 gap-2 text-sm">
                {canEditShipment(s) && <button type="button" onClick={onEdit} className="flex items-center justify-center gap-1 rounded-xl py-2 font-semibold text-gray-700 hover:bg-gray-50"><Pencil size={15} /> Editar</button>}
                <button type="button" onClick={() => setPrompt('incidencia')} className="flex items-center justify-center gap-1 rounded-xl py-2 font-semibold text-amber-800 hover:bg-amber-50"><AlertTriangle size={15} /> Incidencia</button>
                <button type="button" disabled={busy} onClick={() => { if (confirm('¿Cancelar esta expedición?')) run(() => cancelShipment(orgId, s.id), 'Expedición cancelada'); }}
                  className="flex items-center justify-center gap-1 rounded-xl py-2 font-semibold text-red-700 hover:bg-red-50"><Ban size={15} /> Cancelar</button>
              </div>
            </>
          )}
        </div>
      ) : null}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${meta.color}`}>{meta.label}</span>
        {decaNumero && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">DeCA {decaNumero}</span>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Cargador</p>
        <p className="font-bold text-gray-900">{s.cargador_nombre}</p>
        {s.cargador_nif && <p className="font-mono text-sm text-gray-600">{s.cargador_nif}</p>}
        {s.cargador_domicilio && <p className="text-sm text-gray-600">{s.cargador_domicilio}</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 text-sm">
        <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-blue-600" /><span><b>Recogida:</b> {s.origen}</span></p>
        <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-emerald-600" /><span><b>Entrega:</b> {s.destino}</span></p>
        <p className="flex gap-2"><Calendar size={16} className="mt-0.5 shrink-0 text-gray-500" /><span>{fmtFechaEs(s.fecha_recogida)}{s.hora_recogida ? ` · ${s.hora_recogida.slice(0, 5)}` : ''}</span></p>
        {s.destinatario_nombre && <p className="flex gap-2"><span className="w-4" /><span><b>Destinatario:</b> {s.destinatario_nombre}</span></p>}
        {s.destinatario_telefono && (
          <a href={`tel:${s.destinatario_telefono}`} className="flex gap-2 font-semibold text-blue-700"><Phone size={16} className="mt-0.5" />{s.destinatario_telefono}</a>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <p className="font-bold text-gray-900">{s.naturaleza} <span className="font-normal text-gray-500">· {tipoCargaLabel(s.tipo_carga)}</span></p>
        <p className="mt-1 flex flex-wrap gap-3 text-gray-700">
          {s.peso_kg != null && <span className="flex items-center gap-1"><Weight size={15} />{fmtPesoKg(Number(s.peso_kg))}</span>}
          {s.num_bultos != null && <span className="flex items-center gap-1"><Boxes size={15} />{s.num_bultos} bultos</span>}
          {s.volumen_m3 != null && <span>{s.volumen_m3} m³</span>}
        </p>
        {s.referencia_cargador && <p className="mt-1 text-gray-600">Albarán: {s.referencia_cargador}</p>}
        {s.observaciones && <p className="mt-1 text-gray-600">{s.observaciones}</p>}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Viaje</p>
        {abierta ? (
          <select className={`${inputCls} mt-1`} value={s.trip_id ?? ''} disabled={busy}
            onChange={e => run(() => assignTrip(orgId, s.id, e.target.value || null), e.target.value ? 'Asignada al viaje' : 'Quitada del viaje')}>
            <option value="">Sin asignar</option>
            {trips.filter(t => t.estado !== 'cancelado' && (t.estado !== 'completado' || t.id === s.trip_id)).map(t => (
              <option key={t.id} value={t.id}>{t.referencia ? `${t.referencia} · ` : ''}{t.titulo} ({fmtFechaEs(t.fecha_inicio)})</option>
            ))}
          </select>
        ) : <p className="mt-1">{trip ? `${trip.referencia ?? ''} ${trip.titulo}` : 'Sin viaje'}</p>}
        {trip && <p className="mt-2 text-gray-600">{vehiculo ? `Vehículo ${vehiculo.matricula}` : 'Sin vehículo'} · {conductor ? conductor.nombre : 'sin conductor'}</p>}
      </div>

      {(s.recogida_at || s.entregada_at || s.incidencia) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Seguimiento</p>
          {s.recogida_at && <p>Recogida: {fmtTs(s.recogida_at)}</p>}
          {s.entregada_at && <p>Entregada: {fmtTs(s.entregada_at)}{s.receptor_nombre ? ` · recibe ${s.receptor_nombre}` : ''}</p>}
          {s.incidencia && <p className="text-amber-800">Incidencia: {s.incidencia}</p>}
        </div>
      )}
    </Modal>
  );
}

// ── Piezas comunes ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="mb-2 text-sm font-bold text-gray-900">{title}</p>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="flex h-full w-full flex-col bg-slate-50 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 sm:rounded-t-3xl">
          <p className="font-mono text-lg font-bold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-gray-500"><X size={22} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:rounded-b-3xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
