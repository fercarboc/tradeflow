import React, { useState, useEffect } from 'react';
import { Star, Clock, MessageSquare, TrendingUp, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { loadJobReviews } from '../lib/supabase';
import type { TradeJobReview } from '../lib/supabase';
import { useSession } from '../context/SessionContext';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function Stars({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

export default function ScreenValoraciones({ showToast }: Props) {
  const { org } = useSession();
  const orgId = org?.id ?? null;
  const [reviews, setReviews] = useState<TradeJobReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'rated' | 'pending'>('all');

  async function load() {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await loadJobReviews(orgId);
      setReviews(data);
    } catch {
      showToast('Error al cargar valoraciones', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId]);

  const rated = reviews.filter(r => r.rating != null);
  const pending = reviews.filter(r => r.rating == null);
  const avg = rated.length > 0 ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : null;

  const dist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: rated.filter(r => r.rating === star).length,
    pct: rated.length > 0 ? (rated.filter(r => r.rating === star).length / rated.length) * 100 : 0,
  }));

  const visible = filter === 'rated' ? rated : filter === 'pending' ? pending : reviews;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-1">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-3xl font-black text-gray-900">{reviews.length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Enviadas</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-3xl font-black text-emerald-600">{rated.length}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Respondidas</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-3xl font-black text-amber-500">{avg != null ? avg.toFixed(1) : '—'}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Media ★</p>
        </div>
      </div>

      {/* Distribution */}
      {rated.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 text-center">
              <p className="text-4xl font-black text-gray-900 leading-none">{avg!.toFixed(1)}</p>
              <Stars value={Math.round(avg!)} size="sm" />
              <p className="text-[9px] text-gray-400 mt-1">{rated.length} opinión{rated.length !== 1 ? 'es' : ''}</p>
            </div>
            <div className="flex-1 space-y-1">
              {dist.map(d => (
                <div key={d.star} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-3 text-right">{d.star}</span>
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${d.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-4 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          {(['all', 'rated', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {f === 'all' ? `Todas (${reviews.length})` : f === 'rated' ? `Valoradas (${rated.length})` : `Pendientes (${pending.length})`}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 cursor-pointer transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          {reviews.length === 0 ? (
            <>
              <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">Sin valoraciones aún</p>
              <p className="text-xs text-gray-300 mt-1">Pide valoraciones al cerrar un trabajo para ver los resultados aquí.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-400">No hay registros en este filtro</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(r => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{r.job_titulo ?? 'Trabajo'}</p>
                  {r.cliente_nombre && (
                    <p className="text-xs text-gray-500 truncate">{r.cliente_nombre}</p>
                  )}
                </div>
                {r.rating != null ? (
                  <Stars value={r.rating} size="sm" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      Pendiente
                    </div>
                    {r.trade_jobs?.trade_clients?.telefono && (
                      <button
                        onClick={() => {
                          const phone = (r.trade_jobs?.trade_clients?.telefono ?? '').replace(/\D/g, '');
                          const url = `${window.location.origin}/valorar/${r.token}`;
                          const msg = encodeURIComponent(`Hola ${r.cliente_nombre ?? ''}, ¿puede valorar el trabajo "${r.job_titulo ?? ''}"?\n\nAcceda aquí: ${url}`);
                          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-1 rounded-lg whitespace-nowrap cursor-pointer transition-colors"
                        title="Re-enviar petición de valoración por WhatsApp"
                      >
                        <RotateCcw className="w-3 h-3" /> WA
                      </button>
                    )}
                  </div>
                )}
              </div>
              {r.comentario && (
                <div className="mt-2.5 flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-600 leading-relaxed">{r.comentario}</p>
                </div>
              )}
              <p className="text-[10px] text-gray-300 mt-2">
                {r.respondido_at
                  ? `Valorado ${new Date(r.respondido_at).toLocaleDateString('es-ES')}`
                  : `Enviado ${new Date(r.created_at).toLocaleDateString('es-ES')}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
