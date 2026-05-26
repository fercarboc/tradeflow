import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, Clock, User, Navigation, CheckCircle, Play,
  LogOut, RefreshCw, AlertTriangle, Phone, ChevronDown, ChevronUp, X, Check,
} from 'lucide-react';
import { supabase, loadWorkerJobs, workerSetJobStatus } from '../lib/supabase';
import type { WorkerProfile, TradeJob } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../types';

interface Props {
  workerProfile: WorkerProfile | null;
  session: Session | null;
  setCurrentPage: (p: ActivePage) => void;
}

const ESTADO_DOT: Record<TradeJob['estado'], string> = {
  planificado:        'bg-blue-500',
  en_curso:           'bg-amber-500',
  completado:         'bg-emerald-500',
  cancelado:          'bg-red-500',
  pendiente_material: 'bg-orange-500',
};

const ESTADO_LABEL: Record<TradeJob['estado'], string> = {
  planificado:        'Planificado',
  en_curso:           'En curso',
  completado:         'Completado',
  cancelado:          'Cancelado',
  pendiente_material: 'Pdte. material',
};

function fmtDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function mapsUrl(job: TradeJob): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([job.direccion, job.localidad, job.cp].filter(Boolean).join(', '))}`;
}

export default function ScreenWorkerView({ workerProfile, session, setCurrentPage }: Props) {
  const [jobs, setJobs]           = useState<TradeJob[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completeModal, setCompleteModal] = useState<TradeJob | null>(null);
  const [closeNotes, setCloseNotes] = useState('');
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const reload = useCallback(async () => {
    if (!workerProfile) return;
    setLoading(true);
    try {
      const data = await loadWorkerJobs(workerProfile.id, workerProfile.org_id);
      setJobs(data);
    } catch (e: unknown) {
      showToast('Error cargando trabajos: ' + (e as Error).message, 'error');
    }
    setLoading(false);
  }, [workerProfile]);

  useEffect(() => { reload(); }, [reload]);

  const handleStatus = async (job: TradeJob, estado: TradeJob['estado']) => {
    if (!workerProfile) return;
    try {
      await workerSetJobStatus(job.id, workerProfile.id, estado);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, estado } : j));
      showToast(estado === 'en_curso' ? 'Trabajo iniciado ✓' : 'Estado actualizado ✓');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
  };

  const handleComplete = async () => {
    if (!completeModal || !workerProfile) return;
    setSaving(true);
    try {
      await workerSetJobStatus(completeModal.id, workerProfile.id, 'completado', closeNotes);
      setJobs(prev => prev.map(j => j.id === completeModal.id ? { ...j, estado: 'completado' } : j));
      showToast('Trabajo completado ✓');
      setCompleteModal(null);
      setCloseNotes('');
    } catch (e: unknown) {
      showToast('Error: ' + (e as Error).message, 'error');
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentPage(ActivePage.Home);
  };

  // Group jobs by date
  const grouped = jobs.reduce<Record<string, TradeJob[]>>((acc, job) => {
    const key = job.fecha_inicio ?? 'sin_fecha';
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();
  const today = new Date().toISOString().split('T')[0];
  const activeJobs = jobs.filter(j => j.estado !== 'completado' && j.fecha_inicio === today);

  if (!workerProfile || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-white font-bold">Sin perfil de trabajador</p>
          <p className="text-slate-400 text-sm mt-1">Contacta con tu empresa para configurar tu acceso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              {workerProfile.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">{workerProfile.nombre}</p>
              <p className="text-[9px] text-slate-400 font-mono uppercase">{workerProfile.rol}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeJobs.length > 0 && (
            <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {activeJobs.length} pendiente{activeJobs.length > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={reload} className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-white font-bold">¡Todo al día!</p>
            <p className="text-slate-400 text-sm mt-1">No tienes trabajos pendientes.</p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${date === today ? 'text-blue-400' : 'text-slate-300'}`}>
                  {fmtDate(date)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  · {grouped[date].length} trabajo{grouped[date].length > 1 ? 's' : ''}
                </span>
                {date === today && (
                  <span className="ml-auto text-[8px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">HOY</span>
                )}
              </div>

              <div className="space-y-3">
                {grouped[date].map(job => {
                  const isExpanded = expandedId === job.id;
                  const isDone = job.estado === 'completado';
                  return (
                    <div key={job.id} className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${isDone ? 'border-emerald-900/40 opacity-70' : 'border-slate-800'}`}>
                      {/* Card header — always visible */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : job.id)}
                        className="w-full px-4 py-3 flex items-start gap-3 text-left cursor-pointer"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ESTADO_DOT[job.estado]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white leading-snug">{job.titulo}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {job.hora_inicio && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-2.5 h-2.5" />{job.hora_inicio}{job.duracion_horas ? ` · ${job.duracion_horas}h` : ''}
                              </span>
                            )}
                            {job.trade_clients?.nombre && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                <User className="w-2.5 h-2.5" />{job.trade_clients.nombre}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isDone ? 'bg-emerald-900/50 text-emerald-400' :
                            job.estado === 'en_curso' ? 'bg-amber-900/50 text-amber-400' :
                            'bg-slate-800 text-slate-400'
                          }`}>{ESTADO_LABEL[job.estado]}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-slate-800 px-4 py-3 space-y-3">
                          {/* Address */}
                          {(job.direccion || job.localidad) && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-300">{[job.direccion, job.localidad, job.cp].filter(Boolean).join(', ')}</p>
                              </div>
                              <a href={mapsUrl(job)} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] font-bold text-blue-400 hover:text-blue-300 border border-blue-800 px-2 py-1 rounded cursor-pointer shrink-0">
                                <Navigation className="w-2.5 h-2.5" /> Maps
                              </a>
                            </div>
                          )}

                          {/* Client phone */}
                          {job.trade_clients?.telefono && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <a href={`tel:${job.trade_clients.telefono}`} className="text-xs text-blue-400 hover:text-blue-300">
                                {job.trade_clients.telefono}
                              </a>
                            </div>
                          )}

                          {/* Description */}
                          {job.descripcion && (
                            <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-800/50 rounded-lg px-3 py-2">
                              {job.descripcion}
                            </p>
                          )}

                          {/* Completion notes */}
                          {isDone && job.notas_cierre && (
                            <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
                              <p className="text-[9px] font-bold text-emerald-400 uppercase mb-1">Notas de cierre</p>
                              <p className="text-[10px] text-emerald-300">{job.notas_cierre}</p>
                            </div>
                          )}

                          {/* Action buttons */}
                          {!isDone && (
                            <div className="flex gap-2 pt-1">
                              {job.estado === 'planificado' && (
                                <button onClick={() => handleStatus(job, 'en_curso')}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold uppercase py-2.5 rounded-lg cursor-pointer transition-colors">
                                  <Play className="w-3 h-3" /> Iniciar trabajo
                                </button>
                              )}
                              {(job.estado === 'planificado' || job.estado === 'en_curso') && (
                                <button onClick={() => { setCompleteModal(job); setCloseNotes(''); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase py-2.5 rounded-lg cursor-pointer transition-colors">
                                  <CheckCircle className="w-3 h-3" /> Completar
                                </button>
                              )}
                              {job.estado === 'en_curso' && (
                                <button onClick={() => handleStatus(job, 'pendiente_material')}
                                  className="flex items-center justify-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-bold uppercase px-3 py-2.5 rounded-lg cursor-pointer transition-colors">
                                  Pdte. material
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-0">
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-white">Cerrar trabajo</h3>
              <button onClick={() => setCompleteModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">{completeModal.titulo}</p>
            <div className="mb-4">
              <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1.5">Notas de cierre (opcional)</label>
              <textarea
                rows={3}
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
                placeholder="Ej: Instalado correctamente, cliente conforme. Se recomienda revisión en 6 meses..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCompleteModal(null)}
                className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:border-slate-500">
                Cancelar
              </button>
              <button onClick={handleComplete} disabled={saving}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center justify-center gap-1.5">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Check className="w-3.5 h-3.5" /> Confirmar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' :
          toast.type === 'info'  ? 'bg-blue-600 text-white' :
          'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
