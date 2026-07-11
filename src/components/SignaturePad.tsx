import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface SignaturePadProps {
  onDataUrl: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  className?: string;
}

export default function SignaturePad({ onDataUrl, height = 180, className = '' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1C2535';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const pos = getPos('touches' in e ? e.touches[0] : e as MouseEvent, canvas);
    lastPos.current = pos;
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos('touches' in e ? e.touches[0] : e as MouseEvent, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPos.current = pos;
    if (isEmpty) {
      setIsEmpty(false);
      onDataUrl(canvas.toDataURL('image/png'));
    }
  }, [isEmpty, onDataUrl]);

  const stopDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas && !isEmpty) onDataUrl(canvas.toDataURL('image/png'));
  }, [isEmpty, onDataUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDraw, { passive: false });
    canvas.addEventListener('mousemove', draw, { passive: false });
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onDataUrl(null);
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={800}
        height={height * (800 / 340)}
        style={{ width: '100%', height: `${height}px`, touchAction: 'none' }}
        className="border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-crosshair"
      />
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-gray-300 font-medium">Firmar aquí</p>
        </div>
      )}
      {!isEmpty && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <p className="text-[9px] text-center text-gray-400 mt-1">
        {isEmpty ? 'Usa el dedo o el ratón para firmar' : 'Firma registrada · Pulsa la papelera para borrar'}
      </p>
    </div>
  );
}
