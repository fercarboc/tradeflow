/**
 * TX-CIERRE-1 — Prueba de entrega de una expedición:
 * nombre y DNI de quien recibe, firma en pantalla, fotos y posición.
 * Se usa en la ficha de expedición (oficina) y en la vista del conductor.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Eraser, Loader2, MapPin, PenLine, X, CheckCircle2 } from 'lucide-react';
import {
  markDeliveredWithProof, podSignedUrl, type TradeTransportShipment,
} from '../../lib/transportShipments';

const inputCls = 'w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-300 focus:border-emerald-400 focus:outline-none';
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1';

/** Lienzo de firma con dedo o ratón. */
export function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [vacia, setVacia] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    if (vacia) setVacia(false);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    ref.current!.toBlob(b => onChange(b), 'image/png');
  };
  const borrar = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setVacia(true); onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-white">
        <canvas ref={ref} className="h-40 w-full touch-none rounded-xl"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Firma de quien recibe" />
        {vacia && <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 text-sm text-gray-400"><PenLine size={16} /> Firme aquí</p>}
      </div>
      <button type="button" onClick={borrar} className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-600"><Eraser size={14} /> Borrar firma</button>
    </div>
  );
}

/** Formulario de entrega. Al confirmar guarda la prueba y marca la expedición como entregada. */
export function DeliveryProofForm({ orgId, shipment, onCancel, onDone }: {
  orgId: string;
  shipment: TradeTransportShipment;
  onCancel: () => void;
  onDone: (s: TradeTransportShipment) => void;
}) {
  const [receptor, setReceptor] = useState(shipment.destinatario_nombre ?? '');
  const [dni, setDni] = useState('');
  const [firma, setFirma] = useState<Blob | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [conUbicacion, setConUbicacion] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ubicacion = (): Promise<{ lat: number; lng: number } | null> => new Promise(res => {
    if (!conUbicacion || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });

  const confirmar = async () => {
    setErr(null);
    if (!receptor.trim()) { setErr('Indique el nombre de quien recibe'); return; }
    if (!firma && fotos.length === 0) { setErr('Pida la firma o haga al menos una foto de la entrega'); return; }
    setBusy(true);
    try {
      const geo = await ubicacion();
      onDone(await markDeliveredWithProof(orgId, shipment.id, {
        receptor, dni, firma, fotos, lat: geo?.lat ?? null, lng: geo?.lng ?? null,
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo registrar la entrega');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className={labelCls}>Recibe</label><input className={inputCls} value={receptor} onChange={e => setReceptor(e.target.value)} placeholder="Nombre y apellidos" /></div>
        <div><label className={labelCls}>DNI (opcional)</label><input className={`${inputCls} font-mono uppercase`} value={dni} onChange={e => setDni(e.target.value.toUpperCase())} /></div>
      </div>
      <div><label className={labelCls}>Firma</label><SignaturePad onChange={setFirma} /></div>
      <div>
        <label className={labelCls}>Fotos de la entrega (opcional, hasta 4)</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-3 font-semibold text-gray-700">
          <Camera size={18} /> Hacer o elegir foto
          <input type="file" accept="image/*" capture="environment" multiple hidden
            onChange={e => { const n = Array.from(e.target.files ?? []); setFotos(prev => [...prev, ...n].slice(0, 4)); e.target.value = ''; }} />
        </label>
        {fotos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(f)} alt={`Foto ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                <button type="button" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))} aria-label="Quitar foto"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900 p-0.5 text-white"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={conUbicacion} onChange={e => setConUbicacion(e.target.checked)} />
        <MapPin size={15} /> Guardar el lugar de la entrega
      </label>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-gray-200 py-3 font-semibold text-gray-700">Volver</button>
        <button type="button" onClick={confirmar} disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Confirmar entrega
        </button>
      </div>
    </div>
  );
}

/** Muestra la prueba de entrega guardada. */
export function DeliveryProofView({ s }: { s: TradeTransportShipment }) {
  const [urls, setUrls] = useState<{ firma: string | null; fotos: string[] }>({ firma: null, fotos: [] });
  useEffect(() => {
    let vivo = true;
    (async () => {
      const firma = s.firma_path ? await podSignedUrl(s.firma_path) : null;
      const fotos = (await Promise.all((s.fotos ?? []).map(podSignedUrl))).filter(Boolean) as string[];
      if (vivo) setUrls({ firma, fotos });
    })();
    return () => { vivo = false; };
  }, [s.firma_path, s.fotos]);

  if (!s.firma_path && !(s.fotos?.length) && !s.receptor_dni && s.entrega_lat == null) return null;
  return (
    <div className="space-y-2 text-sm">
      {s.receptor_dni && <p>DNI de quien recibe: <span className="font-mono">{s.receptor_dni}</span></p>}
      {urls.firma && <img src={urls.firma} alt="Firma de quien recibe" className="h-20 rounded-lg border border-gray-200 bg-white" />}
      {urls.fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.fotos.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto de la entrega ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" /></a>
          ))}
        </div>
      )}
      {s.entrega_lat != null && s.entrega_lng != null && (
        <a className="flex items-center gap-1 font-semibold text-blue-700" target="_blank" rel="noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${s.entrega_lat}&mlon=${s.entrega_lng}#map=17/${s.entrega_lat}/${s.entrega_lng}`}>
          <MapPin size={14} /> Ver el lugar de la entrega
        </a>
      )}
    </div>
  );
}
