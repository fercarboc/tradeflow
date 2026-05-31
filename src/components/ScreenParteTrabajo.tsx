import React, { useState, useEffect, useRef } from 'react';
import {
  X, Camera, CheckCircle, Plus, Minus, Search, MapPin, User,
  Clock, Trash2, FileText, Loader2,
} from 'lucide-react';
import { supabase, uploadJobPhoto, loadJobPhotos, updateJob } from '../lib/supabase';
import type { TradeJob, TradeJobPhoto } from '../lib/supabase';

interface MaterialItem {
  id: string;
  codigo: string;
  descripcion: string;
  precioBase: number;
  cantidad: number;
}

interface TarifaLike {
  id: string;
  codigo: string;
  descripcion: string;
  precioBase: number;
}

interface ScreenParteTrabajoProps {
  job: TradeJob;
  orgId: string;
  tarifas: TarifaLike[];
  onComplete: (jobId: string, notas: string, materiales: MaterialItem[]) => Promise<void>;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

export default function ScreenParteTrabajo({
  job, orgId, tarifas, onComplete, onClose, showToast, isLiveMode,
}: ScreenParteTrabajoProps) {
  const [photos, setPhotos] = useState<TradeJobPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notas, setNotas] = useState(job.notas_cierre ?? '');
  const [materialSearch, setMaterialSearch] = useState('');
  const [materiales, setMateriales] = useState<MaterialItem[]>([]);
  const [completing, setCompleting] = useState(false);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLiveMode) return;
    loadJobPhotos(job.id)
      .then(setPhotos)
      .catch(() => {});
  }, [job.id, isLiveMode]);

  const filteredTarifas = tarifas.filter(t => {
    if (!materialSearch) return false;
    const q = materialSearch.toLowerCase();
    return t.descripcion.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q);
  }).slice(0, 8);

  function addMaterial(t: TarifaLike) {
    setMateriales(prev => {
      const existing = prev.find(m => m.id === t.id);
      if (existing) return prev.map(m => m.id === t.id ? { ...m, cantidad: m.cantidad + 1 } : m);
      return [...prev, { id: t.id, codigo: t.codigo, descripcion: t.descripcion, precioBase: t.precioBase, cantidad: 1 }];
    });
    setMaterialSearch('');
    setShowMaterialPicker(false);
  }

  function changeCantidad(id: string, delta: number) {
    setMateriales(prev => prev
      .map(m => m.id === id ? { ...m, cantidad: m.cantidad + delta } : m)
      .filter(m => m.cantidad > 0)
    );
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isLiveMode) return;
    setUploading(true);
    try {
      const photo = await uploadJobPhoto(job.id, file, 'installer', orgId);
      setPhotos(prev => [...prev, photo]);
      showToast('Foto añadida', 'success');
    } catch {
      showToast('Error al subir foto', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      await onComplete(job.id, notas, materiales);
      showToast('Trabajo completado', 'success');
      onClose();
    } catch {
      showToast('Error al completar el trabajo', 'error');
      setCompleting(false);
    }
  }

  async function deletePhoto(photo: TradeJobPhoto) {
    if (!isLiveMode) return;
    try {
      await supabase.from('trade_job_photos').delete().eq('id', photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch {
      showToast('Error al eliminar foto', 'error');
    }
  }

  const totalMateriales = materiales.reduce((s, m) => s + m.precioBase * m.cantidad, 0);

  const jobDate = job.fecha_inicio
    ? new Date(job.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F14] flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">Parte de trabajo</p>
          <h2 className="text-base font-black text-white leading-tight truncate">{job.titulo}</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 active:bg-white/15 text-slate-400 shrink-0 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">

        {/* Job info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          {job.trade_clients?.nombre && (
            <div className="flex items-center gap-2.5 text-sm text-slate-300">
              <User className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-semibold">{job.trade_clients.nombre}</span>
            </div>
          )}
          {(job.direccion || job.localidad) && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{[job.direccion, job.localidad].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {jobDate && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="capitalize">{jobDate}{job.hora_inicio ? ` · ${job.hora_inicio}` : ''}</span>
            </div>
          )}
        </div>

        {/* Fotos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fotos del trabajo</p>
            <span className="text-[10px] text-slate-600">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800 group">
                <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => deletePhoto(p)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-600/80 rounded-full flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* Botón añadir foto */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-1 active:border-blue-500 transition-colors cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-slate-500" />
                  <span className="text-[9px] text-slate-600 font-semibold">Foto</span>
                </>
              )}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Materiales usados */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materiales usados</p>
            {materiales.length > 0 && (
              <span className="text-[10px] font-bold text-blue-400">{totalMateriales.toFixed(0)} €</span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={materialSearch}
              onChange={e => { setMaterialSearch(e.target.value); setShowMaterialPicker(true); }}
              onFocus={() => setShowMaterialPicker(true)}
              placeholder="Buscar en catálogo…"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Suggestions */}
          {showMaterialPicker && filteredTarifas.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              {filteredTarifas.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => addMaterial(t)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-800 cursor-pointer ${i < filteredTarifas.length - 1 ? 'border-b border-slate-800' : ''}`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-semibold text-white truncate">{t.descripcion}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{t.codigo}</p>
                  </div>
                  <span className="text-sm font-bold text-blue-400 shrink-0">{t.precioBase.toFixed(0)} €</span>
                </button>
              ))}
            </div>
          )}

          {/* Lista materiales */}
          {materiales.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {materiales.map((m, i) => (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i < materiales.length - 1 ? 'border-b border-slate-800' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.descripcion}</p>
                    <p className="text-[10px] text-slate-500">{m.precioBase.toFixed(0)} € × {m.cantidad} = <span className="text-blue-400 font-bold">{(m.precioBase * m.cantidad).toFixed(0)} €</span></p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => changeCantidad(m.id, -1)} className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center active:bg-slate-700 cursor-pointer">
                      <Minus className="w-3 h-3 text-slate-300" />
                    </button>
                    <span className="text-sm font-bold text-white w-5 text-center">{m.cantidad}</span>
                    <button onClick={() => changeCantidad(m.id, 1)} className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center active:bg-blue-700 cursor-pointer">
                      <Plus className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {materiales.length === 0 && !showMaterialPicker && (
            <p className="text-xs text-slate-600 text-center py-1">Busca materiales del catálogo para añadirlos</p>
          )}
        </div>

        {/* Notas de cierre */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas del trabajo</p>
          <textarea
            rows={4}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Describe el trabajo realizado, incidencias, materiales extra…"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Spacer para no quedar tapado por el botón */}
        <div className="h-4" />
      </div>

      {/* Footer — Completar */}
      <div className="px-5 py-4 border-t border-white/8 shrink-0 bg-[#0B0F14]">
        {job.estado === 'completado' ? (
          <div className="flex items-center justify-center gap-2 py-3 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-bold">Trabajo completado</span>
          </div>
        ) : (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-4 rounded-2xl cursor-pointer transition-colors"
            style={{ boxShadow: '0 4px 24px rgba(16,185,129,0.35)' }}
          >
            {completing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {completing ? 'Guardando…' : 'Marcar como completado'}
          </button>
        )}
      </div>
    </div>
  );
}
