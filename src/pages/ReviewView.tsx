import React, { useState, useEffect } from 'react';
import { CheckCircle, Star, Loader2, AlertCircle } from 'lucide-react';
import { getJobReviewInfo, submitJobReview } from '../lib/supabase';

type ReviewState = 'loading' | 'ready' | 'sending' | 'done' | 'already' | 'error';

interface JobInfo {
  job_titulo: string;
  org_nombre: string;
  org_logo_url: string | null;
  cliente_nombre: string | null;
  respondido: boolean;
}

function StarButton({ value, selected, hovered, onHover, onClick }: {
  value: number; selected: boolean; hovered: boolean;
  onHover: (v: number) => void; onClick: (v: number) => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(value)}
      onMouseLeave={() => onHover(0)}
      onTouchStart={() => onHover(value)}
      onClick={() => onClick(value)}
      className="p-1 cursor-pointer transition-transform active:scale-110"
      aria-label={`${value} estrellas`}
    >
      <Star
        className={`w-10 h-10 transition-colors ${selected || hovered ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
      />
    </button>
  );
}

const LABELS: Record<number, string> = {
  1: 'Muy mejorable',
  2: 'Regular',
  3: 'Bien',
  4: 'Muy bien',
  5: '¡Excelente!',
};

export default function ReviewView() {
  const token = window.location.pathname.split('/valorar/')[1]?.split('/')[0] ?? '';

  const [state, setState] = useState<ReviewState>('loading');
  const [info, setInfo] = useState<JobInfo | null>(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); return; }
    getJobReviewInfo(token)
      .then(data => {
        if (!data) { setState('error'); return; }
        setInfo(data);
        setState(data.respondido ? 'already' : 'ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  async function handleSubmit() {
    if (rating === 0) return;
    setState('sending');
    try {
      await submitJobReview(token, rating, comentario.trim() || undefined);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 font-semibold">Enlace no válido o caducado.</p>
        </div>
      </div>
    );
  }

  if (state === 'already') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-xs">
          {info?.org_logo_url && (
            <img src={info.org_logo_url} alt={info.org_nombre} className="h-12 mx-auto object-contain" />
          )}
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
          <div>
            <p className="text-xl font-black text-gray-900">¡Gracias por tu valoración!</p>
            <p className="text-sm text-gray-400 mt-1">Ya has respondido esta encuesta.</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-xs">
          {info?.org_logo_url && (
            <img src={info.org_logo_url} alt={info.org_nombre} className="h-12 mx-auto object-contain" />
          )}
          <div className="flex justify-center gap-0.5">
            {[1,2,3,4,5].map(v => (
              <Star key={v} className={`w-8 h-8 ${v <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
            ))}
          </div>
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
          <div>
            <p className="text-xl font-black text-gray-900">¡Muchas gracias!</p>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              Tu opinión nos ayuda a mejorar nuestro servicio.
            </p>
          </div>
          <p className="text-xs text-gray-400 font-semibold">{info?.org_nombre}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          {info?.org_logo_url && (
            <img src={info.org_logo_url} alt={info.org_nombre} className="h-12 mx-auto object-contain" />
          )}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{info?.org_nombre}</p>
            <h1 className="text-xl font-black text-gray-900 mt-1 leading-snug">
              ¿Quedaste satisfecho con el trabajo?
            </h1>
            {info?.job_titulo && (
              <p className="text-sm text-gray-500 mt-1">"{info.job_titulo}"</p>
            )}
            {info?.cliente_nombre && (
              <p className="text-xs text-gray-400 mt-0.5">{info.cliente_nombre}</p>
            )}
          </div>
        </div>

        {/* Stars */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-center gap-1">
            {[1,2,3,4,5].map(v => (
              <StarButton
                key={v}
                value={v}
                selected={v <= rating}
                hovered={v <= hovered}
                onHover={setHovered}
                onClick={v => { setRating(v); setHovered(0); }}
              />
            ))}
          </div>
          {(rating > 0 || hovered > 0) && (
            <p className="text-center text-sm font-bold text-amber-600">
              {LABELS[hovered || rating]}
            </p>
          )}

          {/* Comment */}
          <textarea
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            placeholder="¿Quieres añadir algún comentario? (opcional)"
            rows={3}
            maxLength={500}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400"
          />

          <button
            onClick={handleSubmit}
            disabled={rating === 0 || state === 'sending'}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-4 rounded-2xl transition-colors cursor-pointer"
            style={{ boxShadow: rating > 0 ? '0 4px 24px rgba(37,99,235,0.35)' : 'none' }}
          >
            {state === 'sending'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</>
              : <><CheckCircle className="w-4 h-4" />Enviar valoración</>
            }
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-300">
          Powered by <span className="font-bold">TRABFLOW</span>
        </p>
      </div>
    </div>
  );
}
