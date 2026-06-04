import { useState, useRef } from 'react';
import {
  Mic, MicOff, X, Loader2, CheckCircle, Sparkles, ChevronLeft, Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const CATEGORIAS = [
  { icon: '🏠', label: 'Mudanza de casa' },
  { icon: '🍳', label: 'Reforma cocina' },
  { icon: '🚿', label: 'Reforma baño' },
  { icon: '🔌', label: 'Instalación eléctrica' },
  { icon: '💧', label: 'Instalación fontanería' },
  { icon: '❄️', label: 'Climatización' },
  { icon: '🌐', label: 'Red informática' },
  { icon: '🏗️', label: 'Reforma integral' },
];

interface PartidaItem {
  descripcion: string;
  cantidad: number;
  unidad: string;
  tipo: 'material' | 'mano_de_obra';
  precioUnitario: number;
  total: number;
}

export interface ScreenPresupuestoIncrementalProps {
  onConfirm: (q: { descripcion: string; partidas: PartidaItem[] }) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type Phase = 'categoria' | 'acumulando' | 'resultado';

export default function ScreenPresupuestoIncremental({ onConfirm, onClose, showToast }: ScreenPresupuestoIncrementalProps) {
  const [phase, setPhase]             = useState<Phase>('categoria');
  const [categoria, setCategoria]     = useState('');
  const [customText, setCustomText]   = useState('');
  const [partidas, setPartidas]       = useState<PartidaItem[]>([]);
  const [textInput, setTextInput]     = useState('');
  const [recording, setRecording]     = useState(false);
  const [processing, setProcessing]   = useState(false);
  const recognitionRef                = useRef<unknown>(null);

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  function pickCategoria(label: string) {
    setCategoria(label);
    setPhase('acumulando');
  }

  function handleCustom() {
    const label = customText.trim();
    if (!label) return;
    setCategoria(label);
    setPhase('acumulando');
  }

  function startRecording() {
    if (!SpeechAPI) {
      showToast('Dictado no disponible en este navegador. Escribe directamente.', 'info');
      return;
    }
    const r = new SpeechAPI();
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const text = (e.results[0]?.[0]?.transcript ?? '').trim();
      setTextInput(prev => prev ? `${prev} ${text}` : text);
    };
    r.onerror = () => { showToast('Error al reconocer voz', 'error'); setRecording(false); };
    r.onend = () => setRecording(false);
    r.start();
    recognitionRef.current = r;
    setRecording(true);
  }

  function stopRecording() {
    (recognitionRef.current as any)?.stop();
    setRecording(false);
  }

  async function addPartidas() {
    const texto = textInput.trim();
    if (!texto) return;
    setProcessing(true);
    try {
      const contexto = `[PRESUPUESTO INCREMENTAL — ${categoria}]\nGenera SOLO las partidas de presupuesto para los elementos/trabajos descritos a continuación, sin calcular totales ni repetir lo anterior:\n\n${texto}`;
      const { data, error } = await supabase.functions.invoke('trade-voice-to-quote', {
        body: { texto: contexto },
      });
      if (error) throw new Error(String((error as any).message ?? error));
      const raw = (data?.presupuesto?.partidas ?? []) as Array<{
        descripcion: string; cantidad: number; unidad: string;
        categoria?: string; precio_unitario?: number; total?: number;
      }>;
      const nuevas: PartidaItem[] = raw.map(p => ({
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        unidad: p.unidad,
        tipo: (p.categoria === 'Mano de obra' ? 'mano_de_obra' : 'material') as 'material' | 'mano_de_obra',
        precioUnitario: p.precio_unitario ?? 0,
        total: p.total ?? 0,
      }));
      setPartidas(prev => [...prev, ...nuevas]);
      setTextInput('');
      showToast(`${nuevas.length} partida${nuevas.length === 1 ? '' : 's'} añadida${nuevas.length === 1 ? '' : 's'}`, 'success');
    } catch {
      showToast('Error al procesar. Inténtalo de nuevo.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0B0F14] z-[60] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
        <button
          onClick={phase === 'acumulando' ? () => setPhase('categoria') : onClose}
          className="flex items-center gap-1.5 text-slate-400 text-sm cursor-pointer"
        >
          {phase === 'acumulando' ? <ChevronLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Presupuesto por pasos</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 py-2.5 border-b border-white/8 shrink-0">
        {(['categoria', 'acumulando', 'resultado'] as Phase[]).map((p, i) => (
          <div key={p} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full transition-all ${
              phase === p ? 'bg-blue-400 scale-125'
                : (['categoria', 'acumulando', 'resultado'].indexOf(phase) > i) ? 'bg-blue-700' : 'bg-white/10'
            }`} />
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* ── FASE: CATEGORÍA ── */}
        {phase === 'categoria' && (
          <div className="px-4 py-5 space-y-4">
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-white">¿Qué tipo de trabajo?</h2>
              <p className="text-slate-400 text-sm">Selecciona la categoría para ir añadiendo partidas paso a paso</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIAS.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => pickCategoria(cat.label)}
                  className="bg-slate-900 border border-slate-700 hover:border-blue-500/40 rounded-2xl p-3.5 flex flex-col items-center gap-2 cursor-pointer active:opacity-70 text-center transition-colors"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-xs font-bold text-slate-200 leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustom()}
                placeholder="Otro tipo de trabajo..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleCustom}
                disabled={!customText.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm cursor-pointer disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ── FASE: ACUMULANDO ── */}
        {phase === 'acumulando' && (
          <div className="flex flex-col">
            {/* Header de categoría */}
            <div className="px-4 py-3 bg-blue-600/10 border-b border-blue-500/20">
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-0.5">Categoría activa</p>
              <p className="text-sm font-bold text-white">{categoria}</p>
              <p className="text-[10px] text-slate-400">{partidas.length} partida{partidas.length !== 1 ? 's' : ''} acumulada{partidas.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Lista de partidas acumuladas */}
            {partidas.length > 0 && (
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Partidas añadidas hasta ahora</p>
                <div className="bg-slate-900 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                  {partidas.map((p, i) => (
                    <div key={i} className={`px-3 py-2 flex items-center justify-between gap-2 ${i < partidas.length - 1 ? 'border-b border-slate-800' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-white truncate">{p.descripcion}</p>
                        <span className={`text-[8px] font-bold px-1 rounded ${p.tipo === 'mano_de_obra' ? 'text-blue-400' : 'text-emerald-400'}`}>
                          {p.tipo === 'mano_de_obra' ? 'Mano de obra' : 'Material'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 shrink-0 font-mono">{p.cantidad} {p.unidad}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Área de entrada */}
            <div className="flex flex-col items-center px-6 py-6 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">
                  {partidas.length === 0 ? '¿Qué hay que incluir?' : '¿Qué añadimos?'}
                </h3>
                <p className="text-slate-400 text-xs">
                  {partidas.length === 0
                    ? 'Describe la primera zona o los primeros elementos'
                    : 'Siguiente zona o elementos a presupuestar'}
                </p>
              </div>

              {/* Botón micrófono */}
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all select-none ${
                  recording
                    ? 'bg-red-500 shadow-[0_0_0_12px_rgba(239,68,68,0.2)] scale-110'
                    : 'bg-blue-600 shadow-[0_4px_32px_rgba(37,99,235,0.5)]'
                }`}
              >
                {recording ? <MicOff className="w-9 h-9 text-white" /> : <Mic className="w-9 h-9 text-white" />}
              </button>

              {recording
                ? <p className="text-red-400 text-xs font-bold animate-pulse flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                    Escuchando…
                  </p>
                : <p className="text-[11px] text-slate-500">Toca para hablar o escribe abajo</p>
              }

              <div className="w-full space-y-2">
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  placeholder={
                    categoria.toLowerCase().includes('mudanza')
                      ? 'Ej: Salón – sofá 3 plazas, 2 sillones, mesa madera grande, TV 65"'
                      : 'Describe los elementos o zona a añadir...'
                  }
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  onClick={addPartidas}
                  disabled={!textInput.trim() || processing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-40"
                >
                  {processing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando con IA…</>
                    : <><Sparkles className="w-4 h-4" /> Añadir partidas al presupuesto</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FASE: RESULTADO ── */}
        {phase === 'resultado' && (
          <div className="px-4 py-4 space-y-4 pb-32">
            <div className="text-center space-y-1.5">
              <CheckCircle className="w-10 h-10 text-blue-400 mx-auto" />
              <h2 className="text-lg font-bold text-white">{categoria}</h2>
              <p className="text-slate-400 text-sm">{partidas.length} partidas listas para presupuestar</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              {partidas.map((p, i) => (
                <div key={i} className={`px-4 py-3 flex items-center justify-between gap-3 ${i < partidas.length - 1 ? 'border-b border-slate-800' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white font-medium truncate">{p.descripcion}</p>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                      p.tipo === 'mano_de_obra' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {p.tipo === 'mano_de_obra' ? 'Mano de obra' : 'Material'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 shrink-0 font-mono">{p.cantidad} {p.unidad}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPhase('acumulando')}
              className="w-full py-3 rounded-2xl text-xs font-bold text-blue-400 border border-blue-500/30 cursor-pointer"
            >
              + Añadir más partidas
            </button>
          </div>
        )}
      </div>

      {/* Footer: botón Finalizar (fase acumulando con partidas) */}
      {phase === 'acumulando' && partidas.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={() => setPhase('resultado')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.5)' }}
          >
            <CheckCircle className="w-4 h-4" />
            Finalizar — {partidas.length} partida{partidas.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Footer: botón Confirmar (fase resultado) */}
      {phase === 'resultado' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={() => onConfirm({ descripcion: categoria, partidas })}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.5)' }}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar y asignar precios
          </button>
        </div>
      )}
    </div>
  );
}
