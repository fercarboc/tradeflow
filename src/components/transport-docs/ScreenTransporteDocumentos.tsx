/**
 * Documentos de control: DeCA (mercancías) y hojas de ruta (viajeros).
 * Listado, emisión, ficha con QR, compartir, modificar (sustituir) y anular.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  FileText, Plus, Truck, Bus, Loader2, X, Copy, Share2, Download, ExternalLink,
  Pencil, Ban, CheckCircle2, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import TransportDocWizard from './TransportDocWizard';
import { ReceivedDocWizard, ReceivedDocViewer, ReceivedDocsList } from './ReceivedDocs';
import { loadReceivedDocs, type ReceivedDoc, type ReceivedDocTipo, type ReceivedDocInput } from '../../lib/transportReceivedDocs';
import { QrCode, ScanLine } from 'lucide-react';
import {
  loadTransportDocs, loadTransportDoc, cancelTransportDoc, getTransportDocPdfUrl,
  publicDocUrl, isPublicLinkActive, shareText, fmtFechaEs, fmtPesoKg,
  NATURALEZA_SERVICIO_LABEL,
  type TransportControlDoc, type TransportDocTipo, type TransportDocInput,
} from '../../lib/transportDocs';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  /** Qué documentos puede emitir la empresa según su modalidad. */
  allowDeca: boolean;
  allowHojaRuta: boolean;
  /** Abrir el asistente directamente (p. ej. desde un servicio planificado). */
  initialNew?: { tipo: TransportDocTipo; prefill?: Partial<TransportDocInput> } | null;
  onConsumeInitialNew?: () => void;
  /** Abrir directamente el escáner de un documento recibido (DeCA del cliente / hoja de ruta). */
  initialScan?: { tipo?: ReceivedDocTipo; link?: Partial<ReceivedDocInput> } | null;
  onConsumeInitialScan?: () => void;
}

const ESTADO_BADGE: Record<TransportControlDoc['estado'], string> = {
  vigente: 'bg-emerald-100 text-emerald-800',
  sustituido: 'bg-amber-100 text-amber-800',
  anulado: 'bg-red-100 text-red-700',
};

export default function ScreenTransporteDocumentos({ orgId, showToast, allowDeca, allowHojaRuta, initialNew, onConsumeInitialNew, initialScan, onConsumeInitialScan }: Props) {
  const [vista, setVista] = useState<'emitidos' | 'recibidos'>(initialScan ? 'recibidos' : 'emitidos');
  const [recibidos, setRecibidos] = useState<ReceivedDoc[]>([]);
  const [verArchivados, setVerArchivados] = useState(false);
  const [scan, setScan] = useState<{ tipo?: ReceivedDocTipo; link?: Partial<ReceivedDocInput> } | null>(null);
  const [recibido, setRecibido] = useState<ReceivedDoc | null>(null);
  const reloadRecibidos = useCallback(async () => {
    try { setRecibidos(await loadReceivedDocs(orgId, { archivados: verArchivados })); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudieron cargar los recibidos', 'error'); }
  }, [orgId, verArchivados, showToast]);
  useEffect(() => { reloadRecibidos(); }, [reloadRecibidos]);
  useEffect(() => {
    if (initialScan) { setVista('recibidos'); setScan(initialScan); onConsumeInitialScan?.(); }
  }, [initialScan, onConsumeInitialScan]);
  const [docs, setDocs] = useState<TransportControlDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | TransportDocTipo>('todos');
  const [wizard, setWizard] = useState<{ tipo: TransportDocTipo; prefill?: Partial<TransportDocInput>; sustituye?: TransportControlDoc } | null>(null);
  const [selected, setSelected] = useState<TransportControlDoc | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setDocs(await loadTransportDocs(orgId)); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudieron cargar los documentos', 'error'); }
    finally { setLoading(false); }
  }, [orgId, showToast]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (initialNew) { setWizard(initialNew); onConsumeInitialNew?.(); }
  }, [initialNew, onConsumeInitialNew]);

  const visibles = useMemo(() => docs.filter(d => filtro === 'todos' || d.tipo === filtro), [docs, filtro]);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900"><FileText className="text-amber-600" size={22} /> Documentos de control</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {allowDeca && 'DeCA de mercancías'}{allowDeca && allowHojaRuta && ' y '}{allowHojaRuta && 'hojas de ruta de viajeros'} en formato digital, con QR para la inspección.
          </p>
        </div>
      </div>

      {/* Pestañas: emitidos por la empresa / recibidos de clientes */}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1">
        {([['emitidos', 'Emitidos por mí'], ['recibidos', `Recibidos${recibidos.length ? ` (${recibidos.length})` : ''}`]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setVista(v)}
            className={`rounded-xl py-2.5 text-sm font-bold ${vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {vista === 'recibidos' && (
        <div className="mt-4 space-y-3">
          <button type="button" onClick={() => setScan({})}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-white p-4 text-left shadow-sm hover:border-emerald-500">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50"><ScanLine className="text-emerald-600" size={28} /></span>
            <span className="flex-1">
              <span className="block text-lg font-bold text-gray-900">Escanear documento del cliente</span>
              <span className="block text-sm text-gray-500">{allowDeca && allowHojaRuta ? 'DeCA u hoja de ruta' : allowDeca ? 'DeCA que le entrega el cargador' : 'Hoja de ruta que le entregan'} · QR y fotos</span>
            </span>
            <QrCode className="text-emerald-600" />
          </button>
          <ReceivedDocsList docs={recibidos} onOpen={setRecibido} />
          <button type="button" onClick={() => setVerArchivados(v => !v)} className="text-sm font-semibold text-gray-500 underline">
            {verArchivados ? 'Ver los activos' : 'Ver archivados'}
          </button>
        </div>
      )}

      {vista === 'emitidos' && (<>
      {/* Botones grandes de emisión */}
      <div className={`mt-4 grid gap-3 ${allowDeca && allowHojaRuta ? 'sm:grid-cols-2' : ''}`}>
        {allowDeca && (
          <button type="button" onClick={() => setWizard({ tipo: 'deca' })}
            className="flex items-center gap-4 rounded-2xl border-2 border-amber-300 bg-white p-4 text-left shadow-sm hover:border-amber-500">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50"><Truck className="text-amber-600" size={28} /></span>
            <span className="flex-1">
              <span className="block text-lg font-bold text-gray-900">Nuevo DeCA</span>
              <span className="block text-sm text-gray-500">Camión o furgoneta · mercancías</span>
            </span>
            <Plus className="text-amber-600" />
          </button>
        )}
        {allowHojaRuta && (
          <button type="button" onClick={() => setWizard({ tipo: 'hoja_ruta' })}
            className="flex items-center gap-4 rounded-2xl border-2 border-amber-300 bg-white p-4 text-left shadow-sm hover:border-amber-500">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50"><Bus className="text-amber-600" size={28} /></span>
            <span className="flex-1">
              <span className="block text-lg font-bold text-gray-900">Nueva hoja de ruta</span>
              <span className="block text-sm text-gray-500">Autocar o microbús · viajeros</span>
            </span>
            <Plus className="text-amber-600" />
          </button>
        )}
      </div>

      {/* Filtros */}
      {allowDeca && allowHojaRuta && (
        <div className="mt-5 flex gap-2">
          {(['todos', 'deca', 'hoja_ruta'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFiltro(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filtro === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {f === 'todos' ? 'Todos' : f === 'deca' ? 'DeCA' : 'Hojas de ruta'}
            </button>
          ))}
        </div>
      )}

      {/* Listado */}
      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <FileText className="mx-auto text-gray-300" size={36} />
            <p className="mt-2 font-semibold text-gray-700">Aún no hay documentos</p>
            <p className="text-sm text-gray-500">Emita el primero en menos de un minuto con los botones de arriba.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {visibles.map(d => (
              <li key={d.id}>
                <button type="button" onClick={() => setSelected(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${d.tipo === 'deca' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    {d.tipo === 'deca' ? <Truck size={20} /> : <Bus size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-900">{d.numero}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ESTADO_BADGE[d.estado]}`}>{d.estado}</span>
                      {d.estado === 'vigente' && d.fecha_servicio === hoy && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Hoy</span>}
                    </span>
                    <span className="block truncate text-sm text-gray-700">{d.origen} → {d.destino}</span>
                    <span className="block truncate text-xs text-gray-500">{fmtFechaEs(d.fecha_servicio)} · {d.matricula_vehiculo} · {d.cargador_nombre}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck size={14} /> Los documentos se conservan al menos un año y no se pueden borrar ni editar una vez emitidos.
        </p>
      </div>

      </>)}

      {scan && (
        <ReceivedDocWizard
          orgId={orgId} allowDeca={allowDeca} allowHojaRuta={allowHojaRuta}
          defaultTipo={scan.tipo} link={scan.link} showToast={showToast}
          onClose={() => setScan(null)}
          onSaved={async d => { setScan(null); await reloadRecibidos(); setRecibido(d); }}
        />
      )}
      {recibido && !scan && (
        <ReceivedDocViewer doc={recibido} orgId={orgId} showToast={showToast}
          onClose={() => setRecibido(null)} onChanged={reloadRecibidos} />
      )}

      {wizard && (
        <TransportDocWizard
          orgId={orgId}
          tipo={wizard.tipo}
          prefill={wizard.prefill}
          sustituye={wizard.sustituye}
          showToast={showToast}
          onClose={() => setWizard(null)}
          onEmitted={async r => {
            setWizard(null);
            await reload();
            const nuevo = await loadTransportDoc(orgId, r.id).catch(() => null);
            if (nuevo) setSelected(nuevo);
          }}
        />
      )}

      {selected && !wizard && (
        <DocDetail
          doc={selected}
          orgId={orgId}
          showToast={showToast}
          onClose={() => setSelected(null)}
          onModify={() => setWizard({ tipo: selected.tipo, sustituye: selected })}
          onDuplicate={() => {
            const { id: _i, numero: _n, estado: _e, public_token: _t, fecha_servicio: _f, hora_salida: _h, fecha_fin: _ff, ...rest } = selected;
            setWizard({ tipo: selected.tipo, prefill: { ...rest, paradas: selected.paradas, peso_kg: selected.peso_kg, naturaleza_servicio: selected.naturaleza_servicio } as Partial<TransportDocInput> });
          }}
          onCancelled={async () => { setSelected(null); await reload(); }}
        />
      )}
    </div>
  );
}

// ── Ficha del documento ───────────────────────────────────────────────────────

function DocDetail({ doc, orgId, showToast, onClose, onModify, onDuplicate, onCancelled }: {
  doc: TransportControlDoc; orgId: string;
  showToast: Props['showToast'];
  onClose: () => void; onModify: () => void; onDuplicate: () => void; onCancelled: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const url = publicDocUrl(doc.public_token);
  const activo = isPublicLinkActive(doc);

  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 360 }).then(setQr).catch(() => setQr(null));
  }, [url]);

  const openPdf = async (download: boolean) => {
    try { window.open(await getTransportDocPdfUrl(doc, download), '_blank', 'noopener'); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo abrir el PDF', 'error'); }
  };

  const share = async () => {
    const text = shareText(doc);
    if (navigator.share) {
      try { await navigator.share({ title: doc.numero, text }); return; } catch { /* cancelado */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'success'); }
    catch { showToast('No se pudo copiar', 'error'); }
  };

  const anular = async () => {
    if (!motivo.trim()) { showToast('Indique el motivo', 'error'); return; }
    setBusy(true);
    try { await cancelTransportDoc(orgId, doc.id, motivo.trim()); showToast(`${doc.numero} anulado`, 'success'); onCancelled(); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo anular', 'error'); }
    finally { setBusy(false); }
  };

  const filas: [string, string][] = doc.tipo === 'deca' ? [
    ['1 · Cargador contractual', [doc.cargador_nombre, doc.cargador_nif && `NIF ${doc.cargador_nif}`, doc.cargador_domicilio].filter(Boolean).join('\n')],
    ['2 · Transportista efectivo', `${doc.transportista_nombre}\nNIF ${doc.transportista_nif}`],
    ['3 · Lugar de carga', doc.origen],
    ['4 · Lugar de descarga', doc.destino],
    ['5 · Mercancía', doc.naturaleza_mercancia ?? ''],
    ['6 · Peso', doc.peso_kg != null ? fmtPesoKg(Number(doc.peso_kg)) : (doc.otra_magnitud ?? '')],
    ['7 · Matrícula', doc.matricula_vehiculo],
    ['8 · Remolque', doc.matricula_remolque ?? '—'],
    ['9 · Observaciones', [doc.observaciones, doc.paradas.length ? `Paradas: ${doc.paradas.map(p => p.nombre).join(' → ')}` : ''].filter(Boolean).join('\n') || '—'],
  ] : [
    ['1 · Empresa transportista', `${doc.transportista_nombre}\nNIF ${doc.transportista_nif}`],
    ['2 · Contratante', `${doc.cargador_nombre}${doc.cargador_nif ? `\nNIF ${doc.cargador_nif}` : ''}`],
    ['3 · Origen', doc.origen],
    ['4 · Destino', doc.destino],
    ['5 · Paradas', doc.paradas.length ? doc.paradas.map(p => p.hora ? `${p.nombre} (${p.hora})` : p.nombre).join(' → ') : 'Sin paradas'],
    ['6 · Autobús', doc.matricula_vehiculo],
    ['7 · Conductor', `${doc.conductor_nombre ?? ''}\nNIF ${doc.conductor_nif ?? ''}`],
    ['8 · Servicio', `${doc.naturaleza_servicio ? NATURALEZA_SERVICIO_LABEL[doc.naturaleza_servicio] : ''}${doc.servicio_referencia ? `\n${doc.servicio_referencia}` : ''}`],
    ['9 · Observaciones', doc.observaciones || '—'],
  ];

  return (
    <div className="fixed inset-0 z-[65] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="flex h-full w-full flex-col bg-slate-50 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 sm:rounded-t-3xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{doc.tipo === 'deca' ? 'Documento de control' : 'Hoja de ruta'}</p>
            <p className="font-mono text-lg font-bold text-gray-900">{doc.numero}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-gray-500"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {doc.estado === 'vigente' ? (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
              <CheckCircle2 size={20} /> <span className="font-semibold">Vigente · {fmtFechaEs(doc.fecha_servicio)}{doc.hora_salida ? ` · salida ${doc.hora_salida.slice(0, 5)}` : ''}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-red-800">
              <AlertTriangle size={20} className="shrink-0" />
              <span className="text-sm font-semibold">
                {doc.estado === 'anulado' ? `Anulado${doc.motivo_anulacion ? `: ${doc.motivo_anulacion}` : ''}` : 'Sustituido por un documento posterior. Sus datos ya no son válidos.'}
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-3">
              {qr ? <img src={qr} alt="Código QR del documento" className="h-44 w-44" /> : <div className="h-44 w-44 animate-pulse rounded bg-slate-100" />}
              <p className="mt-2 text-center text-xs text-gray-500">
                {activo ? 'Muestre este QR a la Inspección' : 'Enlace público desactivado'}
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-white">
              {filas.map(([k, v]) => (
                <div key={k} className="border-b border-slate-200 last:border-0">
                  <p className="bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="whitespace-pre-line px-3 py-1.5 text-sm font-semibold text-slate-900">{v}</p>
                </div>
              ))}
            </div>
          </div>
          {doc.motivo_modificacion && <p className="mt-3 text-xs text-gray-500">Modificación: {doc.motivo_modificacion}</p>}
          <p className="mt-3 text-xs text-gray-500">Emitido el {new Date(doc.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}.</p>

          {anulando && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
              <label className="text-sm font-semibold text-gray-800">Motivo de la anulación</label>
              <input className="mt-1 w-full rounded-xl border-2 border-gray-200 px-3 py-2.5" value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Ej.: el porte no se realiza" />
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setAnulando(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 font-semibold text-gray-700">Volver</button>
                <button type="button" onClick={anular} disabled={busy} className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white disabled:opacity-50">
                  {busy ? 'Anulando…' : 'Anular documento'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:rounded-b-3xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {activo && (
              <button type="button" onClick={share} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white sm:col-span-1">
                <Share2 size={18} /> Enviar
              </button>
            )}
            <button type="button" onClick={() => openPdf(false)} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 font-semibold text-gray-800">
              <ExternalLink size={18} /> Ver PDF
            </button>
            <button type="button" onClick={() => openPdf(true)} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 font-semibold text-gray-800">
              <Download size={18} /> Descargar
            </button>
            {activo && (
              <button type="button" onClick={copy} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 font-semibold text-gray-800">
                <Copy size={18} /> Copiar enlace
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            {doc.estado === 'vigente' && (
              <button type="button" onClick={onModify} className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold text-amber-800 hover:bg-amber-50">
                <Pencil size={16} /> Modificar
              </button>
            )}
            <button type="button" onClick={onDuplicate} className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold text-gray-700 hover:bg-gray-50">
              <Plus size={16} /> Repetir
            </button>
            {doc.estado === 'vigente' && !anulando && (
              <button type="button" onClick={() => setAnulando(true)} className="flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold text-red-700 hover:bg-red-50">
                <Ban size={16} /> Anular
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
