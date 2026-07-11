import React, { useState, useEffect, useRef } from 'react';
import {
  X, Camera, CheckCircle, Plus, Minus, Search, MapPin, User,
  Clock, Trash2, Loader2, Mic, Square, Wrench,
  MessageSquare, Mail, FileText, ChevronRight, AlertCircle,
  Lock, PlusCircle, ReceiptText, StickyNote, Send, Star, PenLine,
} from 'lucide-react';
import { supabase, uploadJobPhoto, loadJobPhotos, createInvoiceFromJob, markInvoicePaid, emitirFactura, createFieldAction, uploadJobSignature, saveJobSignature, createJobReviewToken } from '../lib/supabase';
import type { TradeJob, TradeJobPhoto, TradeInvoice, TradeFieldAction, TradeQuoteItem } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import SignaturePad from './SignaturePad';

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
  | 'firma'         // cliente firma el parte
  | 'guardando_firma' // subiendo firma
  | 'facturar'      // post-completion, choosing to invoice
  | 'generating'    // creating invoice
  | 'done';         // all done

type RecordingState = 'idle' | 'recording' | 'processing';

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function StatusBadge({ inv }: { inv: TradeInvoice }) {
  const cls = inv.es_suplementaria
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-emerald-100 text-emerald-700 border-emerald-200';
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
  const { rol, workerProfile } = useSession();
  const isTecnico = rol === 'tecnico';

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
  const [invoicePaid, setInvoicePaid] = useState<boolean | null>(null);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'bizum' | 'transferencia' | 'tarjeta'>('efectivo');
  const [horaFin, setHoraFin] = useState('');
  const [supplementReason, setSupplementReason] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
  const [showCustomLine, setShowCustomLine] = useState(false);
  const [customLineDesc, setCustomLineDesc] = useState('');
  const [customLinePrice, setCustomLinePrice] = useState('');
  const [customLineCant, setCustomLineCant] = useState('1');

  // Manual invoice form (when no materials and no linked quote)
  const [manualConcepto, setManualConcepto] = useState('');
  const [manualImporte, setManualImporte] = useState('');

  // Firma del cliente
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [savedFirmaUrl, setSavedFirmaUrl] = useState<string | null>(job.firma_cliente_url ?? null);
  const [reviewToken, setReviewToken] = useState<string | null>(null);

  // Quote items (when job is linked to a quote)
  const [quotedItems, setQuotedItems] = useState<TradeQuoteItem[]>([]);

  useEffect(() => {
    if (!job.quote_id || !isLiveMode) return;
    supabase
      .from('trade_quotes')
      .select('*, trade_quote_items(*)')
      .eq('id', job.quote_id)
      .single()
      .then(({ data }) => {
        if (data?.trade_quote_items?.length) {
          setQuotedItems(data.trade_quote_items as TradeQuoteItem[]);
        }
      });
  }, [job.quote_id, isLiveMode]);

  // Field notes (tecnico)
  const [fieldNoteText, setFieldNoteText] = useState('');
  const [fieldNoteTipo, setFieldNoteTipo] = useState<TradeFieldAction['tipo']>('otro');
  const [savingFieldNote, setSavingFieldNote] = useState(false);

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
        transcripcion: demoText,
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

  function applyAIResult(result: { materiales: MaterialItem[]; notas: string; transcripcion?: string; isPostCierre?: boolean }) {
    if (isTecnico) {
      const text = result.transcripcion ?? result.notas ?? '';
      if (text) setFieldNoteText(text);
      showToast('Nota de campo transcrita ✓', 'success');
      return;
    }
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

  function startEditPrice(m: MaterialItem) {
    setEditingPriceId(m.id);
    setEditingPriceVal(m.precioBase.toFixed(2));
  }

  function commitEditPrice(id: string) {
    const newPrice = parseFloat(editingPriceVal.replace(',', '.'));
    if (!isNaN(newPrice) && newPrice >= 0) {
      setMateriales(prev => prev.map(m => m.id === id ? { ...m, precioBase: newPrice } : m));
    }
    setEditingPriceId(null);
  }

  function addCustomLine() {
    const price = parseFloat(customLinePrice.replace(',', '.'));
    const cant = parseInt(customLineCant) || 1;
    if (!customLineDesc.trim() || isNaN(price) || price < 0) return;
    setMateriales(prev => [...prev, {
      id: `custom-${Date.now()}`,
      codigo: '',
      descripcion: customLineDesc.trim(),
      precioBase: price,
      cantidad: cant,
    }]);
    setCustomLineDesc('');
    setCustomLinePrice('');
    setCustomLineCant('1');
    setShowCustomLine(false);
  }

  // ── Photos ─────────────────────────────────────────────────────────────────
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isLiveMode) return;
    setUploading(true);
    try {
      const photo = await uploadJobPhoto(job.id, file, workerProfile?.id ?? null, orgId);
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
      if (isTecnico) { setPhase('done'); return; }
      setPhase('firma');
    } catch {
      showToast('Error al completar el trabajo', 'error');
      setPhase('main');
    }
  }

  // ── Field note (tecnico) ───────────────────────────────────────────────────
  async function handleSaveFieldNote() {
    if (!fieldNoteText.trim()) return;
    setSavingFieldNote(true);
    try {
      if (isLiveMode) {
        await supabase.from('trade_jobs').update({
          notas_trabajador: fieldNoteText,
          notas_trabajador_at: new Date().toISOString(),
          notas_trabajador_leida: false,
        }).eq('id', job.id);
        await createFieldAction(orgId, {
          tipo: fieldNoteTipo,
          descripcion: fieldNoteText,
          job_id: job.id,
          worker_id: workerProfile?.id,
        });
      }
      showToast('Nota guardada ✓', 'success');
      setFieldNoteText('');
      setFieldNoteTipo('otro');
    } catch {
      showToast('Error al guardar la nota', 'error');
    } finally {
      setSavingFieldNote(false);
    }
  }

  // ── Generate invoice (primary) ─────────────────────────────────────────────
  async function handleGenerarFactura(materialesList: MaterialItem[], isSupp = false) {
    setPhase('generating');
    try {
      // If no local materials but job is linked to a quote, use the quote's items
      const useQuoteItems = !isSupp && materialesList.length === 0 && quotedItems.length > 0;
      const effectiveMaterials = useQuoteItems
        ? quotedItems.map(i => ({ id: i.id, codigo: '', descripcion: i.descripcion, precioBase: i.precio_unitario, cantidad: i.cantidad, tipo: i.tipo }))
        : materialesList;

      const matDesc = materialesList.length > 0
        ? ' — ' + materialesList.map(m => `${m.descripcion}${m.cantidad > 1 ? ` ×${m.cantidad}` : ''}`).join(', ')
        : '';
      const concepto = isSupp
        ? `Material olvidado — ${job.titulo}${supplementReason ? ` (${supplementReason})` : ''}${matDesc}`
        : `${job.titulo}${matDesc}`;
      const matsWithType = effectiveMaterials.map(m => ({
        descripcion: m.descripcion,
        cantidad: m.cantidad,
        precioBase: m.precioBase,
        tipo: (m as { tipo?: string }).tipo ?? (
          m.descripcion.toLowerCase().includes('mano') || m.descripcion.toLowerCase().includes('desplaz')
            ? (m.descripcion.toLowerCase().includes('desplaz') ? 'desplazamiento' : 'mano_de_obra')
            : 'material'
        ),
      }));
      const inv = await createInvoiceFromJob(orgId, job.id, job.client_id, matsWithType, {
        concepto,
        esSuplementaria: isSupp,
        quoteId: useQuoteItems ? (job.quote_id ?? null) : null,
      });
      setNewInvoice(inv);
      onInvoiceCreated?.(inv);
      setPhase('done');
      showToast('Borrador de factura creado — elige cómo se cobra', 'info');
    } catch {
      showToast('Error al generar la factura', 'error');
      setPhase(isSupp ? 'main' : 'facturar');
    }
  }

  // ── Payment after invoice ──────────────────────────────────────────────────
  async function handleCobrado(method: typeof metodoPago) {
    if (!newInvoice) return;
    setInvoicePaid(true);
    if (!isLiveMode) return;
    try {
      const emitted = await emitirFactura(newInvoice.id, orgId);
      await markInvoicePaid(emitted.id);
      await supabase.from('trade_invoices').update({ metodo_pago: method }).eq('id', emitted.id);
      setNewInvoice(emitted);
      showToast(`Factura ${emitted.numero} emitida y cobrada ✓`, 'success');
    } catch {
      showToast('Error al registrar el cobro', 'error');
    }
  }

  async function handlePendiente() {
    if (!newInvoice) { setInvoicePaid(false); return; }
    setInvoicePaid(false);
    if (!isLiveMode) return;
    try {
      const emitted = await emitirFactura(newInvoice.id, orgId);
      await supabase.from('trade_invoices').update({ metodo_pago: 'transferencia' }).eq('id', emitted.id);
      setNewInvoice(emitted);
      showToast(`Factura ${emitted.numero} emitida — pendiente de transferencia`, 'info');
    } catch {
      showToast('Error al emitir la factura', 'error');
    }
  }

  // ── Firma del cliente ─────────────────────────────────────────────────────
  function goToFacturar() {
    const needsInvoice = !mantenimiento?.activo || !mantenimiento?.materialesIncluidos;
    setPhase(needsInvoice ? 'facturar' : 'done');
  }

  async function handleFirmarYContinuar() {
    if (!signatureDataUrl) { showToast('Añade la firma antes de continuar', 'error'); return; }
    setPhase('guardando_firma');
    try {
      const url = await uploadJobSignature(job.id, orgId, signatureDataUrl);
      await saveJobSignature(job.id, url);
      setSavedFirmaUrl(url);
      showToast('Firma guardada ✓', 'success');
    } catch {
      showToast('Error al guardar la firma — puedes continuar sin ella', 'info');
    }
    goToFacturar();
  }

  function handleSaltarFirma() {
    goToFacturar();
  }

  // ── Generate invoice from manual concepto+importe ──────────────────────────
  async function handleGenerarFacturaManual() {
    const importe = parseFloat(manualImporte.replace(',', '.'));
    if (!manualConcepto.trim() || !(importe > 0)) {
      showToast('Indica el concepto y un importe mayor que 0', 'error');
      return;
    }
    setPhase('generating');
    try {
      const inv = await createInvoiceFromJob(orgId, job.id, job.client_id, [
        { descripcion: manualConcepto.trim(), cantidad: 1, precioBase: importe, tipo: 'mano_de_obra' },
      ], { concepto: manualConcepto.trim() });
      setNewInvoice(inv);
      onInvoiceCreated?.(inv);
      setPhase('done');
      showToast('Borrador de factura creado — elige cómo se cobra', 'info');
    } catch {
      showToast('Error al generar la factura', 'error');
      setPhase('facturar');
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

  // Quote items for display when no local materials
  const showQuoteItems = materialesNormales.length === 0 && quotedItems.length > 0;
  const subtotalQuoted = quotedItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const ivaQuoted = subtotalQuoted * 0.21;
  const totalQuoted = subtotalQuoted + ivaQuoted;

  // Manual invoice mode: no materials and no quote
  const showManualForm = materialesNormales.length === 0 && !showQuoteItems;
  const manualImporteNum = parseFloat(manualImporte.replace(',', '.')) || 0;
  const manualValid = manualConcepto.trim().length > 0 && manualImporteNum > 0;

  const clienteNombre = clienteInfo?.nombre ?? job.trade_clients?.nombre ?? '';
  const clienteTelefono = clienteInfo?.telefono ?? job.trade_clients?.telefono ?? '';
  const clienteEmail = clienteInfo?.email ?? '';

  const invoiceToSend = newInvoice ?? existingInvoices[existingInvoices.length - 1];
  const waText = encodeURIComponent(
    invoiceToSend
      ? `Hola ${clienteNombre}, te adjunto la factura ${invoiceToSend.numero} por ${fmtEur(invoiceToSend.total)} del trabajo "${job.titulo}". Gracias.`
      : `Hola ${clienteNombre}, el trabajo "${job.titulo}" ha quedado completado. Gracias por confiar en nosotros.`,
  );
  const waUrl = clienteTelefono ? `https://wa.me/${clienteTelefono.replace(/\D/g, '')}?text=${waText}` : null;
  const mailUrl = clienteEmail && invoiceToSend
    ? `mailto:${clienteEmail}?subject=${encodeURIComponent(`Factura ${invoiceToSend.numero}`)}&body=${encodeURIComponent(`Hola ${clienteNombre},\n\nAdjunto factura ${invoiceToSend.numero} por importe de ${fmtEur(invoiceToSend.total)} del trabajo "${job.titulo}".\n\nGracias.`)}`
    : null;

  const buildReviewWaUrl = (token: string) => {
    if (!clienteTelefono) return null;
    const base = window.location.origin;
    const link = `${base}/valorar/${token}`;
    const msg = encodeURIComponent(
      `Hola ${clienteNombre}, ¿quedaste satisfecho con el trabajo "${job.titulo}"?\n\nValóranos en 30 segundos — te lo agradeceríamos mucho:\n${link}`,
    );
    return `https://wa.me/${clienteTelefono.replace(/\D/g, '')}?text=${msg}`;
  };

  async function handlePedirValoracion() {
    if (!isLiveMode) { showToast('Solo disponible en modo real', 'info'); return; }
    try {
      let token = reviewToken;
      if (!token) {
        token = await createJobReviewToken(orgId, job.id, job.titulo, clienteNombre);
        setReviewToken(token);
      }
      const url = buildReviewWaUrl(token);
      if (url) { window.open(url, '_blank'); }
      else { showToast('No hay teléfono del cliente para enviar la encuesta', 'error'); }
    } catch {
      showToast('Error al crear el enlace de valoración', 'error');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FASE FIRMA
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'firma' || phase === 'guardando_firma') {
    const totalResumen = showQuoteItems ? totalQuoted : subtotalNormal > 0 ? totalFact : manualImporteNum > 0 ? manualImporteNum * 1.21 : null;
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <PenLine className="w-4 h-4 text-blue-600" />
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Parte de trabajo · Firma</p>
            </div>
            <h2 className="text-base font-black text-gray-900 truncate">{job.titulo}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
          {/* Resumen del trabajo */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Trabajo realizado</p>
                <p className="text-sm font-black text-gray-900 leading-snug">{job.titulo}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Completado · {horaFin}</span>
              </div>
            </div>
            {clienteNombre && (
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-700">{clienteNombre}</span>
              </div>
            )}
            {notas && (
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Notas</p>
                <p className="text-xs text-gray-700 leading-relaxed">{notas}</p>
              </div>
            )}
            {/* Materiales o partidas */}
            {materialesNormales.length > 0 && (
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Materiales</p>
                {materialesNormales.map((m, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-700 py-0.5">
                    <span className="truncate pr-3">{m.descripcion} × {m.cantidad}</span>
                    <span className="font-mono shrink-0">{fmtEur(m.precioBase * m.cantidad)}</span>
                  </div>
                ))}
              </div>
            )}
            {showQuoteItems && (
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">Partidas</p>
                {quotedItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-700 py-0.5">
                    <span className="truncate pr-3">{item.descripcion} × {item.cantidad}</span>
                    <span className="font-mono shrink-0">{fmtEur(item.cantidad * item.precio_unitario)}</span>
                  </div>
                ))}
              </div>
            )}
            {photos.length > 0 && (
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">{photos.length} foto{photos.length !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 overflow-x-auto">
                  {photos.slice(0, 4).map(p => (
                    <img key={p.id} src={p.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ))}
                </div>
              </div>
            )}
            {totalResumen !== null && (
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500">Total (IVA incl.)</span>
                <span className="text-lg font-black text-gray-900 font-mono">{fmtEur(totalResumen)}</span>
              </div>
            )}
          </div>

          {/* Firma */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Conformidad del cliente — firma aquí
            </p>
            <SignaturePad
              onDataUrl={setSignatureDataUrl}
              height={200}
            />
          </div>
          <div className="h-2" />
        </div>

        <div className="px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50 space-y-2.5">
          {phase === 'guardando_firma' ? (
            <div className="w-full flex items-center justify-center gap-3 py-4 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-semibold">Guardando firma…</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleFirmarYContinuar}
                disabled={!signatureDataUrl}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
                style={{ boxShadow: signatureDataUrl ? '0 4px 24px rgba(37,99,235,0.4)' : 'none' }}>
                <CheckCircle className="w-4 h-4" />Firmar y continuar
              </button>
              <button
                onClick={handleSaltarFirma}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100 active:bg-gray-200 cursor-pointer">
                Saltar firma
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST-COMPLETION PANEL — TÉCNICO (no billing)
  // ══════════════════════════════════════════════════════════════════════════
  if (isTecnico && (phase === 'facturar' || phase === 'generating' || phase === 'done')) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Completado · {horaFin}</p>
            </div>
            <h2 className="text-base font-black text-gray-900 truncate">{job.titulo}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-gray-900">Trabajo completado</p>
            <p className="text-sm text-gray-400 mt-1.5">Queda pendiente de facturar por oficina</p>
          </div>
          {notas ? (
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3 w-full">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tus notas</p>
              <p className="text-sm text-gray-600 leading-relaxed">{notas}</p>
            </div>
          ) : null}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50">
          <button onClick={onClose}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(16,185,129,0.35)' }}>
            <ChevronRight className="w-4 h-4" />Cerrar parte
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST-COMPLETION / DONE PANEL
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'facturar' || phase === 'generating' || (phase === 'done' && !isReadonly)) {
    const isMantCovered = mantenimiento?.activo && mantenimiento?.materialesIncluidos;
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Completado · {horaFin}</p>
            </div>
            <h2 className="text-base font-black text-gray-900 truncate">{job.titulo}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">

          {/* Mantenimiento cubierto */}
          {isMantCovered && phase === 'done' && !newInvoice && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2.5"><Wrench className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-sm font-bold text-blue-700">Trabajo de mantenimiento — cubierto</p>
              </div>
              <p className="text-xs text-blue-600/70">
                Materiales incluidos en el contrato{mantenimiento?.nombre ? ` de ${mantenimiento.nombre}` : ''}.
              </p>
              {notas && <p className="text-xs text-gray-400 border-t border-blue-200 pt-2">{notas}</p>}
            </div>
          )}

          {/* Factura generada */}
          {newInvoice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-700">{newInvoice.numero}</p>
                  {newInvoice.es_suplementaria && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">SUPL</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{newInvoice.fecha}</span>
                  {invoicePaid === true && <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">COBRADA</span>}
                  {invoicePaid === false && <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">PENDIENTE</span>}
                </div>
              </div>
              {newInvoice.concepto && <p className="text-[11px] text-gray-400">{newInvoice.concepto}</p>}
              <div className="flex justify-between items-baseline pt-0.5">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Total</span>
                <span className="text-xl font-black text-gray-900 font-mono">{fmtEur(newInvoice.total)}</span>
              </div>
            </div>
          )}

          {/* Resumen materiales a facturar */}
          {!isMantCovered && materialesNormales.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {newInvoice ? 'Detalle facturado' : 'Resumen a facturar'}
              </p>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                {materialesNormales.map((m, i) => (
                  <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < materialesNormales.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm text-gray-900 truncate">{m.descripcion}</p>
                      <p className="text-[10px] text-gray-400">{m.precioBase.toFixed(2)} € × {m.cantidad}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 font-mono">{fmtEur(m.precioBase * m.cantidad)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400"><span>Subtotal</span><span className="font-mono">{fmtEur(subtotalFact)}</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>IVA 21%</span><span className="font-mono">{fmtEur(ivaFact)}</span></div>
                  <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span className="font-mono">{fmtEur(totalFact)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Resumen partidas del presupuesto (cuando no hay materiales del parte) */}
          {!isMantCovered && showQuoteItems && !newInvoice && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Partidas del presupuesto</p>
                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Desde presupuesto</span>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                {quotedItems.map((item, i) => (
                  <div key={item.id} className={`flex items-center justify-between px-4 py-3 ${i < quotedItems.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm text-gray-900 truncate">{item.descripcion}</p>
                      <p className="text-[10px] text-gray-400">{item.precio_unitario.toFixed(2)} € × {item.cantidad} · <span className="capitalize">{item.tipo === 'mano_de_obra' ? 'M. de obra' : 'Material'}</span></p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 font-mono">{fmtEur(item.cantidad * item.precio_unitario)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400"><span>Subtotal</span><span className="font-mono">{fmtEur(subtotalQuoted)}</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>IVA 21%</span><span className="font-mono">{fmtEur(ivaQuoted)}</span></div>
                  <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span className="font-mono">{fmtEur(totalQuoted)}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          {notas && <div className="bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notas</p>
            <p className="text-sm text-gray-600 leading-relaxed">{notas}</p>
          </div>}

          {/* Firma guardada */}
          {phase === 'done' && savedFirmaUrl && (
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Firma del cliente</p>
              <img src={savedFirmaUrl} alt="Firma" className="w-full max-h-24 object-contain rounded-xl border border-gray-100 bg-gray-50" />
            </div>
          )}

          {/* Envío */}
          {phase === 'done' && (waUrl || mailUrl) && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Enviar al cliente</p>
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

          {/* Pedir valoración */}
          {phase === 'done' && clienteTelefono && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Encuesta de satisfacción</p>
              <button
                onClick={handlePedirValoracion}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-amber-700 bg-amber-50 border border-amber-200 active:bg-amber-100 cursor-pointer">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />Pedir valoración por WhatsApp
              </button>
            </div>
          )}
          <div className="h-4" />
        </div>

        <div className="px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50">
          {phase === 'facturar' && materialesNormales.length > 0 && (
            <button onClick={() => handleGenerarFactura(materialesNormales)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 active:bg-blue-700 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
              style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}>
              <FileText className="w-4 h-4" />Generar y registrar factura
            </button>
          )}
          {phase === 'facturar' && materialesNormales.length === 0 && showQuoteItems && (
            <div className="space-y-2.5">
              <button onClick={() => handleGenerarFactura([])}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 active:bg-blue-700 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
                style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}>
                <FileText className="w-4 h-4" />Facturar partidas del presupuesto
              </button>
              <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100 active:bg-gray-200 cursor-pointer">
                Cerrar sin facturar
              </button>
            </div>
          )}
          {phase === 'facturar' && showManualForm && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">¿Qué se cobra?</p>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Concepto * (ej: Revisión cuadro eléctrico y cambio automático)"
                  value={manualConcepto}
                  onChange={e => setManualConcepto(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    placeholder="Importe sin IVA *"
                    value={manualImporte}
                    onChange={e => setManualImporte(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-gray-500 shrink-0">€ + IVA</span>
                </div>
                {manualImporteNum > 0 && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 flex justify-between text-xs text-gray-500">
                    <span>Total con IVA 21%</span>
                    <span className="font-bold text-gray-900">{fmtEur(manualImporteNum * 1.21)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleGenerarFacturaManual}
                disabled={!manualValid}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
                style={{ boxShadow: manualValid ? '0 4px 24px rgba(37,99,235,0.4)' : 'none' }}>
                <FileText className="w-4 h-4" />Crear factura
              </button>
              <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100 active:bg-gray-200 cursor-pointer">
                Cerrar sin facturar
              </button>
            </div>
          )}
          {phase === 'generating' && (
            <div className="w-full flex items-center justify-center gap-3 py-4 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" /><span className="text-sm font-semibold">Generando factura…</span>
            </div>
          )}
          {phase === 'done' && newInvoice && invoicePaid === null && (
            <div className="space-y-2.5">
              <p className="text-[10px] text-center text-gray-400 leading-relaxed">
                ¿Cómo se cobra?
              </p>
              {/* Método selector when paying now */}
              <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5 mb-1">
                {(['efectivo','bizum','tarjeta'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMetodoPago(m)}
                    className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors cursor-pointer capitalize ${metodoPago === m ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-700'}`}
                  >{m}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => handleCobrado(metodoPago)}
                  className="flex flex-col items-center justify-center gap-0.5 bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm py-3.5 rounded-2xl cursor-pointer"
                  style={{ boxShadow: '0 4px 20px rgba(5,150,105,0.3)' }}>
                  <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" />Cobrado</span>
                  <span className="text-[10px] opacity-70 font-normal capitalize">{metodoPago}</span>
                </button>
                <button onClick={() => handlePendiente()}
                  className="flex flex-col items-center justify-center gap-0.5 bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-sm py-3.5 rounded-2xl cursor-pointer">
                  <span>Pendiente</span>
                  <span className="text-[10px] opacity-60 font-normal">transferencia / banco</span>
                </button>
              </div>
            </div>
          )}
          {phase === 'done' && (!newInvoice || invoicePaid !== null) && (
            <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-gray-600 bg-gray-100 active:bg-gray-200 cursor-pointer">
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
    ? { label: 'Material olvidado', color: 'text-amber-600' }
    : mode === 'view' && isCompleted
    ? { label: 'Parte completado', color: 'text-emerald-600' }
    : { label: 'Parte de trabajo', color: 'text-blue-600' };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${headerTag.color}`}>{headerTag.label}</p>
          <h2 className="text-base font-black text-gray-900 leading-tight truncate">{job.titulo}</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 text-gray-500 shrink-0 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">

        {/* Job info */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 space-y-2">
          {clienteNombre && <div className="flex items-center gap-2.5 text-sm text-gray-600"><User className="w-4 h-4 text-gray-400 shrink-0" /><span className="font-semibold">{clienteNombre}</span></div>}
          {(job.direccion || job.localidad) && <div className="flex items-center gap-2.5 text-sm text-gray-400"><MapPin className="w-4 h-4 text-gray-400 shrink-0" /><span>{[job.direccion, job.localidad].filter(Boolean).join(', ')}</span></div>}
          {job.hora_inicio && <div className="flex items-center gap-2.5 text-sm text-gray-400">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{job.hora_inicio}{job.hora_fin ? ` → ${job.hora_fin}` : ''}</span>
          </div>}
        </div>

        {/* Banner mantenimiento */}
        {mantenimiento?.activo && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
            <Wrench className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-700">Trabajo de mantenimiento</p>
              <p className="text-[11px] text-blue-600/70 mt-0.5">
                {mantenimiento.materialesIncluidos ? 'Materiales incluidos en el contrato.' : 'Los materiales se facturarán al cliente.'}
              </p>
            </div>
          </div>
        )}

        {/* Facturas existentes */}
        {existingInvoices.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Facturación de este trabajo</p>
            {existingInvoices.map(inv => (
              <div key={inv.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ReceiptText className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">{inv.numero}</span>
                      <StatusBadge inv={inv} />
                    </div>
                    {inv.concepto && <p className="text-[10px] text-gray-400 truncate">{inv.concepto}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 font-mono">{fmtEur(inv.total)}</p>
                  <p className="text-[10px] text-gray-400">{inv.estado}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Locked notice for supplement mode */}
        {mode === 'supplement' && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700">Parte cerrado y facturado</p>
              <p className="text-[11px] text-amber-600/70 mt-0.5">
                Añade el material que faltó. Se generará una factura suplementaria con referencia al trabajo original.
              </p>
            </div>
          </div>
        )}

        {/* IA Voice — solo en edit y supplement */}
        {(mode === 'edit' || mode === 'supplement') && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isTecnico ? 'Nota de campo por voz' : mode === 'supplement' ? 'Dictar material olvidado' : 'Dictar parte con IA'}
            </p>

            {recording === 'idle' && (
              <button onClick={startRecording}
                className="w-full flex items-center justify-center gap-3 bg-blue-600 active:bg-blue-700 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
                style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}>
                <Mic className="w-5 h-5" />
                {isTecnico ? 'Dictar nota de campo' : mode === 'supplement' ? 'Dictar material olvidado' : 'Dictar materiales y notas'}
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
              <div className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-600 font-semibold text-sm py-4 rounded-2xl">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span>Procesando con IA…</span>
              </div>
            )}
            {!isTecnico && transcripcion && recording === 'idle' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Transcripción</p>
                <p className="text-sm text-gray-600 leading-relaxed">{transcripcion}</p>
              </div>
            )}
          </div>
        )}

        {/* Campo de nota de campo — solo técnico en edit */}
        {isTecnico && mode === 'edit' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Nota para oficina</p>
            </div>
            {/* Tipo selector */}
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'presupuesto_requerido', label: 'Presupuesto' },
                { key: 'material_necesario', label: 'Material' },
                { key: 'incidencia', label: 'Incidencia' },
                { key: 'consulta', label: 'Consulta' },
                { key: 'otro', label: 'Otro' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFieldNoteTipo(key)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${fieldNoteTipo === key ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-400'}`}
                >{label}</button>
              ))}
            </div>
            <textarea
              rows={3}
              value={fieldNoteText}
              onChange={e => setFieldNoteText(e.target.value)}
              placeholder="Describe la incidencia, material necesario o presupuesto requerido…"
              className="w-full bg-gray-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 resize-none"
            />
            <button
              onClick={handleSaveFieldNote}
              disabled={!fieldNoteText.trim() || savingFieldNote}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 active:bg-amber-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl cursor-pointer"
            >
              {savingFieldNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {savingFieldNote ? 'Guardando…' : 'Enviar nota a oficina'}
            </button>
          </div>
        )}

        {/* Fotos — solo en edit y view */}
        {mode !== 'supplement' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fotos del trabajo</p>
              <span className="text-[10px] text-gray-400">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm group">
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
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 active:border-blue-500 cursor-pointer">
                  {uploading ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : <><Camera className="w-5 h-5 text-gray-400" /><span className="text-[9px] text-gray-400 font-semibold">Foto</span></>}
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
          </div>
        )}

        {/* Materiales (normales o post-cierre) */}
        {mode !== 'supplement' && !isTecnico && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Materiales</p>
              {materialesNormales.length > 0 && <span className="text-[10px] font-bold text-blue-600">{fmtEur(subtotalNormal)}</span>}
            </div>

            {/* Add from catalog (edit or view+maintenance+not invoiced) */}
            {(mode === 'edit' || (mode === 'view' && mantenimiento?.activo && existingInvoices.length === 0)) && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={materialSearch}
                    onChange={e => { setMaterialSearch(e.target.value); setShowMaterialPicker(true); }}
                    onFocus={() => setShowMaterialPicker(true)}
                    placeholder="Añadir material del catálogo…"
                    className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500" />
                </div>
                {showMaterialPicker && filteredTarifas.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {filteredTarifas.map((t, i) => (
                      <button key={t.id} onClick={() => addMaterial(t, mode === 'view')}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-100 cursor-pointer ${i < filteredTarifas.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.descripcion}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{t.codigo}</p>
                        </div>
                        <span className="text-sm font-bold text-blue-600 shrink-0">{t.precioBase.toFixed(0)} €</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Lista materiales normales */}
            {materialesNormales.length > 0 && (
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
                {materialesNormales.map((m, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < materialesNormales.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.descripcion}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {mode === 'edit' && editingPriceId === m.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingPriceVal}
                            onChange={e => setEditingPriceVal(e.target.value)}
                            onBlur={() => commitEditPrice(m.id)}
                            onKeyDown={e => e.key === 'Enter' && commitEditPrice(m.id)}
                            autoFocus
                            className="w-20 bg-white border border-blue-500 rounded px-2 py-0.5 text-xs text-gray-900"
                          />
                        ) : (
                          <button
                            onClick={mode === 'edit' ? () => startEditPrice(m) : undefined}
                            className={`text-[10px] ${mode === 'edit' ? 'text-blue-600 underline decoration-dotted cursor-pointer' : 'text-gray-400'}`}
                          >
                            {m.precioBase.toFixed(2)} €
                          </button>
                        )}
                        <span className="text-[10px] text-gray-400">× {m.cantidad} = </span>
                        <span className="text-[10px] text-blue-600 font-bold">{fmtEur(m.precioBase * m.cantidad)}</span>
                      </div>
                    </div>
                    {mode === 'edit' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => changeCantidad(m.id, false, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3 text-gray-600" /></button>
                        <span className="text-sm font-bold text-gray-900 w-5 text-center">{m.cantidad}</span>
                        <button onClick={() => changeCantidad(m.id, false, 1)} className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3 text-white" /></button>
                      </div>
                    )}
                    {mode === 'view' && <span className="text-sm font-bold text-gray-900 shrink-0 font-mono">{fmtEur(m.precioBase * m.cantidad)}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Añadir línea personalizada (mano de obra, desplazamiento…) */}
            {mode === 'edit' && (
              showCustomLine ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2.5">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Línea personalizada</p>
                  <input
                    placeholder="Descripción (mano de obra, desplazamiento…)"
                    value={customLineDesc}
                    onChange={e => setCustomLineDesc(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Precio unit. (€)"
                      value={customLinePrice}
                      onChange={e => setCustomLinePrice(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Cant."
                      value={customLineCant}
                      onChange={e => setCustomLineCant(e.target.value)}
                      className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addCustomLine}
                      disabled={!customLineDesc.trim() || !customLinePrice}
                      className="flex-1 bg-blue-600 active:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm py-2.5 rounded-xl cursor-pointer"
                    >
                      Añadir
                    </button>
                    <button
                      onClick={() => setShowCustomLine(false)}
                      className="px-5 bg-gray-100 active:bg-gray-200 text-gray-600 font-bold text-sm py-2.5 rounded-xl cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomLine(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 active:border-blue-500 text-gray-400 active:text-blue-600 text-sm font-semibold py-3 rounded-xl cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Mano de obra / línea personalizada
                </button>
              )
            )}

            {/* Materiales post-cierre (mantenimiento) */}
            {materialesPostCierre.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Añadidos tras el cierre</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                  {materialesPostCierre.map((m, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < materialesPostCierre.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.descripcion}</p>
                        <p className="text-[10px] text-gray-400">{m.precioBase.toFixed(0)} € × {m.cantidad}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => changeCantidad(m.id, true, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3 text-gray-600" /></button>
                        <span className="text-sm font-bold text-gray-900 w-5 text-center">{m.cantidad}</span>
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
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Material a facturar</p>
              {supplementMateriales.length > 0 && <span className="text-[10px] font-bold text-amber-600">{fmtEur(totalSupp)}</span>}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={materialSearch}
                onChange={e => { setMaterialSearch(e.target.value); setShowMaterialPicker(true); }}
                onFocus={() => setShowMaterialPicker(true)}
                placeholder="Buscar material olvidado…"
                className="w-full bg-gray-50 border border-amber-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500" />
            </div>
            {showMaterialPicker && filteredTarifas.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {filteredTarifas.map((t, i) => (
                  <button key={t.id} onClick={() => addMaterial(t, false)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-100 cursor-pointer ${i < filteredTarifas.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.descripcion}</p>
                    <span className="text-sm font-bold text-amber-600 shrink-0">{t.precioBase.toFixed(0)} €</span>
                  </button>
                ))}
              </div>
            )}
            {supplementMateriales.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                {supplementMateriales.map((m, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < supplementMateriales.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.descripcion}</p>
                      <p className="text-[10px] text-gray-400">{m.precioBase.toFixed(0)} € × {m.cantidad} = <span className="text-amber-600 font-bold">{fmtEur(m.precioBase * m.cantidad)}</span></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => changeCantidad(m.id, false, -1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer"><Minus className="w-3 h-3 text-gray-600" /></button>
                      <span className="text-sm font-bold text-gray-900 w-5 text-center">{m.cantidad}</span>
                      <button onClick={() => changeCantidad(m.id, false, 1)} className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center cursor-pointer"><Plus className="w-3 h-3 text-white" /></button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-200 px-4 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-400"><span>Subtotal</span><span className="font-mono">{fmtEur(subtotalSupp)}</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>IVA 21%</span><span className="font-mono">{fmtEur(ivaSupp)}</span></div>
                  <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span className="font-mono">{fmtEur(totalSupp)}</span></div>
                </div>
              </div>
            )}
            {/* Motivo del olvido */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Motivo (opcional)</p>
              <input value={supplementReason} onChange={e => setSupplementReason(e.target.value)}
                placeholder="Ej: No se incluyó en el presupuesto inicial"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        )}

        {/* Notas — solo en edit y view */}
        {mode !== 'supplement' && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notas del trabajo</p>
            {mode === 'edit' ? (
              <textarea rows={3} value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="La IA completará esto al dictar…"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none" />
            ) : (
              notas ? <div className="bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-3"><p className="text-sm text-gray-600 leading-relaxed">{notas}</p></div>
                    : <p className="text-xs text-gray-400">Sin notas registradas</p>
            )}
          </div>
        )}

        {/* Aviso facturación en edit mode */}
        {mode === 'edit' && !isTecnico && !mantenimiento?.activo && materialesNormales.length > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700/80">Al completar se generará una factura por <span className="font-bold">{fmtEur((subtotalNormal) * 1.21)}</span></p>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 shrink-0 bg-gray-50">
        {canComplete && phase !== 'completing' && (
          <button onClick={handleComplete} disabled={recording !== 'idle'}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(16,185,129,0.35)' }}>
            <CheckCircle className="w-4 h-4" />Completar trabajo
          </button>
        )}
        {phase === 'completing' && (
          <div className="w-full flex items-center justify-center gap-3 py-4 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /><span className="text-sm font-semibold">Guardando…</span>
          </div>
        )}
        {mode === 'view' && !canComplete && (
          <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-gray-600 bg-gray-100 active:bg-gray-200 cursor-pointer">
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
