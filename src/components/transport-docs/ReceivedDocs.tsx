/**
 * Documentos de control RECIBIDOS (DeCA del cargador / hoja de ruta de otra empresa):
 *  · ReceivedDocWizard  — escanear QR + fotos del papel + datos rápidos
 *  · ReceivedDocViewer  — «Mostrar a la inspección»: QR, PDF y fotos a pantalla completa
 *  · ReceivedDocsList   — listado para consultar siempre que haga falta
 */
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft, Camera, CheckCircle2, ExternalLink, FileText, Image as ImageIcon, Loader2,
  QrCode, RefreshCw, Archive, Trash2, X, AlertTriangle, ShieldCheck, Truck, Bus, Plus,
} from 'lucide-react';
import QrScanner from './QrScanner';
import {
  saveReceivedDoc, fetchReceivedPdf, addReceivedPhotos, loadReceivedDoc, setReceivedArchived,
  deleteReceivedDoc, signedUrl, signedUrls, qrToUrl, RECEIVED_TIPO_LABEL,
  type ReceivedDoc, type ReceivedDocInput, type ReceivedDocTipo,
} from '../../lib/transportReceivedDocs';
import { madridToday, fmtFechaEs } from '../../lib/transportDocs';

type Toast = (msg: string, type?: 'success' | 'error' | 'info') => void;

const inputCls = 'w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 placeholder-gray-300 focus:border-amber-400 focus:outline-none';
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1';

function Shell({ title, onBack, onClose, children, footer, dark }: {
  title: string; onBack?: () => void; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; dark?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[72] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className={`flex h-full w-full flex-col sm:h-auto sm:max-h-[94vh] sm:max-w-xl sm:rounded-3xl sm:shadow-2xl ${dark ? 'bg-white' : 'bg-slate-50'}`}>
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:rounded-t-3xl">
          {onBack && <button type="button" onClick={onBack} aria-label="Atrás" className="p-1.5 text-slate-600"><ArrowLeft size={22} /></button>}
          <p className="flex-1 truncate text-base font-bold text-gray-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1.5 text-gray-500"><X size={22} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:rounded-b-3xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ── Asistente de recepción ────────────────────────────────────────────────────

export function ReceivedDocWizard({ orgId, allowDeca, allowHojaRuta, defaultTipo, link, showToast, onClose, onSaved }: {
  orgId: string; allowDeca: boolean; allowHojaRuta: boolean; defaultTipo?: ReceivedDocTipo;
  /** Vincular con una expedición / viaje / servicio y rellenar datos conocidos. */
  link?: Partial<ReceivedDocInput>;
  showToast: Toast; onClose: () => void; onSaved: (doc: ReceivedDoc) => void;
}) {
  const soloUno = !(allowDeca && allowHojaRuta);
  const tipoInicial: ReceivedDocTipo | null = defaultTipo ?? (soloUno ? (allowDeca ? 'deca' : 'hoja_ruta') : null);
  const [paso, setPaso] = useState<'tipo' | 'qr' | 'fotos' | 'datos' | 'guardando'>(tipoInicial ? 'qr' : 'tipo');
  const [tipo, setTipo] = useState<ReceivedDocTipo | null>(tipoInicial);
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [fotos, setFotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [datos, setDatos] = useState<ReceivedDocInput>({ tipo: 'deca', fecha_servicio: madridToday(), ...link });
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    setFotos(prev => [...prev, ...files.map(f => ({ blob: f as Blob, url: URL.createObjectURL(f) }))].slice(0, 8));
  };

  const guardar = async () => {
    if (!tipo) return;
    setPaso('guardando'); setError(null);
    try {
      const r = await saveReceivedDoc(orgId, { ...datos, tipo, qr_text: qr }, fotos.map(f => f.blob));
      if (r.pdf) showToast('Documento guardado con copia del PDF', 'success');
      else if (r.doc.qr_url) showToast(`Guardado. No se pudo copiar el PDF: ${r.pdfError ?? 'el enlace no lo devuelve'}`, 'info');
      else showToast('Documento guardado', 'success');
      onSaved(r.doc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
      setPaso('datos');
    }
  };

  const qrUrl = qrToUrl(qr);
  const titulo = tipo ? `Recibir ${tipo === 'deca' ? 'DeCA del cliente' : tipo === 'hoja_ruta' ? 'hoja de ruta' : 'documento'}` : 'Documento recibido';

  if (paso === 'tipo') {
    return (
      <Shell title="¿Qué documento le han dado?" onClose={onClose}>
        {([['deca', 'DeCA del cargador', 'Mercancía que va a transportar', <Truck key="t" size={26} />],
           ['hoja_ruta', 'Hoja de ruta', 'Servicio de viajeros (p. ej. colaboración)', <Bus key="b" size={26} />],
           ['otro', 'Otro documento', 'Carta de porte, CMR, albarán…', <FileText key="f" size={26} />]] as const)
          .filter(([v]) => v === 'otro' || (v === 'deca' ? allowDeca : allowHojaRuta))
          .map(([v, l, h, icon]) => (
            <button key={v} type="button" onClick={() => { setTipo(v); setPaso('qr'); }}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-amber-200 bg-white p-4 text-left hover:border-amber-400">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">{icon}</span>
              <span><span className="block text-lg font-bold text-gray-900">{l}</span><span className="block text-sm text-gray-500">{h}</span></span>
            </button>
          ))}
      </Shell>
    );
  }

  if (paso === 'qr') {
    return (
      <Shell title={titulo} onBack={soloUno && !defaultTipo ? undefined : () => setPaso('tipo')} onClose={onClose}
        footer={
          <div className="grid gap-2">
            {qr && <button type="button" onClick={() => setPaso('fotos')} className="w-full rounded-2xl bg-emerald-600 py-3.5 text-lg font-bold text-white">Siguiente</button>}
            {!qr && <button type="button" onClick={() => setPaso('fotos')} className="w-full rounded-2xl border-2 border-gray-200 py-3 font-semibold text-gray-700">No tiene QR · solo papel</button>}
          </div>
        }>
        <h2 className="text-xl font-bold text-gray-900">Escanee el código QR del documento</h2>
        {qr && !scanning ? (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 font-bold text-emerald-900"><CheckCircle2 size={20} /> QR leído</p>
            <p className="mt-1 break-all text-sm text-emerald-900">{qrUrl ? new URL(qrUrl).host : qr.slice(0, 120)}</p>
            {!qrUrl && <p className="mt-1 text-xs text-amber-800">El QR no lleva un enlace https: se guardará el texto, pero no podremos copiar el PDF.</p>}
            <button type="button" onClick={() => { setQr(null); setScanning(true); }} className="mt-3 flex items-center gap-1 text-sm font-semibold text-emerald-800 underline">
              <RefreshCw size={14} /> Volver a escanear
            </button>
          </div>
        ) : (
          <QrScanner onResult={t => { setQr(t); setScanning(false); }} />
        )}
      </Shell>
    );
  }

  if (paso === 'fotos') {
    return (
      <Shell title={titulo} onBack={() => { setPaso('qr'); setScanning(!qr); }} onClose={onClose}
        footer={<button type="button" disabled={!qr && !fotos.length} onClick={() => setPaso('datos')}
          className="w-full rounded-2xl bg-emerald-600 py-3.5 text-lg font-bold text-white disabled:opacity-40">Siguiente</button>}>
        <h2 className="text-xl font-bold text-gray-900">Haga una foto del documento</h2>
        <p className="text-sm text-gray-500">{qr ? 'Opcional, pero recomendable: sirve aunque no haya cobertura para abrir el enlace.' : 'Obligatoria si el documento no tiene QR. Puede hacer varias (hasta 8).'}</p>
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-400 bg-white py-4 text-lg font-bold text-amber-900">
          <Camera size={22} /> {fotos.length ? 'Hacer otra foto' : 'Hacer foto'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={addFotos} />
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <div key={f.url} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
                <img src={f.url} alt={`Foto ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                <button type="button" aria-label="Quitar foto" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell title={titulo} onBack={paso === 'guardando' ? undefined : () => setPaso('fotos')} onClose={onClose}
      footer={<button type="button" onClick={guardar} disabled={paso === 'guardando'}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-lg font-bold text-white disabled:opacity-60">
        {paso === 'guardando' ? <><Loader2 className="animate-spin" size={20} /> Guardando…</> : <><CheckCircle2 size={20} /> Guardar documento</>}
      </button>}>
      <h2 className="text-xl font-bold text-gray-900">Datos para encontrarlo rápido</h2>
      <p className="text-sm text-gray-500">Todo opcional. Lo legal es el documento: estos datos son para buscarlo.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className={labelCls}>{tipo === 'hoja_ruta' ? 'Empresa que lo emite' : 'Cliente / cargador'}</label>
          <input className={inputCls} value={datos.emisor_nombre ?? ''} onChange={e => setDatos(d => ({ ...d, emisor_nombre: e.target.value }))} /></div>
        <div><label className={labelCls}>Nº del documento</label><input className={inputCls} value={datos.numero_documento ?? ''} onChange={e => setDatos(d => ({ ...d, numero_documento: e.target.value }))} /></div>
        <div><label className={labelCls}>Fecha del transporte</label><input type="date" className={inputCls} value={datos.fecha_servicio ?? ''} onChange={e => setDatos(d => ({ ...d, fecha_servicio: e.target.value }))} /></div>
        <div><label className={labelCls}>Matrícula</label><input className={`${inputCls} font-mono uppercase`} value={datos.matricula ?? ''} onChange={e => setDatos(d => ({ ...d, matricula: e.target.value.toUpperCase() }))} /></div>
        <div><label className={labelCls}>Origen</label><input className={inputCls} value={datos.origen ?? ''} onChange={e => setDatos(d => ({ ...d, origen: e.target.value }))} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Destino</label><input className={inputCls} value={datos.destino ?? ''} onChange={e => setDatos(d => ({ ...d, destino: e.target.value }))} /></div>
        <div className="sm:col-span-2"><label className={labelCls}>Notas</label><textarea className={`${inputCls} min-h-[70px]`} value={datos.notas ?? ''} onChange={e => setDatos(d => ({ ...d, notas: e.target.value }))} /></div>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
    </Shell>
  );
}

// ── Ficha: «Mostrar a la inspección» ─────────────────────────────────────────

export function ReceivedDocViewer({ doc: initial, orgId, showToast, onClose, onChanged, onCreateShipment }: {
  doc: ReceivedDoc; orgId: string; showToast: Toast; onClose: () => void; onChanged: () => void;
  /** Crear una expedición rellenada con los datos de este DeCA. */
  onCreateShipment?: (doc: ReceivedDoc) => void;
}) {
  const [doc, setDoc] = useState(initial);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [fotoUrls, setFotoUrls] = useState<string[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (doc.qr_text) QRCode.toDataURL(doc.qr_text, { errorCorrectionLevel: 'M', margin: 1, width: 520 }).then(setQrImg).catch(() => setQrImg(null));
    signedUrls(doc.fotos).then(setFotoUrls).catch(() => setFotoUrls([]));
  }, [doc.qr_text, doc.fotos]);

  const openPdf = async () => {
    if (!doc.pdf_path) return;
    try { window.open(await signedUrl(doc.pdf_path), '_blank', 'noopener'); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo abrir', 'error'); }
  };

  const retryPdf = async () => {
    setBusy('pdf');
    const r = await fetchReceivedPdf(orgId, doc.id);
    const fresh = await loadReceivedDoc(orgId, doc.id);
    if (fresh) setDoc(fresh);
    setBusy(null);
    showToast(r.pdf ? 'Copia del PDF guardada' : `No se pudo copiar: ${r.error ?? 'el enlace no devuelve un PDF'}`, r.pdf ? 'success' : 'error');
    onChanged();
  };

  const morePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setBusy('fotos');
    try { setDoc(await addReceivedPhotos(orgId, doc, files)); showToast('Fotos añadidas', 'success'); onChanged(); }
    catch (x) { showToast(x instanceof Error ? x.message : 'No se pudieron subir', 'error'); }
    finally { setBusy(null); }
  };

  const archivar = async () => {
    setBusy('arch');
    try { await setReceivedArchived(orgId, doc.id, !doc.archivado); showToast(doc.archivado ? 'Recuperado' : 'Archivado', 'success'); onChanged(); onClose(); }
    catch (x) { showToast(x instanceof Error ? x.message : 'Error', 'error'); setBusy(null); }
  };

  const borrar = async () => {
    if (!confirm('¿Borrar este documento? Solo se permite el mismo día para corregir errores.')) return;
    setBusy('del');
    try { await deleteReceivedDoc(orgId, doc.id); showToast('Borrado', 'success'); onChanged(); onClose(); }
    catch (x) { showToast(x instanceof Error ? x.message : 'Error', 'error'); setBusy(null); }
  };

  const ruta = [doc.origen, doc.destino].filter(Boolean).join(' → ');

  return (
    <Shell title={RECEIVED_TIPO_LABEL[doc.tipo]} onClose={onClose} dark>
      {/* Bloque principal para el agente */}
      <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700"><ShieldCheck size={14} /> Documento de control</p>
        <p className="mt-1 text-xl font-black text-gray-900">{doc.emisor_nombre || RECEIVED_TIPO_LABEL[doc.tipo]}</p>
        <div className="mt-1 space-y-0.5 text-base text-gray-800">
          {doc.numero_documento && <p>Nº <b className="font-mono">{doc.numero_documento}</b></p>}
          {doc.fecha_servicio && <p>Fecha: <b>{fmtFechaEs(doc.fecha_servicio)}</b></p>}
          {doc.matricula && <p>Matrícula: <b className="font-mono">{doc.matricula}</b></p>}
          {ruta && <p>{ruta}</p>}
        </div>
      </div>

      {qrImg && (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4">
          <img src={qrImg} alt="Código QR del documento" className="w-full max-w-[300px]" />
          <p className="mt-2 text-center text-sm text-gray-600">El agente puede escanear este QR para descargar el documento original.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {doc.pdf_path ? (
          <button type="button" onClick={openPdf} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-lg font-bold text-white">
            <FileText size={20} /> Ver documento (PDF)
          </button>
        ) : doc.qr_url ? (
          <button type="button" onClick={retryPdf} disabled={busy === 'pdf'} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-400 py-3 font-bold text-amber-900 disabled:opacity-60">
            {busy === 'pdf' ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} Guardar copia del PDF ahora
          </button>
        ) : null}
        {doc.qr_url && (
          <a href={doc.qr_url} target="_blank" rel="noopener noreferrer" className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 font-semibold text-gray-800">
            <ExternalLink size={18} /> Abrir enlace original del emisor
          </a>
        )}
      </div>
      {!doc.pdf_path && doc.pdf_fetch_error && (
        <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> No se pudo copiar el PDF: {doc.pdf_fetch_error}</p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><ImageIcon size={16} /> Fotos del documento ({doc.fotos.length})</p>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'fotos'} className="flex items-center gap-1 text-sm font-semibold text-amber-800">
            {busy === 'fotos' ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Añadir
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={morePhotos} />
        </div>
        {fotoUrls.length ? (
          <div className="grid grid-cols-3 gap-2">
            {fotoUrls.map((u, i) => (
              <button key={i} type="button" onClick={() => setZoom(u)} className="overflow-hidden rounded-xl border border-gray-200">
                <img src={u} alt={`Foto ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
              </button>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">Sin fotos.</p>}
      </div>

      {onCreateShipment && doc.tipo === 'deca' && (
        doc.shipment_id ? (
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} /> Vinculado a una expedición</p>
        ) : (
          <button type="button" onClick={() => onCreateShipment(doc)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-400 bg-emerald-50 py-3.5 font-bold text-emerald-900">
            <Truck size={18} /> Crear expedición con estos datos
          </button>
        )
      )}

      {doc.notas && <p className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-gray-700">{doc.notas}</p>}
      <p className="text-xs text-gray-500">Guardado el {new Date(doc.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}.</p>

      <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
        <button type="button" onClick={archivar} disabled={!!busy} className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-semibold text-gray-700 hover:bg-gray-50">
          <Archive size={16} /> {doc.archivado ? 'Recuperar' : 'Archivar'}
        </button>
        {Date.now() - new Date(doc.created_at).getTime() < 86400_000 && (
          <button type="button" onClick={borrar} disabled={!!busy} className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-semibold text-red-700 hover:bg-red-50">
            <Trash2 size={16} /> Borrar
          </button>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Foto ampliada" className="max-h-full max-w-full object-contain" />
          <button type="button" aria-label="Cerrar" className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"><X size={24} /></button>
        </div>
      )}
    </Shell>
  );
}

// ── Listado ───────────────────────────────────────────────────────────────────

export function ReceivedDocsList({ docs, onOpen }: { docs: ReceivedDoc[]; onOpen: (d: ReceivedDoc) => void }) {
  const hoy = madridToday();
  if (!docs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
        <QrCode className="mx-auto text-gray-300" size={36} />
        <p className="mt-2 font-semibold text-gray-700">No hay documentos recibidos</p>
        <p className="text-sm text-gray-500">Cuando un cliente le entregue su DeCA u hoja de ruta, escanee el QR y guárdelo aquí.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {docs.map(d => (
        <li key={d.id}>
          <button type="button" onClick={() => onOpen(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><QrCode size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900">{d.emisor_nombre || RECEIVED_TIPO_LABEL[d.tipo]}</span>
                {d.fecha_servicio === hoy && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Hoy</span>}
                {d.pdf_path && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">PDF</span>}
                {d.fotos.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{d.fotos.length} foto{d.fotos.length > 1 ? 's' : ''}</span>}
              </span>
              <span className="block truncate text-xs text-gray-500">
                {RECEIVED_TIPO_LABEL[d.tipo]}{d.fecha_servicio ? ` · ${fmtFechaEs(d.fecha_servicio)}` : ''}{d.matricula ? ` · ${d.matricula}` : ''}
                {(d.origen || d.destino) ? ` · ${[d.origen, d.destino].filter(Boolean).join(' → ')}` : ''}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
