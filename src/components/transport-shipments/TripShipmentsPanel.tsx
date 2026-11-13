/**
 * TX-CIERRE-1 — Expediciones de un viaje: cargas, paradas (recogidas y
 * entregas en orden), carga total y estado de facturación por expedición.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Package, MapPin, ArrowDownToLine, ArrowUpFromLine, Loader2, Receipt } from 'lucide-react';
import {
  loadShipments, shipmentEstadoMeta, type TradeTransportShipment,
} from '../../lib/transportShipments';
import { loadTransportInvoiceMap } from '../../lib/transportBilling';
import { fmtFechaEs, fmtPesoKg } from '../../lib/transportDocs';
import type { TradeInvoice } from '../../lib/supabase';

export interface TripStop {
  tipo: 'recogida' | 'entrega';
  lugar: string;
  referencias: string[];
  hecho: boolean;
}

/** Paradas del viaje: primero las recogidas y después las entregas, agrupadas por lugar. */
export function buildTripStops(items: TradeTransportShipment[]): TripStop[] {
  const activas = items.filter(s => s.estado !== 'cancelada')
    .sort((a, b) => `${a.fecha_recogida} ${a.hora_recogida ?? ''}`.localeCompare(`${b.fecha_recogida} ${b.hora_recogida ?? ''}`));
  const out: TripStop[] = [];
  const add = (tipo: TripStop['tipo'], lugar: string, ref: string, hecho: boolean) => {
    const key = lugar.trim().toLowerCase();
    const prev = out.find(x => x.tipo === tipo && x.lugar.trim().toLowerCase() === key);
    if (prev) { prev.referencias.push(ref); prev.hecho = prev.hecho && hecho; }
    else out.push({ tipo, lugar, referencias: [ref], hecho });
  };
  for (const s of activas) add('recogida', s.origen, s.referencia ?? '', s.estado !== 'pendiente');
  for (const s of activas) add('entrega', s.destino, s.referencia ?? '', s.estado === 'entregada');
  return out;
}

/** Suma de la carga de las expediciones activas. */
export function sumTripLoad(items: TradeTransportShipment[]) {
  const a = items.filter(s => s.estado !== 'cancelada');
  const sum = (k: 'peso_kg' | 'num_bultos' | 'volumen_m3') =>
    a.reduce((t, s) => t + (s[k] != null ? Number(s[k]) : 0), 0);
  return { peso_kg: sum('peso_kg'), num_bultos: sum('num_bultos'), volumen_m3: Math.round(sum('volumen_m3') * 100) / 100, n: a.length };
}

export default function TripShipmentsPanel({ orgId, tripId, onLoaded, onApplyLoad, canApplyLoad }: {
  orgId: string;
  tripId: string;
  /** Avisa al viaje de cuántas expediciones tiene y cuántas están ya facturadas. */
  onLoaded?: (info: { total: number; facturadas: number }) => void;
  /** Copiar la carga total de las expediciones al viaje. */
  onApplyLoad?: (load: { peso_kg: number | null; num_bultos: number | null; volumen_m3: number | null }) => void;
  canApplyLoad?: boolean;
}) {
  const [items, setItems] = useState<TradeTransportShipment[] | null>(null);
  const [facturas, setFacturas] = useState<Record<string, TradeInvoice>>({});
  const [vista, setVista] = useState<'cargas' | 'paradas'>('cargas');

  useEffect(() => {
    let vivo = true;
    loadShipments(orgId, { tripId }).then(async sh => {
      if (!vivo) return;
      setItems(sh);
      const f = await loadTransportInvoiceMap(orgId, 'shipment', sh.map(x => x.id)).catch(() => ({}));
      if (!vivo) return;
      setFacturas(f);
      onLoaded?.({ total: sh.filter(s => s.estado !== 'cancelada').length, facturadas: Object.keys(f).length });
    }).catch(() => { if (vivo) setItems([]); });
    return () => { vivo = false; };
  }, [orgId, tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const paradas = useMemo(() => buildTripStops(items ?? []), [items]);
  const carga = useMemo(() => sumTripLoad(items ?? []), [items]);

  if (items === null) return <div className="flex justify-center py-4 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Package className="h-4 w-4 text-orange-600" /> Expediciones de este viaje ({carga.n})</p>
        {items.length > 0 && (
          <div className="flex rounded-lg border border-slate-200 text-xs font-semibold">
            <button type="button" onClick={() => setVista('cargas')} className={`px-3 py-1.5 ${vista === 'cargas' ? 'bg-slate-900 text-white rounded-l-lg' : 'text-slate-600'}`}>Cargas</button>
            <button type="button" onClick={() => setVista('paradas')} className={`px-3 py-1.5 ${vista === 'paradas' ? 'bg-slate-900 text-white rounded-r-lg' : 'text-slate-600'}`}>Paradas</button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Todavía no hay expediciones asignadas. Asígnelas desde Expediciones (campo «Viaje»).</p>
      ) : vista === 'cargas' ? (
        <ul className="mt-2 divide-y divide-slate-100">
          {items.map(s => {
            const meta = shipmentEstadoMeta(s.estado);
            return (
              <li key={s.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{s.referencia}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.color}`}>{meta.label}</span>
                  {facturas[s.id] && <span className="flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-800"><Receipt className="h-3 w-3" /> Facturada</span>}
                  {s.precio_acordado != null && <span className="ml-auto text-xs font-semibold text-slate-700">{Number(s.precio_acordado).toFixed(2)} €</span>}
                </div>
                <p className="font-semibold text-slate-900">{s.cargador_nombre}</p>
                <p className="text-slate-600">{s.origen} → {s.destino}</p>
                <p className="text-xs text-slate-500">{fmtFechaEs(s.fecha_recogida)} · {s.naturaleza}{s.peso_kg ? ` · ${fmtPesoKg(Number(s.peso_kg))}` : ''}{s.num_bultos ? ` · ${s.num_bultos} bultos` : ''}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {paradas.map((p, i) => (
            <li key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${p.hecho ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold text-slate-500">{i + 1}</span>
              {p.tipo === 'recogida'
                ? <ArrowUpFromLine className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                : <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{p.tipo === 'recogida' ? 'Recoger en' : 'Entregar en'} {p.lugar}</p>
                <p className="text-xs text-slate-500">{p.referencias.filter(Boolean).join(', ')}{p.hecho ? ' · hecho' : ''}</p>
              </div>
              <a className="ml-auto shrink-0 p-1 text-blue-700" target="_blank" rel="noreferrer" aria-label="Abrir en el mapa"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.lugar)}`}><MapPin className="h-4 w-4" /></a>
            </li>
          ))}
        </ol>
      )}

      {carga.n > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
          <span>Carga total: {carga.peso_kg ? fmtPesoKg(carga.peso_kg) : '—'} · {carga.num_bultos || 0} bultos{carga.volumen_m3 ? ` · ${carga.volumen_m3} m³` : ''}</span>
          {canApplyLoad && onApplyLoad && (
            <button type="button" className="font-bold text-amber-700 underline"
              onClick={() => onApplyLoad({
                peso_kg: carga.peso_kg > 0 ? Math.min(carga.peso_kg, 50000) : null,
                num_bultos: carga.num_bultos > 0 ? carga.num_bultos : null,
                volumen_m3: carga.volumen_m3 > 0 ? carga.volumen_m3 : null,
              })}>
              Usar como carga del viaje
            </button>
          )}
        </div>
      )}
    </div>
  );
}
