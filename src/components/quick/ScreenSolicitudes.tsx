// Solicitudes de presupuesto recibidas desde «Mi página online».
import React, { useEffect, useState } from 'react';
import { ChevronLeft, Phone, Search, Globe, XCircle, ArrowRight, Sparkles, SlidersHorizontal, ExternalLink } from 'lucide-react';
import {
  loadPageRequests, updatePageRequestState, loadOwnPublicPage, waNumber, ESTADO_SOLICITUD_LABEL,
} from '../../lib/publicPages';
import type { PageRequest, EstadoSolicitud, PublicPage } from '../../lib/publicPages';

interface Props {
  orgId: string | null;
  isLiveMode: boolean;
  empresaNombre: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack: () => void;
  onConfigure: () => void;
  /** Abre el asistente de presupuesto con los datos de la solicitud */
  onConvert: (req: PageRequest, mode: 'ia' | 'vacio') => void;
  onNewCountChange?: (n: number) => void;
}

type Filtro = 'todos' | EstadoSolicitud;

const BADGE: Record<EstadoSolicitud, string> = {
  nuevo: 'bg-blue-50 text-blue-700',
  contactado: 'bg-amber-50 text-amber-700',
  convertido: 'bg-emerald-50 text-emerald-700',
  rechazado: 'bg-gray-100 text-gray-500',
};

function hace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export default function ScreenSolicitudes({ orgId, isLiveMode, empresaNombre, showToast, onBack, onConfigure, onConvert, onNewCountChange }: Props) {
  const [items, setItems] = useState<PageRequest[] | null>(null);
  const [page, setPage] = useState<PublicPage | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<PageRequest | null>(null);
  const [askConvert, setAskConvert] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!orgId || !isLiveMode) { setItems([]); return; }
    Promise.all([loadPageRequests(orgId), loadOwnPublicPage(orgId)])
      .then(([r, p]) => { if (!alive) return; setItems(r); setPage(p); })
      .catch(() => { if (alive) { setItems([]); showToast('No se pudieron cargar las solicitudes', 'error'); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isLiveMode]);

  useEffect(() => {
    if (items) onNewCountChange?.(items.filter(i => i.estado === 'nuevo').length);
  }, [items, onNewCountChange]);

  const setEstado = async (r: PageRequest, estado: EstadoSolicitud) => {
    setItems(prev => prev?.map(x => x.id === r.id ? { ...x, estado } : x) ?? prev);
    setOpen(o => o && o.id === r.id ? { ...o, estado } : o);
    if (isLiveMode) {
      try { await updatePageRequestState(r.id, estado); } catch { showToast('No se pudo actualizar la solicitud', 'error'); }
    }
  };

  const url = page ? `${window.location.origin}/pro/${page.slug}` : '';

  // ── Detalle ──
  if (open) {
    const wa = `https://wa.me/${waNumber(open.telefono)}?text=${encodeURIComponent(`Hola ${open.nombre}, soy ${empresaNombre}. He recibido tu solicitud de presupuesto.`)}`;
    return (
      <div className="space-y-4 pb-28" data-testid="solicitud-detalle">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
          <button type="button" onClick={() => setOpen(null)} aria-label="Volver" className="p-1 cursor-pointer"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{open.nombre}</h2>
            <span className="text-sm text-gray-500">{hace(open.created_at)}</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${BADGE[open.estado]}`}>{ESTADO_SOLICITUD_LABEL[open.estado]}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">Contacto</span>
          <a href={`tel:${open.telefono}`} className="flex items-center gap-2 mt-2 text-lg font-semibold text-teal-800"><Phone className="w-5 h-5" /> {open.telefono}</a>
        </div>
        {(open.respuestas.length > 0 || open.mensaje) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
            <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">Respuestas</span>
            {open.respuestas.map((r, i) => (
              <div key={i}>
                <span className="block text-sm text-gray-500">{r.pregunta}</span>
                <span className="block text-base text-gray-900">{r.respuesta}</span>
              </div>
            ))}
            {open.mensaje && <p className="text-base text-gray-900">{open.mensaje}</p>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${open.telefono}`} onClick={() => { if (open.estado === 'nuevo') setEstado(open, 'contactado'); }} className="flex items-center justify-center gap-2 bg-teal-800 text-white rounded-2xl py-4 text-base font-bold">
            <Phone className="w-5 h-5" /> Llamar
          </a>
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => { if (open.estado === 'nuevo') setEstado(open, 'contactado'); }} className="flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-2xl py-4 text-base font-bold">
            WhatsApp
          </a>
          {open.estado !== 'rechazado' && open.estado !== 'convertido' && (
            <button type="button" onClick={() => setEstado(open, 'rechazado')} className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-2xl py-3.5 text-base font-semibold cursor-pointer">
              <XCircle className="w-5 h-5" /> Rechazar
            </button>
          )}
          <button
            type="button"
            onClick={() => setAskConvert(true)}
            className={`flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-2xl py-3.5 text-base font-semibold cursor-pointer ${open.estado === 'rechazado' || open.estado === 'convertido' ? 'col-span-2' : ''}`}
          >
            <ArrowRight className="w-5 h-5" /> Convertir en presupuesto
          </button>
        </div>

        {askConvert && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setAskConvert(false)}>
            <div className="w-full bg-white rounded-t-3xl p-5 pb-8 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center"><span className="w-10 h-1 rounded-full bg-gray-300" /></div>
              <h3 className="text-lg font-bold">¿Generar partidas desde la solicitud?</h3>
              <p className="text-sm text-gray-500">La IA propone partidas con lo que ha contestado el cliente. Los precios los pones tú.</p>
              <button type="button" onClick={() => { const r = open; setAskConvert(false); setEstado(r, 'convertido'); onConvert(r, 'ia'); }} className="w-full flex items-center justify-center gap-2 bg-teal-800 text-white rounded-2xl py-4 text-base font-bold cursor-pointer">
                <Sparkles className="w-5 h-5" /> Generar partidas con IA
              </button>
              <button type="button" onClick={() => { const r = open; setAskConvert(false); setEstado(r, 'convertido'); onConvert(r, 'vacio'); }} className="w-full py-3 text-base font-semibold text-gray-600 cursor-pointer">
                Presupuesto vacío
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Lista ──
  const counts = (items ?? []).reduce<Record<string, number>>((a, r) => { a[r.estado] = (a[r.estado] ?? 0) + 1; return a; }, {});
  const needle = q.trim().toLowerCase();
  const visible = (items ?? []).filter(r => (filtro === 'todos' || r.estado === filtro) &&
    (!needle || r.nombre.toLowerCase().includes(needle) || r.telefono.includes(needle)));

  const filtros: { k: Filtro; label: string }[] = [
    { k: 'todos', label: 'Todos' },
    { k: 'nuevo', label: 'Nuevos' },
    { k: 'contactado', label: 'Contactados' },
    { k: 'convertido', label: 'Convertidos' },
    { k: 'rechazado', label: 'Rechazados' },
  ];

  return (
    <div className="space-y-4 pb-28" data-testid="screen-solicitudes">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Volver" className="p-2 -ml-2 cursor-pointer"><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="flex-1 text-2xl font-bold">Solicitudes</h1>
        <button type="button" onClick={onConfigure} className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold cursor-pointer">
          <SlidersHorizontal className="w-4 h-4" /> Mi página
        </button>
      </div>

      {page?.activa ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block font-bold">Tu página está activa</span>
            <span className="block text-sm text-gray-500 font-mono truncate">{url.replace(/^https?:\/\//, '')}</span>
          </span>
          <ExternalLink className="w-5 h-5 text-teal-800" />
        </a>
      ) : items !== null && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 flex items-center justify-center"><Globe className="w-7 h-7 text-teal-800" /></div>
          <h2 className="text-lg font-bold">Recibe solicitudes de nuevos clientes</h2>
          <p className="text-sm text-gray-500">Activa tu página online y los clientes podrán pedirte presupuesto directamente, sin llamadas.</p>
          <button type="button" onClick={onConfigure} className="w-full bg-teal-800 text-white rounded-2xl py-3.5 font-bold cursor-pointer">Configurar mi página</button>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre o móvil" className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-3 py-3 text-base focus:outline-none focus:border-teal-700" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} role="tablist">
        {filtros.map(f => (
          <button key={f.k} type="button" role="tab" aria-selected={filtro === f.k} onClick={() => setFiltro(f.k)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border cursor-pointer ${filtro === f.k ? 'bg-teal-800 text-white border-teal-800' : 'bg-white text-gray-600 border-gray-200'}`}>
            {f.label}{f.k !== 'todos' && counts[f.k] ? ` (${counts[f.k]})` : ''}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-center text-gray-400 py-8">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-gray-400 py-8">{items.length === 0 ? 'Todavía no ha llegado ninguna solicitud. Comparte el enlace de tu página por WhatsApp o en tus redes.' : 'Nada con este filtro'}</p>
      ) : (
        visible.map(r => (
          <button key={r.id} type="button" onClick={() => setOpen(r)} data-testid="solicitud-row" className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 space-y-1.5 cursor-pointer active:bg-gray-50">
            <div className="flex items-center gap-2">
              {r.estado === 'nuevo' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />}
              <span className="flex-1 font-bold text-lg truncate">{r.nombre}</span>
              <span className="text-sm text-gray-400 shrink-0">{hace(r.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-teal-800 font-semibold"><Phone className="w-4 h-4" /> {r.telefono}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BADGE[r.estado]}`}>{ESTADO_SOLICITUD_LABEL[r.estado]}</span>
            </div>
            {r.respuestas.length > 0 && (
              <p className="text-sm text-gray-600 line-clamp-2">{r.respuestas.map(x => `${x.pregunta}: ${x.respuesta}`).join(' · ')}</p>
            )}
          </button>
        ))
      )}
    </div>
  );
}
