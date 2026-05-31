import React, { useState, useEffect, useRef } from 'react';
import {
  X, Camera, CheckCircle, Plus, Minus, Search, MapPin, User,
  Clock, Trash2, Loader2, Mic, Square, Sparkles, Wrench,
  MessageSquare, Mail, FileText, ChevronRight, AlertCircle,
  Lock, PlusCircle, ReceiptText,
} from 'lucide-react';
import { supabase, uploadJobPhoto, loadJobPhotos, createInvoiceFromJob } from '../lib/supabase';
import type { TradeJob, TradeJobPhoto, TradeInvoice } from '../lib/supabase';

export interface MaterialItem {
  id: string;
  codigo: string;
  descripcion: string;
  precioBase: number;
  cantidad: number;
  postCierre?: boolean;
}

interface TarifaLike {
  id: string;
  codigo: string;
  descripcion: string;
  precioBase: number;
}

interface ClienteInfo {
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
}

interface MaintenanceInfo {
  activo: boolean;
  materialesIncluidos: boolean;
  nombre: string | null;
}

export interface ScreenParteTrabajoProps {
  job: TradeJob;
  orgId: string;
  tarifas: TarifaLike[];
  mode: 'edit' | 'view' | 'supplement';
  clienteInfo?: ClienteInfo;
  mantenimiento?: MaintenanceInfo | null;
  existingInvoices?: TradeInvoice[];
  onComplete: (jobId: string, notas: string, materiales: MaterialItem[], horaFin: string) => Promise<void>;
  onInvoiceCreated?: (inv: TradeInvoice) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

type Phase =
  | 'main'          // editing / viewing / supplementing
  | 'completing'    // saving completion
  | 'facturar'      // post-completion, choosing to invoice
  | 'generating'    // creating invoice
  | 'done';         // all done

type RecordingState = 'idle' | 'recording' | 'processing';

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function StatusBadge({ inv }: { inv: TradeInvoice }) {
  const cls = inv.es_suplementaria
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {inv.es_suplementaria ? 'SUPL' : 'FAC'}
    </span>
  );
}

export default function ScreenParteTrabajo({
  job, orgId, tarifas, mode, clienteInfo, mantenimiento,
  existingInvoices = [], onComplete, onInvoiceCreated, onClose, showToast, isLiveMode,
}: ScreenParteTrabajoProps) {
  const isReadonly = mode === 'supplement';  // supplement only adds new materials, existing is locked
  const canComplete = mode === 'edit';
  const isCompleted = job.estado === 'completado';

  const [phase, setPhase] = useState<Phase>('main');
  const [photos, setPhotos] = useState<TradeJobPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notas, setNotas] = useState(job.notas_cierre ?? '');
  const [materialSearch, setMaterialSearch] = useState('');
  const [materiales, setMateriales] = useState<MaterialItem[]>([]);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [newInvoice, setNewInvoice] = useState<TradeInvoice | null>(null);
  const [horaFin, setHoraFin] = useState('');
  const [supplementReason, setSupplementReason] = useState('');

  // IA voice
  const [recording, setRecording] = useState<RecordingState>('idle');
  const [transcripcion, setTranscripcion] = useState('');
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(12).fill(6));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('audio/webm');
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLiveMode) return;
    loadJobPhotos(job.id).then(setPhotos).catch(() => {});
  }, [job.id, isLiveMode]);

  // ── Voice recording ────────────────────────────────────────────────────────
  function startWave() {
    waveIntervalRef.current = setInterval(
      () => setWaveHeights(Array.from({ length: 12 }, () => Math.floor(Math.random() * 36) + 6)),
      100,
    );
  }
  function stopWave() {
    if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
    setWaveHeights(Array(12).fill(6));
  }

  async function startRecording() {
    if (!isLiveMode) { setRecording('recording'); startWave(); setTranscripcion(''); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      mimeTypeRef.current = mimeType;
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = rec;
      audioChunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.start(250);
      setRecording('recording'); startWave();
    } catch { showToast('No se puede acceder al micrófono', 'error'); }
  }

  async function stopRecordingAndProcess() {
    stopWave();
    setRecording('processing');

    if (!isLiveMode) {
      await new Promise(r => setTimeout(r, 1500));
      const demoText = 'cambiado junta de bomba del agua, latiguillo y grifo de presión, todo queda funcionando y correcto';
      setTranscripcion(demoText);
      applyAIResult({
        materiales: [
          { id: 'demo-1', codigo: 'JNT-001', descripcion: 'Junta de bomba de agua', cantidad: 1, precioBase: 4.50 },
          { id: 'demo-2', codigo: 'LAT-002', descripcion: 'Latiguillo flexible 1/2"', cantidad: 1, precioBase: 8.00 },
          { id: 'demo-3', codigo: 'GRF-003', descripcion: 'Grifo de presión 1/4 de vuelta', cantidad: 1, precioBase: 12.00 },
        ],
        notas: 'Todo queda funcionando y correcto.',
        isPostCierre: isCompleted,
      });
      setRecording('idle'); return;
    }

    const rec = mediaRecorderRef.current;
    if (!rec) { setRecording('idle'); return; }
    await new Promise<void>(resolve => { rec.onstop = () => resolve(); rec.stop(); rec.stream.getTracks().forEach(t => t.stop()); });

    const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
    if (blob.size < 1000) { showToast('Grabación demasiado corta', 'error'); setRecording('idle'); return; }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await callParseIA({ audio: base64, mimeType: mimeTypeRef.current });
    setRecording('idle');
  }

  async function callParseIA(payload: { audio?: string; mimeType?: string }) {
    try {
      const res = await supabase.functions.invoke('trade-parse-parte', {
        body: { ...payload, catalog: tarifas.slice(0, 150).map(t => ({ id: t.id, codigo: t.codigo, descripcion: t.descripcion, precioBase: t.precioBase })) },
      });
      if (res.error) throw res.error;
      const result = res.data as { transcripcion: string; materiales: MaterialItem[]; notas: string };
      setTranscripcion(result.transcripcion ?? '');
      applyAIResult({ ...result, isPostCierre: isCompleted });
    } catch { showToast('Error al procesar con IA', 'error'); setRecording('idle'); }
  }

  function applyAIResult(result: { materiales: MaterialItem[]; notas: string; isPostCierre?: boolean }) {
    if (result.materiales?.length) {
      setMateriales(prev => {
        const next = [...prev];
        for (const m of result.materiales) {
          const entry: MaterialItem = { ...m, postCierre: result.isPostCierre };
          const existing = next.find(x => x.id === m.id && !m.id.startsWith('demo-') && m.id !== 'nuevo');
          if (existing) existing.cantidad += m.cantidad;
          else next.push(entry);
        }
        return next;
      });
    }
    if (result.notas && !result.isPostCierre) setNotas(prev => prev ? `${prev}\n${result.notas}` : result.notas);
    showToast(`IA detectó ${result.materiales?.length ?? 0} material(es)`, 'success');
  }

  // ── Catalog search ─────────────────────────────────────────────────────────
  const filteredTarifas = tarifas.filter(t => {
    if (!materialSearch) return false;
    const q = materialSearch.toLowerCase();
    return t.descripcion.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q);
  }).slice(0, 8);

  function addMaterial(t: TarifaLike, postCierre = false) {
    setMateriales(prev => {
      const existing = prev.find(m => m.id === t.id && !!m.postCierre === postCierre);
      if (existing) return prev.map(m => (m.id === t.id && !!m.postCierre === postCierre) ? { ...m, cantidad: m.cantidad + 1 } : m);
      return [...prev, { id: t.id, codigo: t.codigo, descripcion: t.descripcion, precioBase: t.precioBase, cantidad: 1, postCierre }];
    });
    setMaterialSearch(''); setShowMaterialPicker(false);
  }

  function changeCantidad(id: string, postCierre: boolean, delta: number) {
    setMateriales(prev => prev
      .map(m => (m.id === id && !!m.postCierre === postCierre) ? { ...m, cantidad: m.cantidad + delta } : m)
      .filter(m => m.cantidad > 0),
    );
  }

  // ── Photos ─────────────────────────────────────────────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isLiveMode) return;
    setUploading(true);
    try {
      const photo = await uploadJobPhoto(job.id, file, 'installer', orgId);
      setPhotos(prev => [...prev, photo]);
      showToast('Foto añadida', 'success');
    } catch { showToast('Error al subir foto', 'error'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function deletePhoto(photo: TradeJobPhoto) {
    if (!isLiveMode || isReadonly) return;
    try { await supabase.from('trade_job_photos').delete().eq('id', photo.id); setPhotos(prev => prev.filter(p => p.id !== photo.id)); }
    catch { showToast('Error al eliminar foto', 'error'); }
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  async function handleComplete() {
    const fin = new Date().toTimeString().slice(0, 5);
    setHoraFin(fin);
    setPhase('completing');
    try {
      await onComplete(job.id, notas, materiales, fin);
      const needsInvoice = !mantenimiento?.activo || !mantenimiento?.materialesIncluidos;
      setPhase(needsInvoice && materiales.length > 0 ? 'facturar' : 'done');
    } catch {
      showToast('Error al completar el trabajo', 'error');
      setPhase('main');
    }
  }

  // ── Generate invoice (primary) ─────────────────────────────────────────────
  async function handleGenerarFactura(materialesList: MaterialItem[], isSupp = false) {
    setPhase('generating');
    try {
      const concepto = isSupp
        ? `Material olvidado — ${job.titulo}${supplementReason ? ` (${supplementReason})` : ''}`
        : `Trabajo: ${job.titulo}`;
      const inv = await createInvoiceFromJob(orgId, job.id, job.client_id, materialesList, {
        concepto,
        esSuplementaria: isSupp,
      });
      setNewInvoice(inv);
      onInvoiceCreated?.(inv);
      setPhase('done');
      showToast(`Factura ${inv.numero} creada`, 'success');
    } catch {
      showToast('Error al generar la factura', 'error');
      setPhase(isSupp ? 'main' : 'facturar');
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const materialesNormales = materiales.filter(m => !m.postCierre);
  const materialesPostCierre = materiales.filter(m => m.postCierre);
  const supplementMateriales = mode === 'supplement' ? materiales : [];

  const subtotalNormal = materialesNormales.reduce((s, m) => s + m.precioBase * m.cantidad, 0);
  const subtotalSupp = supplementMateriales.reduce((s, m) => s + m.precioBase * m.cantidad, 0);
  const ivaSupp = subtotalSupp * 0.21;
  const totalSupp = subtotalSupp + ivaSupp;

  const subtotalFact = (phase === 'facturar' || phase === 'generating') ? subtotalNormal : 0;
  const ivaFact = subtotalFact * 0.21;
  const totalFact = subtotalFact + ivaFact;

  const clienteNombre = clienteInfo?.nombre ?? job.trade_clients?.nombre ?? '';
  const clienteTelefono = clienteInfo?.telefono ?? job.trade_clients?.telefono ?? '';
  const clienteEmail = clienteInfo?.email ?? '';

  const invoiceToSend = newInvoice ?? existingInvoices[existingInvoices.length - 1];
  const waText = encodeURIComponent(
    invoiceToSend
      ? `Hola ${clienteNombre}, adjunto factura ${invoiceToSend.numero} por ${fmtEur(invoiceToSend.total)}.`
      : `Hola ${clienteNombre}, el trabajo "${job.titulo}" ha quedado completado.`,
  );
  const waUrl = clienteTelefono ? `https://wa.me/${clienteTelefono.replace(/\D/g, '')}?text=${waText}` : null;
  const mailUrl = clienteEmail && invoiceToSend
    ? `mailto:${clienteEmail}?subject=${encodeURIComponent(`Factura ${invoiceToSend.numero}`)}&body=${encodeURIComponent(`Hola ${clienteNombre},\n\nAdjunto factura ${invoiceToSend.numero} por importe de ${fmtEur(invoiceToSend.total)}.\n\nGracias.`)}`
    : null;

  // ══════════════════════════════════════════════════════════════════════════
  // POST-COMPLETION / DONE PANEL
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'facturar' || phase === 'generating' || (phase === 'done' && !isReadonly)) {
    const isMantCovered = mantenimiento?.activo && mantenimiento?.materialesIncluidos;
    return (
      <div className="fixed inset-0 z-50 bg-[#0B0F14] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Completado · {horaFin}</p>
            </div>
            <h2 className="text-base font-black text-white truncate">{job.titulo}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 active:bg-white/15 text-slate-400 shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">

          {/* Mantenimiento cubierto */}
          {isMantCovered && phase === 'done' && !newInvoice && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2.5"><Wrench className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm font-bold text-blue-300">Trabajo de mantenimiento — cubierto</p>
              </div>
              <p className="text-xs text-blue-400/70">
                Materiales incluidos en el contrato{mantenimiento?.nombre ? ` de ${mantenimiento.nombre}` : ''}.
              </p>
              {notas && <p className="text-xs text-slate-400 border-t border-blue-500/20 pt-2">{notas}</p>}
            </div>
          )}

          {/* Factura generada */}
          {newInvoice && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-bold text-emerald-300">{newInvoice.numero}</p>
                  {newInvoice.es_suplementaria && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">SUPL</span>}
                </div>
                <span className="text-xs text-slate-400">{newInvoice.fecha}</span>
              </div>
              {newInvoice.concepto && <p className="text-[11px] text-slate-500">{newInvoice.concepto}</p>}
              <div className="flex justify-between items-baseline pt-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-xl font-black text-white font-mono">{fmtEur(newInvoice.total)}</span>
              </div>
            </div>
          )}

          {/* Resumen materiales a facturar */}
          {!isMantCovered && materialesNormales.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {newInvoice ? 'Detalle facturado' : 'Resumen a facturar'}
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {materialesNormales.map((m, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < materialesNormales.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm text-white truncate">{m.descripcion}</p>
                      <p className="text-[10px] text-slate-500">{m.precioBase.toFixed(2)} € × {m.cantidad}</p>
                    </div>
                    <span className="text-sm font-bold text-white font-mono">{fmtEur(m.precioBase * m.cantidad)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-700 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-slate-400"><span>Subtotal</span><span className="font-mono">{fmtEur(subtotalFact)}</span></div>
                  <div className="flex justify-between text-xs text-slate-400"><span>IVA 21%</span><span className="font-mono">{fmtEur(ivaFact)}</span></div>
                  <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-700"><span>Total</span><span className="font-mono">{fmtEur(totalFact)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          {notas && <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Notas</p>
            <p className="text-sm text-slate-300 leading-relaxed">{notas}</p>
          </div>}

          {/* Envío */}
          {phase === 'done' && (waUrl || mailUrl) && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enviar al cliente</p>
              <div className="grid grid-cols-2 gap-2.5">
                {waUrl && <a href={waUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white cursor-pointer active:opacity-80"
                  style={{ backgroundColor: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,0.3)' }}>
                  <MessageSquare className="w-4 h-4" />WhatsApp
                </a>}
                {mailUrl && <a href={mailUrl}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white bg-blue-600 active:bg-blue-700 cursor-pointer">
                  <Mail className="w-4 h-4" />Email
                </a>}
              </div>
            </div>
          )}
          <div className="h-4" />
        </div>

        <div className="px-5 py-4 border-t border-white/8 shrink-0 bg-[#0B0F14]">
          {phase === 'facturar' && materialesNormales.length > 0 && (
            <button onClick={() => handleGenerarFactura(materialesNormales)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 active:bg-blue-700 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
              style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}>
              <FileText className="w-4 h-4" />Generar y registrar factura
            </button>
          )}
          {phase === 'facturar' && materialesNormales.length === 0 && (
            <button onClick={onClose} className="w-full py-4 rounded-2xl text-sm font-bold text-slate-300 bg-slate-800 active:bg-slate-700 cursor-pointer">Cerrar sin facturar</button>
          )}
          {phase === 'generating' && (
            <div className="w-full flex items-center justify-center gap-3 py-4 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" /><span className="text-sm font-semibold">Generando factura…</span>
            </div>
          )}
          {phase === 'done' && (
            <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-slate-300 bg-slate-800 active:bg-slate-700 cursor-pointer">
              <ChevronRight className="w-4 h-4" />Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN PANEL (edit / view / supplement)
  // ══════════════════════════════════════════════════════════════════════════
  const headerTag = mode === 'supplement'
    ? { label: 'Material olvidado', color: 'text-amber-400' }
    : mode === 'view' && isCompleted
    ? { label: 'Parte completado', color: 'text-emerald-400' }
    : { label: 'Parte de trabajo', color: 'text-blue-400' };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F14] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${headerTag.color}`}>{headerTag.label}</p>
          <h2 className="text-base font-black text-white leading-tight truncate">{job.titulo}</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 active:bg-white/15 text-slate-400 shrink-0 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">

        {/* Job info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          {clienteNombre && <div className="flex items-center gap-2.5 text-sm text-slate-300"><User className="w-4 h-4 text-slate-500 shrink-0" /><span className="font-semibold">{clienteNombre}</span></div>}
          {(job.direccion || job.localidad) && <div className="flex items-center gap-2.5 text-sm text-slate-400"><MapPin className="w-4 h-4 text-slate-500 shrink-0" /><span>{[job.direccion, job.localidad].filter(Boolean).join(', ')}</span></div>}
          {job.hora_inicio && <div className="flex items-center gap-2.5 text-sm text-slate-400">
            <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>{job.hora_inicio}{job.hora_fin ? ` → ${job.hora_fin}` : ''}</span>
          </div>}
        </div>

        {/* Banner mantenimiento */}
        {mantenimiento?.activo && (
          <div className="flex items-start gap-3 bg-blue-500/8 border border-blue-500/20 rounded-2xl px-4 py-3">
            <Wrench className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-300">Trabajo de mantenimiento</p>
              <p className="text-[11px] text-blue-400/70 mt-0.5">
                {mantenimiento.materialesIncluidos ? 'Materiales incluidos en el contrato.' : 'Los materiales se facturarán al cliente.'}
              </p>
            </div>
          </div>
        )}

        {/* Facturas existentes */}
        {existingInvoices.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Facturación de este trabajo</p>
            {existingInvoices.map(inv => (
              <div key={inv.id} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ReceiptText className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white">{inv.numero}</span>
                      <StatusBadge inv={inv} />
                    </div>
                    {inv.concepto && <p className="text-[10px] text-slate-500 truncate">{inv.concepto}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white font-mono">{fmtEur(inv.total)}</p>
                  <p className="text-[10px] text-slate-500">{inv.estado}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Locked notice for supplement mode */}
        {mode === 'supplement' && (
          <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3">
            <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-300">Parte cerrado y facturado</p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">
                Añade el material que faltó. Se generará una factura suplementaria con referencia al trabajo original.
              </p>
            </div>
          </div>
        )}

        {/* IA Voice — solo en edit y supplement */}
        {(mode === 'edit' || mode === 'supplement') && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {mode === 'supplement' ? 'Dictar material olvidado' : 'Dictar parte con IA'}
            </p>

            {recording === 'idle' && (
              <button onClick={startRecording}
                className="w-full flex items-center justify-center gap-3 bg-blue-600 active:bg-blue-700 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
                style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}>
                <Mic className="w-5 h-5" />
                {mode === 'supplement' ? 'Dictar material olvidado' : 'Dictar materiales y notas'}
              </button>
            )}
            {recording === 'recording' && (
              <button onClick={stopRecordingAndProcess}
                className="w-full flex flex-col items-center gap-3 bg-red-600 active:bg-red-700 text-white font-bold py-4 rounded-2xl cursor-pointer"
                style={{ boxShadow: '0 4px 24px rgba(220,38,38,0.5)' }}>
                <div className="flex items-center gap-0.5 h-8">
                  {waveHeights.map((h, i) => <div key={i} className="w-1 bg-white/80 rounded-full transition-all duration-100" style={{ height: `${h}px` }} />)}
                </div>
                <div className="flex items-center gap-2 text-sm"><Square className="w-4 h-4" />Parar y procesar con IA</div>
              </button>
            )}
            {recording === 'processing' && (
              <div className="w-full flex items-center justify-center gap-3 bg-slate-800 text-slate-300 font-semibold text-sm py-4 rounded-2xl">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span>Procesando con IA…</span>
              </div>
            )}
            {transcripcion && recording === 'idle' && (
              <div className="bg-slate-900 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Transcripción</p>
                <p className="text-sm text-slate-300 leading-relaxed">{transcripcion}</p>
              </div>
            )}
          </div>
        )}

        {/* Fotos — solo en edit y view */}
        {mode !== 'supplement' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fotos del trabajo</p>
              <span className="text-[10px] text-slate-600">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800 group">
                  <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                  {mode === 'edit' && (
                    <button onClick={() => deletePhoto(p)} className="absolute top-1 right-1 w-6 h-6 bg-red-600/80 rounded-full flex items-center justify-center opacity-0 group-active:opacity-100 cursor-pointer">
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
              {mode === 'edit' && (
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-1 active:border-blue-500 cursor-pointer">
                  {uploading ? <Loader2 className="w-5 h-5 text-slate-500 animate-spin" /> : <><Camera className="w-5 h-5 text-slate-500" /><span className="text-[9px] text-slate-600 font-semibold">Foto</span></>}
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          </div>
        )}

        {/* Materiales (normales o post-cierre) */}
        {mode !== 'supplement' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiales</p>
              {materialesNormales.length > 0 && <span className="text-[10px] font-bold text-blue-400">{fmtEur(subtotalNormal)}</span>}
            </div>

            {/* Add from catalog (edit or view+maintenance+not invoiced) */}
            {(mode === 'edit' || (mode === 'view' && mantenimiento?.activo && existingInvoices.length === 0)) && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input value={materialSearch}
                    onChange={e => { setMaterialSearch(e.target.value); setShowMaterialPicker(true); }}
                    onFocus={() => setShowMaterialPicker(true)}
                    placeholder="Añadir material del catálogo…"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                </div>
                {showMaterialPicker && filteredTarifas.length > 0 && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                    {filteredTarifas.map((t, i) => (
                      <button key={t.id} onClick={() => addMaterial(t, mode === 'view')}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-800 cursor-pointer ${i < filteredTarifas.length - 1 ? 'border-b border-slate-800' : ''}`}>
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-semibold text-white truncate">{t.descripcion}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{t.codigo}</p>
                        </div>
                        <span className="text-sm font-bold text-blue-400 shrink-0">{t.precioBase.toFixed(0)} €</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Lista materiales normales */}
            {materialesNormales.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {materialesNormales.map((m, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < materialesNormales.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{m.descripcion}</p>
                      <p className="text-[10px] text-slate-500">{m.precioBase.toFixed(0)} € × {m.cantidad} = <span className="text-blue-400 font-bold">{fmtEur(m.precioBase * m.cantidad)}</span></p>
                    </div>
                    {mode === 'edit' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => changeCantidad(m.id, false, -1)} className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3 text-slate-300" /></button>
                        <span className="text-sm font-bold text-white w-5 text-center">{m.cantidad}</span>
                        <button onClick={() => changeCantidad(m.id, false, 1)} className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3 text-white" /></button>
                      </div>
                    )}
                    {mode === 'view' && <span className="text-sm font-bold text-white shrink-0 font-mono">{fmtEur(m.precioBase * m.cantidad)}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Materiales post-cierre (mantenimiento) */}
            {materialesPostCierre.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Añadidos tras el cierre</p>
                </div>
                <div className="bg-slate-900 border border-amber-500/20 rounded-xl overflow-hidden">
                  {materialesPostCierre.map((m, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < materialesPostCierre.length - 1 ? 'border-b border-slate-800' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.descripcion}</p>
                        <p className="text-[10px] text-slate-500">{m.precioBase.toFixed(0)} € × {m.cantidad}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => changeCantidad(m.id, true, -1)} className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3 text-slate-300" /></button>
                        <span className="text-sm font-bold text-white w-5 text-center">{m.cantidad}</span>
                        <button onClick={() => changeCantidad(m.id, true, 1)} className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3 text-white" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUPPLEMENT mode: materiales olvidados */}
        {mode === 'supplement' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Material a facturar</p>
              {supplementMateriales.length > 0 && <span className="text-[10px] font-bold text-amber-400">{fmtEur(totalSupp)}</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={materialSearch}
                onChange={e => { setMaterialSearch(e.target.value); setShowMaterialPicker(true); }}
                onFocus={() => setShowMaterialPicker(true)}
                placeholder="Buscar material olvidado…"
                className="w-full bg-slate-900 border border-amber-700/40 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500" />
            </div>
            {showMaterialPicker && filteredTarifas.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                {filteredTarifas.map((t, i) => (
                  <button key={t.id} onClick={() => addMaterial(t, false)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-800 cursor-pointer ${i < filteredTarifas.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <p className="text-sm font-semibold text-white truncate">{t.descripcion}</p>
                    <span className="text-sm font-bold text-amber-400 shrink-0">{t.precioBase.toFixed(0)} €</span>
                  </button>
                ))}
              </div>
            )}
            {supplementMateriales.length > 0 && (
              <div className="bg-slate-900 border border-amber-500/20 rounded-xl overflow-hidden">
                {supplementMateriales.map((m, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < supplementMateriales.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{m.descripcion}</p>
                      <p className="text-[10px] text-slate-500">{m.precioBase.toFixed(0)} € × {m.cantidad} = <span className="text-amber-400 font-bold">{fmtEur(m.precioBase * m.cantidad)}</span></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => changeCantidad(m.id, false, -1)} className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3 text-slate-300" /></button>
                      <span className="text-sm font-bold text-white w-5 text-center">{m.cantidad}</span>
                      <button onClick={() => changeCantidad(m.id, false, 1)} className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3 text-white" /></button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-700 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-slate-400"><span>Subtotal</span><span className="font-mono">{fmtEur(subtotalSupp)}</span></div>
                  <div className="flex justify-between text-xs text-slate-400"><span>IVA 21%</span><span className="font-mono">{fmtEur(ivaSupp)}</span></div>
                  <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-700"><span>Total</span><span className="font-mono">{fmtEur(totalSupp)}</span></div>
                </div>
              </div>
            )}
            {/* Motivo del olvido */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Motivo (opcional)</p>
              <input value={supplementReason} onChange={e => setSupplementReason(e.target.value)}
                placeholder="Ej: No se incluyó en el presupuesto inicial"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        )}

        {/* Notas — solo en edit y view */}
        {mode !== 'supplement' && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas del trabajo</p>
            {mode === 'edit' ? (
              <textarea rows={3} value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="La IA completará esto al dictar…"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
            ) : (
              notas ? <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"><p className="text-sm text-slate-300 leading-relaxed">{notas}</p></div>
                    : <p className="text-xs text-slate-600">Sin notas registradas</p>
            )}
          </div>
        )}

        {/* Aviso facturación en edit mode */}
        {mode === 'edit' && !mantenimiento?.activo && materialesNormales.length > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300/80">Al completar se generará una factura por <span className="font-bold">{fmtEur((subtotalNormal) * 1.21)}</span></p>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/8 shrink-0 bg-[#0B0F14]">
        {canComplete && phase !== 'completing' && (
          <button onClick={handleComplete} disabled={recording !== 'idle'}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(16,185,129,0.35)' }}>
            <CheckCircle className="w-4 h-4" />Completar trabajo
          </button>
        )}
        {phase === 'completing' && (
          <div className="w-full flex items-center justify-center gap-3 py-4 text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /><span className="text-sm font-semibold">Guardando…</span>
          </div>
        )}
        {mode === 'view' && !canComplete && (
          <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-slate-300 bg-slate-800 active:bg-slate-700 cursor-pointer">
            <ChevronRight className="w-4 h-4" />Cerrar
          </button>
        )}
        {mode === 'supplement' && (
          <button onClick={() => handleGenerarFactura(supplementMateriales, true)}
            disabled={supplementMateriales.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 active:bg-amber-700 disabled:opacity-40 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(217,119,6,0.4)' }}>
            <ReceiptText className="w-4 h-4" />Generar factura suplementaria
          </button>
        )}
      </div>
    </div>
  );
}
