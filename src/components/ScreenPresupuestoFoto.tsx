import { useState, useRef } from 'react';
import {
  Camera, Mic, MicOff, X,
  Loader2, CheckCircle, Sparkles, ImageIcon, AlertCircle, Send, ChevronLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PartidaResult {
  descripcion: string;
  cantidad: number;
  unidad: string;
  categoria: string;
}

interface ApiResult {
  transcripcion: string;
  analisis: string;
  resumen: string;
  partidas: PartidaResult[];
  visualizacionUrl: string | null;
  visualizacionB64: string | null;
  visualizacionError: string | null;
}

interface QuoteConfirm {
  descripcion: string;
  partidas: { descripcion: string; cantidad: number; unidad: string; tipo: 'material' | 'mano_de_obra'; precioUnitario: number; total: number }[];
}

export interface ScreenPresupuestoFotoProps {
  onConfirm: (q: QuoteConfirm) => void;
  onClose: () => void;
  isLiveMode: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type Phase = 'photo' | 'voice' | 'processing' | 'result';

// Comprime la imagen a max 1024px y calidad 0.85 para no superar límites de la edge function
async function compressImage(file: File, maxPx = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]); // devuelve solo el base64
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ScreenPresupuestoFoto({ onConfirm, onClose, isLiveMode, showToast }: ScreenPresupuestoFotoProps) {
  const [phase, setPhase]           = useState<Phase>('photo');
  const [photoFile, setPhotoFile]   = useState<File | null>(null);
  const [photoUrl, setPhotoUrl]     = useState<string | null>(null);
  const [photoB64, setPhotoB64]     = useState<string | null>(null);
  const [recording, setRecording]   = useState(false);
  const [audioBlob, setAudioBlob]   = useState<Blob | null>(null);
  const [audioMime, setAudioMime]   = useState<string>('audio/webm');
  const [textInput, setTextInput]   = useState('');
  const [result, setResult]         = useState<ApiResult | null>(null);
  const [processingStep, setProcessingStep] = useState('');

  const mediaRef    = useRef<MediaRecorder | null>(null);
  const cameraRef   = useRef<HTMLInputElement | null>(null); // con capture — móvil cámara
  const galleryRef  = useRef<HTMLInputElement | null>(null); // sin capture — galería y PC
  const chunksRef   = useRef<Blob[]>([]);

  // ── Selección de foto ──────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input value para poder seleccionar la misma foto otra vez
    e.target.value = '';

    const previewUrl = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoUrl(previewUrl);

    try {
      // Comprimir antes de guardar: fotos de móvil pueden ser >5MB
      const b64 = await compressImage(file);
      setPhotoB64(b64);
      setPhase('voice');
    } catch {
      showToast('Error al procesar la imagen', 'error');
    }
  }

  // ── Grabación de voz ──────────────────────────────────────────────────────
  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm')             ? 'audio/webm'             :
        MediaRecorder.isTypeSupported('audio/mp4')              ? 'audio/mp4'              : '';
      setAudioMime(mime || 'audio/webm');
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        setAudioBlob(blob);
        setRecording(false);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      showToast('No se pudo acceder al micrófono', 'error');
    }
  }

  // ── Envío a edge function ──────────────────────────────────────────────────
  async function handleSubmit(blobArg?: Blob) {
    if (!photoB64) return;
    const blobToUse = blobArg ?? audioBlob;
    if (!blobToUse && !textInput.trim()) {
      showToast('Graba tu voz o escribe lo que quieres cambiar', 'error');
      return;
    }

    setPhase('processing');
    setResult(null);

    try {
      let audioB64: string | undefined;
      let usedMime = audioMime;

      if (blobToUse) {
        const buf   = await blobToUse.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        audioB64 = btoa(bin);
        usedMime = blobToUse.type || audioMime;
      }

      setProcessingStep('Analizando foto con IA...');
      await new Promise(r => setTimeout(r, 200));
      setProcessingStep('Generando presupuesto...');

      const { data, error } = await supabase.functions.invoke('trade-presupuesto-foto', {
        body: {
          photo: photoB64,
          mimeType: 'image/jpeg', // siempre jpeg tras comprimir
          ...(audioB64 ? { audio: audioB64, audioMimeType: usedMime } : {}),
          ...(textInput.trim() ? { text: textInput.trim() } : {}),
        },
      });

      if (error) throw new Error(String(error.message ?? error));

      setProcessingStep('Creando visualización...');
      await new Promise(r => setTimeout(r, 300));

      setResult(data as ApiResult);
      setPhase('result');
    } catch {
      showToast('Error al procesar. Comprueba tu conexión e inténtalo de nuevo.', 'error');
      setPhase('voice');
    }
  }

  // Para cuando acaba de grabar: auto-submit
  function stopAndSubmit() {
    if (!recording || !mediaRef.current) return;
    const mr = mediaRef.current;
    const originalOnStop = mr.onstop;
    mr.onstop = async (e) => {
      if (originalOnStop) (originalOnStop as EventListener)(e);
      await new Promise(r => setTimeout(r, 120));
      const blob = new Blob(chunksRef.current, { type: audioMime });
      handleSubmit(blob);
    };
    mr.stop();
  }

  function handleConfirm() {
    if (!result) return;
    onConfirm({
      descripcion: result.resumen,
      partidas: result.partidas.map(p => ({
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        unidad: p.unidad,
        tipo: (p.categoria === 'Mano de obra' ? 'mano_de_obra' : 'material') as 'material' | 'mano_de_obra',
        precioUnitario: 0,
        total: 0,
      })),
    });
  }

  function vizSrc(): string | null {
    if (!result) return null;
    if (result.visualizacionB64) return `data:image/png;base64,${result.visualizacionB64}`;
    return result.visualizacionUrl ?? null;
  }

  function resetAll() {
    setPhase('photo');
    setPhotoUrl(null);
    setPhotoFile(null);
    setPhotoB64(null);
    setAudioBlob(null);
    setResult(null);
    setTextInput('');
    setProcessingStep('');
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#0B0F14] z-[60] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-slate-400 text-sm cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">Presupuesto con Foto</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 py-3 border-b border-white/8 shrink-0">
        {(['photo', 'voice', 'processing', 'result'] as Phase[]).map((p, i) => (
          <div key={p} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full transition-all ${
              phase === p
                ? 'bg-violet-400 scale-125'
                : (['photo', 'voice', 'processing', 'result'].indexOf(phase) > i)
                  ? 'bg-violet-600'
                  : 'bg-white/10'
            }`} />
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* ── FASE: FOTO ── */}
        {phase === 'photo' && (
          <div className="flex flex-col items-center justify-center h-full px-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-3xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Foto del espacio</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Sube una foto del baño, cocina, habitación o espacio que quieres reformar
              </p>
            </div>

            {/* Input con capture: solo abre cámara en móvil */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {/* Input sin capture: abre galería/explorador en cualquier dispositivo */}
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Botón cámara (móvil) */}
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-sm cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              Hacer foto con la cámara
            </button>

            {/* Botón galería (móvil y PC) */}
            <button
              onClick={() => galleryRef.current?.click()}
              className="w-full bg-white/5 border border-white/10 text-slate-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-3 text-sm cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              Subir desde galería / ordenador
            </button>

            <p className="text-[10px] text-slate-600 text-center">
              La foto se comprime automáticamente antes de enviar
            </p>
          </div>
        )}

        {/* ── FASE: VOZ / TEXTO ── */}
        {phase === 'voice' && (
          <div className="flex flex-col h-full">
            {/* Preview foto */}
            {photoUrl && (
              <div className="relative h-44 shrink-0 overflow-hidden">
                <img src={photoUrl} alt="Espacio actual" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0B0F14]" />
                <button
                  onClick={resetAll}
                  className="absolute top-3 left-3 bg-black/60 rounded-full p-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-2 left-4">
                  <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Foto actual</span>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-5 py-6">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-bold text-white">¿Qué quieres cambiar?</h2>
                <p className="text-slate-400 text-sm">Pulsa el micrófono y describe la reforma, o escribe abajo</p>
              </div>

              {/* Botón micrófono */}
              <button
                onClick={recording ? stopAndSubmit : toggleRecording}
                className={`w-24 h-24 rounded-full flex items-center justify-center cursor-pointer transition-all select-none ${
                  recording
                    ? 'bg-red-500 shadow-[0_0_0_12px_rgba(239,68,68,0.2)] scale-110'
                    : 'bg-violet-600 shadow-[0_4px_32px_rgba(124,58,237,0.5)]'
                }`}
              >
                {recording ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
              </button>

              {recording ? (
                <p className="text-red-400 text-sm font-bold animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  Grabando… pulsa para parar y analizar
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 text-center">Toca el micrófono para hablar</p>
              )}

              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-slate-500 font-mono">o escribe</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="w-full space-y-2">
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder='Ej: "Reformar cocina estilo nórdico, muebles blancos y azulejos grises"'
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                />
                {textInput.trim() && (
                  <button
                    onClick={() => handleSubmit()}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    Analizar con IA
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FASE: PROCESANDO ── */}
        {phase === 'processing' && (
          <div className="flex flex-col items-center justify-center h-full px-6 space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-white">TradeFlow AI trabajando…</h2>
              <p className="text-violet-400 text-sm font-medium">{processingStep}</p>
            </div>
            <div className="space-y-2 w-full max-w-sm">
              {['Analizando foto con IA...', 'Generando presupuesto...', 'Creando visualización...'].map((step, i) => (
                <div key={step} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${processingStep === step ? 'bg-violet-600/20 border border-violet-500/30' : 'opacity-30'}`}>
                  {processingStep === step
                    ? <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                  }
                  <span className="text-xs text-slate-300">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FASE: RESULTADO ── */}
        {phase === 'result' && result && (
          <div className="space-y-4 px-4 py-4 pb-32">

            {/* Antes / Después — lado a lado */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Visualización IA</h3>
                <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Generado con IA
                </span>
              </div>

              {/* Grid lado a lado */}
              <div className="grid grid-cols-2 gap-2">
                {/* Antes */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square">
                  {photoUrl ? (
                    <>
                      <img src={photoUrl} alt="Estado actual" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent py-2 px-2">
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Antes</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Después */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square">
                  {vizSrc() ? (
                    <>
                      <img src={vizSrc()!} alt="Visualización IA" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-violet-900/80 to-transparent py-2 px-2">
                        <span className="text-[9px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Después
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <p className="text-[9px] text-slate-400 text-center leading-snug font-semibold">
                        Visualización no disponible
                      </p>
                      {result?.visualizacionError && (
                        <p className="text-[8px] text-slate-600 text-center leading-snug break-all">
                          {result.visualizacionError.slice(0, 80)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Descripción ampliada — ver la imagen grande */}
              {vizSrc() && (
                <p className="text-[9px] text-slate-500 text-center">
                  Ejemplo orientativo generado por IA · El resultado real puede variar
                </p>
              )}
            </div>

            {/* Análisis */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Lo que se ve:</p>
              <p className="text-xs text-slate-300 leading-relaxed">{result.analisis}</p>
            </div>

            {/* Solicitud */}
            {result.transcripcion && result.transcripcion !== 'Reformar y mejorar este espacio' && (
              <div className="bg-violet-950/40 border border-violet-800/40 rounded-2xl px-4 py-3">
                <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest mb-1">Tu solicitud:</p>
                <p className="text-xs text-violet-200 leading-relaxed">"{result.transcripcion}"</p>
              </div>
            )}

            {/* Partidas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Partidas del presupuesto</h3>
                <span className="text-[9px] text-slate-500 font-mono">{result.partidas.length} líneas</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {result.partidas.map((p, i) => (
                  <div key={i} className={`px-4 py-3 flex items-center justify-between gap-3 ${i < result.partidas.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white font-medium truncate">{p.descripcion}</p>
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                        p.categoria === 'Mano de obra'    ? 'bg-blue-500/10 text-blue-400'    :
                        p.categoria === 'Desmontaje'      ? 'bg-orange-500/10 text-orange-400' :
                        p.categoria === 'Gestión residuos'? 'bg-slate-500/10 text-slate-400'   :
                                                            'bg-emerald-500/10 text-emerald-400'
                      }`}>{p.categoria}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-slate-300">{p.cantidad} {p.unidad}</p>
                      <p className="text-[9px] text-amber-400 font-bold">Sin precio</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-500 text-center">Confirma para asignar precios en el siguiente paso</p>
            </div>

            {/* Volver a hacer otra foto */}
            <button
              onClick={resetAll}
              className="w-full py-3 rounded-2xl text-xs font-bold text-slate-400 border border-slate-800 cursor-pointer"
            >
              Hacer otra foto
            </button>
          </div>
        )}
      </div>

      {/* Footer CTA (solo en resultado) */}
      {phase === 'result' && result && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={handleConfirm}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(124,58,237,0.5)' }}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar y asignar precios
          </button>
        </div>
      )}
    </div>
  );
}
