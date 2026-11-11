/**
 * Lector de QR para documentos de control recibidos.
 *  1. Cámara en directo (getUserMedia + jsQR; funciona en Android e iPhone).
 *  2. Si no hay cámara o no enfoca: foto del QR y se decodifica la imagen.
 *  3. Último recurso: pegar el enlace a mano.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ClipboardPaste, Loader2, ScanLine, X } from 'lucide-react';

interface Props {
  onResult: (text: string) => void;
  onCancel?: () => void;
}

function decodeCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return r?.data ?? null;
}

export async function decodeQrFromImage(file: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  // Probamos a varios tamaños: los QR pequeños en fotos grandes se leen mejor reducidos
  for (const side of [1200, 800, 1800]) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const t = decodeCanvas(c);
    if (t) return t;
  }
  return null;
}

export default function QrScanner({ onResult, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const [estado, setEstado] = useState<'iniciando' | 'escaneando' | 'sin_camara'>('iniciando');
  const [decodingPhoto, setDecodingPhoto] = useState(false);
  const [manual, setManual] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback((text: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    stop();
    try { navigator.vibrate?.(80); } catch { /* sin vibración */ }
    onResult(text);
  }, [onResult, stop]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setEstado('sin_camara'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        setEstado('escaneando');
        const tick = () => {
          if (!alive || doneRef.current) return;
          const c = canvasRef.current;
          if (c && v.readyState >= 2 && v.videoWidth) {
            const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
            c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
            c.getContext('2d', { willReadFrequently: true })!.drawImage(v, 0, 0, c.width, c.height);
            const t = decodeCanvas(c);
            if (t) { finish(t); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setEstado('sin_camara');
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf); stop(); };
  }, [finish, stop]);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setDecodingPhoto(true); setMsg(null);
    const t = await decodeQrFromImage(f);
    setDecodingPhoto(false);
    if (t) finish(t);
    else setMsg('No se encontró ningún QR en la foto. Acérquese más y que el QR salga nítido.');
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '3 / 4', maxHeight: '55vh' }}>
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {estado === 'escaneando' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            <ScanLine className="absolute text-white/80" size={40} />
          </div>
        )}
        {estado === 'iniciando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="animate-spin" /> <span className="text-sm">Abriendo la cámara…</span>
          </div>
        )}
        {estado === 'sin_camara' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white">
            <Camera size={32} />
            <span className="text-sm">No se puede abrir la cámara aquí. Haga una foto del QR o pegue el enlace.</span>
          </div>
        )}
        {onCancel && (
          <button type="button" onClick={() => { stop(); onCancel(); }} aria-label="Cerrar cámara"
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white"><X size={20} /></button>
        )}
      </div>
      {estado === 'escaneando' && <p className="text-center text-sm text-gray-600">Apunte al código QR del documento. Se lee solo.</p>}

      <button type="button" onClick={() => fileRef.current?.click()} disabled={decodingPhoto}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-white py-3 font-semibold text-amber-900 disabled:opacity-60">
        {decodingPhoto ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />} Hacer foto del QR
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />

      <div className="flex gap-2">
        <input className="min-w-0 flex-1 rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm" placeholder="O pegue aquí el enlace del documento"
          value={manual} onChange={e => setManual(e.target.value)} />
        <button type="button" disabled={!manual.trim()} onClick={() => finish(manual.trim())}
          className="flex items-center gap-1 rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white disabled:opacity-40">
          <ClipboardPaste size={16} /> Usar
        </button>
      </div>
      {msg && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{msg}</p>}
    </div>
  );
}
