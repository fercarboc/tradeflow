import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserCheck, UserX, Bus, Search, AlertCircle, Lock } from 'lucide-react';
import { loadWorkers } from '../lib/supabase';
import { setWorkerConductor } from '../lib/transport';
import { useSession } from '../context/SessionContext';
import type { TradeWorker } from '../lib/supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

function initials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function ScreenTransporteConductores({ orgId, showToast }: Props) {
  const { rol } = useSession();
  // trade_workers write RLS solo permite al propietario (workers_owner_all)
  const canEdit = rol === 'owner';

  const [workers, setWorkers] = useState<TradeWorker[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch]     = useState('');

  // Ref estable para showToast — evita que useCallback de load cambie cada vez
  // que el padre re-renderiza al mostrar un toast (causa del flicker previo).
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadWorkers(orgId);
      setWorkers(data);
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId]); // showToast excluido: ref estable evita reload innecesario

  useEffect(() => { void load(); }, [load]);

  async function handleToggle(worker: TradeWorker) {
    if (!canEdit) return;
    const next = !worker.es_conductor;
    setToggling(worker.id);
    try {
      await setWorkerConductor(worker.id, orgId, next);
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, es_conductor: next } : w));
      showToast(
        next
          ? `${worker.nombre} marcado como conductor`
          : `${worker.nombre} ya no es conductor`,
        'success',
      );
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setToggling(null);
    }
  }

  const active = workers.filter(w => w.activo);
  const filtered = search.trim()
    ? active.filter(w =>
        w.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (w.email ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : active;

  const conductores = active.filter(w => w.es_conductor).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
            <User size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Conductores</h1>
            <p className="text-xs text-slate-500">
              {conductores} conductor{conductores !== 1 ? 'es' : ''} habilitado{conductores !== 1 ? 's' : ''} de {active.length} trabajador{active.length !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Aviso informativo */}
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Marcar un trabajador como conductor es solo informativo. TrabFlow no verifica
            habilitaciones CAP ni permisos de conducción. La validación de documentación
            es responsabilidad de la empresa.
          </p>
        </div>

        {/* Aviso solo lectura para no-owner */}
        {!canEdit && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Lock size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Solo el propietario de la organización puede habilitar o deshabilitar conductores.
              Estás en modo solo lectura.
            </p>
          </div>
        )}

        {/* Buscador */}
        {active.length > 5 && (
          <div className="mb-4 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-sm text-slate-400">
            Cargando trabajadores…
          </div>
        )}

        {!loading && active.length === 0 && (
          <div className="text-center py-20">
            <Bus size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No hay trabajadores activos</p>
            <p className="text-sm text-slate-400 mt-1">
              Añade trabajadores en la sección Equipo para habilitarlos como conductores.
            </p>
          </div>
        )}

        {!loading && active.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400">
            Ningún trabajador coincide con la búsqueda.
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {[...filtered].sort((a, b) => {
              const ac = a.es_conductor ? 1 : 0;
              const bc = b.es_conductor ? 1 : 0;
              return bc - ac || a.nombre.localeCompare(b.nombre);
            }).map(worker => {
              const isConductor = !!worker.es_conductor;
              const isToggling  = toggling === worker.id;
              return (
                <div
                  key={worker.id}
                  className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-4 transition-all ${
                    isConductor ? 'border-indigo-200' : 'border-slate-200'
                  }`}
                >
                  {/* Avatar con iniciales */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isConductor
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {initials(worker.nombre)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm truncate">
                        {worker.nombre}
                      </span>
                      {isConductor && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                          <Bus size={9} /> Conductor
                        </span>
                      )}
                    </div>
                    {worker.email && (
                      <p className="text-xs text-slate-400 truncate">{worker.email}</p>
                    )}
                    {worker.rol && (
                      <p className="text-xs text-slate-400 capitalize">{worker.rol}</p>
                    )}
                  </div>

                  {/* Toggle — solo visible para owner */}
                  {canEdit && (
                    <button
                      onClick={() => handleToggle(worker)}
                      disabled={isToggling}
                      title={isConductor ? 'Quitar habilitación de conductor' : 'Habilitar como conductor'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                        isToggling
                          ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400'
                          : isConductor
                          ? 'bg-indigo-50 text-indigo-700 hover:bg-red-50 hover:text-red-600 border border-indigo-200'
                          : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200'
                      }`}
                    >
                      {isToggling ? (
                        <span>…</span>
                      ) : isConductor ? (
                        <>
                          <UserX size={13} />
                          <span className="hidden sm:inline">Quitar</span>
                        </>
                      ) : (
                        <>
                          <UserCheck size={13} />
                          <span className="hidden sm:inline">Habilitar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
