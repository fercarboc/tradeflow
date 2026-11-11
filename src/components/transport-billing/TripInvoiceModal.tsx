/**
 * Facturar un viaje de mercancías: crea la factura en Borrador vinculada al viaje.
 * La emisión (numeración + VeriFactu) se hace después desde Facturas.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Receipt, CheckCircle2, Search, FileText, AlertTriangle } from 'lucide-react';
import { supabase, loadClients, getClientDisplayName, type TradeClient, type TradeInvoice } from '../../lib/supabase';
import {
  createTripDraftInvoice, tripClientSuggestions, tripInvoiceConcept, type BillingClientSuggestion,
} from '../../lib/transportBilling';
import { isValidNif } from '../../lib/transportDocs';
import type { TradeTransportTrip } from '../../lib/transportTrips';

const eur = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const inputCls = 'w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-300 focus:border-amber-400 focus:outline-none';
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1';

export default function TripInvoiceModal({ orgId, trip, matricula, onClose, onCreated, onOpenInvoices, intro }: {
  orgId: string;
  trip: TradeTransportTrip;
  matricula?: string | null;
  onClose: () => void;
  onCreated: (inv: TradeInvoice) => void;
  onOpenInvoices?: () => void;
  /** Texto de cabecera opcional (p. ej. tras completar el viaje). */
  intro?: string;
}) {
  const [clients, setClients] = useState<TradeClient[]>([]);
  const [sugerencias, setSugerencias] = useState<BillingClientSuggestion[]>([]);
  const [q, setQ] = useState('');
  const [clientId, setClientId] = useState<string | null>(trip.client_id ?? null);
  const [nombre, setNombre] = useState(trip.cliente_nombre ?? '');
  const [nif, setNif] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [base, setBase] = useState<string>(trip.precio_acordado != null ? String(trip.precio_acordado) : '');
  const [iva, setIva] = useState<number>(21);
  const [concepto, setConcepto] = useState(() => tripInvoiceConcept(trip, matricula));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creada, setCreada] = useState<TradeInvoice | null>(null);

  useEffect(() => {
    loadClients(orgId).then(setClients).catch(() => setClients([]));
    tripClientSuggestions(orgId, trip.id).then(s => {
      setSugerencias(s);
      // Si aún no hay cliente vinculado, proponemos el primero con NIF
      const first = s.find(x => x.nif) ?? s[0];
      if (first && !clientId) { setNombre(first.nombre); setNif(first.nif ?? ''); setDomicilio(first.domicilio ?? ''); }
    }).catch(() => undefined);
    supabase.from('trade_organizations').select('iva_default').eq('id', orgId).maybeSingle()
      .then(({ data }) => { if (data?.iva_default != null) setIva(Number(data.iva_default)); });
  }, [orgId, trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si el NIF coincide con un cliente existente, lo usamos
  useEffect(() => {
    if (clientId) return;
    const n = nif.toUpperCase().replace(/[\s.-]/g, '');
    if (!n) return;
    const c = clients.find(x => (x.nif ?? '').toUpperCase().replace(/[\s.-]/g, '') === n);
    if (c) setClientId(c.id);
  }, [nif, clients, clientId]);

  const cliente = clientId ? clients.find(c => c.id === clientId) : undefined;
  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return clients.filter(c => `${c.nombre} ${c.apellidos ?? ''} ${c.nif ?? ''}`.toLowerCase().includes(t)).slice(0, 6);
  }, [clients, q]);

  const baseNum = Number(String(base).replace(',', '.'));
  const ivaImporte = Number.isFinite(baseNum) ? Math.round(baseNum * iva) / 100 : 0;
  const total = Number.isFinite(baseNum) ? baseNum + ivaImporte : 0;
  const nifCliente = cliente?.nif ?? nif;
  const sinNif = !nifCliente || !isValidNif(nifCliente);

  const crear = async () => {
    setErr(null);
    if (!(baseNum > 0)) { setErr('Indique el importe a facturar'); return; }
    if (!clientId && !nombre.trim()) { setErr('Indique el cliente'); return; }
    setSaving(true);
    try {
      const inv = await createTripDraftInvoice(orgId, trip, {
        client: clientId ? { id: clientId } : { nombre, nif: nif || null, domicilio: domicilio || null },
        base: baseNum, ivaPct: iva, concepto: concepto.trim() || tripInvoiceConcept(trip, matricula),
      });
      setCreada(inv);
      onCreated(inv);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear la factura');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="flex h-full w-full flex-col bg-slate-50 sm:h-auto sm:max-h-[92vh] sm:max-w-xl sm:rounded-3xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 sm:rounded-t-3xl">
          <p className="flex items-center gap-2 text-lg font-bold text-gray-900"><Receipt size={20} className="text-amber-600" /> Facturar viaje</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-gray-500"><X size={22} /></button>
        </div>

        {creada ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
            <p className="text-xl font-bold text-gray-900">Factura creada en borrador</p>
            <p className="text-gray-600">{eur(total)} · {cliente ? getClientDisplayName(cliente) : nombre}</p>
            <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              Queda <b>pendiente de emitir</b>. Revísela y pulse «Emitir» en Facturas: ahí se asigna el número y se registra en VeriFactu.
            </p>
            <div className="grid gap-2">
              {onOpenInvoices && <button type="button" onClick={onOpenInvoices} className="w-full rounded-2xl bg-slate-900 py-3.5 font-bold text-white">Ir a Facturas</button>}
              <button type="button" onClick={onClose} className="w-full rounded-2xl border border-gray-200 py-3 font-semibold text-gray-700">Cerrar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {intro && <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{intro}</p>}

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="mb-2 text-sm font-bold text-gray-900">Cliente a facturar</p>
                {cliente ? (
                  <div className="flex items-start justify-between gap-2 rounded-xl bg-emerald-50 p-3">
                    <div>
                      <p className="font-bold text-gray-900">{getClientDisplayName(cliente)}</p>
                      <p className="font-mono text-sm text-gray-600">{cliente.nif || 'Sin NIF'}</p>
                      {cliente.direccion && <p className="text-sm text-gray-600">{cliente.direccion}</p>}
                    </div>
                    <button type="button" onClick={() => setClientId(null)} className="text-sm font-semibold text-emerald-800 underline">Cambiar</button>
                  </div>
                ) : (
                  <>
                    {sugerencias.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {sugerencias.map((s, i) => (
                          <button key={i} type="button" onClick={() => { setNombre(s.nombre); setNif(s.nif ?? ''); setDomicilio(s.domicilio ?? ''); }}
                            className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
                            <FileText size={12} /> {s.nombre} <span className="font-normal text-amber-700">({s.fuente})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input className={`${inputCls} pl-9`} placeholder="Buscar en mis clientes…" value={q} onChange={e => setQ(e.target.value)} />
                    </div>
                    {resultados.map(c => (
                      <button key={c.id} type="button" onClick={() => { setClientId(c.id); setQ(''); }}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-amber-400">
                        <b>{getClientDisplayName(c)}</b> {c.nif && <span className="font-mono text-xs text-gray-500">{c.nif}</span>}
                      </button>
                    ))}
                    <div className="mt-2 grid gap-2">
                      <div><label className={labelCls}>Nombre o razón social</label><input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
                      <div><label className={labelCls}>NIF / CIF</label><input className={`${inputCls} font-mono uppercase`} value={nif} onChange={e => setNif(e.target.value.toUpperCase())} /></div>
                      <div><label className={labelCls}>Domicilio fiscal</label><input className={inputCls} value={domicilio} onChange={e => setDomicilio(e.target.value)} /></div>
                      <p className="text-xs text-gray-500">Si no existe, se dará de alta como cliente nuevo.</p>
                    </div>
                  </>
                )}
                {sinNif && (
                  <p className="mt-2 flex gap-1.5 text-xs text-amber-800"><AlertTriangle size={14} className="shrink-0" /> Sin NIF válido la factura será simplificada; para una factura completa a empresa, indique su NIF.</p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="mb-2 text-sm font-bold text-gray-900">Importe</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Base (sin IVA)</label>
                    <input inputMode="decimal" className={`${inputCls} text-right font-bold`} value={base} onChange={e => setBase(e.target.value)} placeholder="0,00" /></div>
                  <div><label className={labelCls}>IVA</label>
                    <select className={inputCls} value={iva} onChange={e => setIva(Number(e.target.value))}>
                      {[21, 10, 4, 0].map(v => <option key={v} value={v}>{v} %</option>)}
                    </select></div>
                </div>
                <div className="mt-3 space-y-0.5 text-sm">
                  <p className="flex justify-between text-gray-600"><span>Base</span><span>{eur(Number.isFinite(baseNum) ? baseNum : 0)}</span></p>
                  <p className="flex justify-between text-gray-600"><span>IVA {iva} %</span><span>{eur(ivaImporte)}</span></p>
                  <p className="flex justify-between text-lg font-black text-gray-900"><span>Total</span><span>{eur(total)}</span></p>
                </div>
                {trip.precio_acordado != null && <p className="mt-1 text-xs text-gray-500">Precio acordado del viaje: {eur(Number(trip.precio_acordado))}. Compruebe si lo pactó con o sin IVA.</p>}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <label className={labelCls}>Concepto</label>
                <textarea className={`${inputCls} min-h-[80px] text-sm`} value={concepto} onChange={e => setConcepto(e.target.value)} />
              </div>
              {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
            </div>
            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:rounded-b-3xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={crear} disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-lg font-bold text-white disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Receipt size={20} />} Crear factura (borrador)
              </button>
              <p className="mt-1 text-center text-xs text-gray-500">Se emite después desde Facturas con VeriFactu.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
