import { useState, useRef } from 'react';
import {
  Mic, MicOff, X, Loader2, CheckCircle, Sparkles, ChevronLeft, Layers,
  Truck, Package, Building2, MapPin, Network, Server,
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

interface MudanzaDetalles {
  origen: string;
  destino: string;
  km: string;
  pisos_origen: string;
  ascensor_origen: boolean;
  pisos_destino: string;
  ascensor_destino: boolean;
  guardamuebles: boolean;
  guardamuebles_meses: string;
  num_vehiculos: string;
  m3_aprox: string;
}

interface RedInformaticaDetalles {
  num_puestos: string;
  metros_cable: string;
  tipo_cable: string;
  num_switches: string;
  rack: boolean;
  ap_wifi: boolean;
  num_ap: string;
  servidor: boolean;
  cctv: boolean;
}

const DEFAULT_RED: RedInformaticaDetalles = {
  num_puestos: '', metros_cable: '', tipo_cable: 'Cat6',
  num_switches: '1', rack: false, ap_wifi: false, num_ap: '1',
  servidor: false, cctv: false,
};

function buildRedInformaticaTexto(r: RedInformaticaDetalles, categoria: string): string {
  const lines: string[] = [categoria];
  if (r.num_puestos) lines.push(`${r.num_puestos} puestos de trabajo`);
  if (r.metros_cable) lines.push(`Cableado estructurado: ${r.metros_cable} metros, ${r.tipo_cable}`);
  lines.push(`${r.num_switches} switch${Number(r.num_switches) > 1 ? 'es' : ''}`);
  if (r.rack) lines.push('Armario rack con panel de parcheo');
  if (r.ap_wifi) lines.push(`${r.num_ap} punto${Number(r.num_ap) > 1 ? 's' : ''} de acceso WiFi`);
  if (r.servidor) lines.push('Servidor o NAS');
  if (r.cctv) lines.push('Cableado para CCTV/cámaras de seguridad');
  lines.push('Incluir: canaletas o cableado bajo techo/suelo, tomas de red RJ45, etiquetado y certificación, conexión equipos, puesta en marcha.');
  return lines.join('\n');
}

export interface ScreenPresupuestoIncrementalProps {
  onConfirm: (q: { descripcion: string; partidas: PartidaItem[] }) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type Phase = 'categoria' | 'mudanza_detalles' | 'red_detalles' | 'acumulando' | 'resultado';

const DEFAULT_MUDANZA: MudanzaDetalles = {
  origen: '', destino: '', km: '',
  pisos_origen: '1', ascensor_origen: false,
  pisos_destino: '1', ascensor_destino: false,
  guardamuebles: false, guardamuebles_meses: '1',
  num_vehiculos: '1', m3_aprox: '',
};

function buildMudanzaTexto(m: MudanzaDetalles, categoria: string): string {
  const lines: string[] = [];
  lines.push(categoria);
  if (m.origen) lines.push(`Recogida en: ${m.origen}`);
  if (m.destino) lines.push(`Entrega en: ${m.destino}`);
  if (m.km) lines.push(`Distancia aproximada: ${m.km} km`);

  const accesoOrigen = m.ascensor_origen
    ? `Origen con ascensor (planta ${m.pisos_origen})`
    : `Origen sin ascensor, ${m.pisos_origen} planta${Number(m.pisos_origen) > 1 ? 's' : ''}`;
  const accesoDest = m.ascensor_destino
    ? `Destino con ascensor (planta ${m.pisos_destino})`
    : `Destino sin ascensor, ${m.pisos_destino} planta${Number(m.pisos_destino) > 1 ? 's' : ''}`;
  lines.push(`${accesoOrigen}. ${accesoDest}.`);

  lines.push(`${m.num_vehiculos} vehículo${Number(m.num_vehiculos) > 1 ? 's' : ''} de mudanza`);
  if (m.m3_aprox) lines.push(`Volumen aproximado: ${m.m3_aprox} m³`);
  if (m.guardamuebles) lines.push(`Guardamuebles: ${m.guardamuebles_meses} mes${Number(m.guardamuebles_meses) > 1 ? 'es' : ''}`);

  lines.push('Incluir partidas: embalaje y protección de muebles, desmontaje y montaje de mobiliario, carga y descarga, transporte.');
  if (!m.ascensor_origen && Number(m.pisos_origen) > 2) lines.push('Considerar montacargas o grúa exterior en origen.');
  if (!m.ascensor_destino && Number(m.pisos_destino) > 2) lines.push('Considerar montacargas o grúa exterior en destino.');
  if (m.guardamuebles) lines.push('Incluir partida guardamuebles por meses (precio mensual unitario).');

  return lines.join('\n');
}

export default function ScreenPresupuestoIncremental({ onConfirm, onClose, showToast }: ScreenPresupuestoIncrementalProps) {
  const [phase, setPhase]               = useState<Phase>('categoria');
  const [categoria, setCategoria]       = useState('');
  const [customText, setCustomText]     = useState('');
  const [partidas, setPartidas]         = useState<PartidaItem[]>([]);
  const [textInput, setTextInput]       = useState('');
  const [recording, setRecording]       = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [mudanza, setMudanza]           = useState<MudanzaDetalles>(DEFAULT_MUDANZA);
  const [red, setRed]                   = useState<RedInformaticaDetalles>(DEFAULT_RED);
  const recognitionRef                  = useRef<unknown>(null);

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isMudanza = categoria.toLowerCase().includes('mudanza');
  const isRed     = categoria.toLowerCase().includes('red') || categoria.toLowerCase().includes('inform') || categoria.toLowerCase().includes('network');

  function pickCategoria(label: string) {
    setCategoria(label);
    const k = label.toLowerCase();
    if (k.includes('mudanza')) {
      setMudanza(DEFAULT_MUDANZA);
      setPhase('mudanza_detalles');
    } else if (k.includes('red') || k.includes('inform') || k.includes('network')) {
      setRed(DEFAULT_RED);
      setPhase('red_detalles');
    } else {
      setPhase('acumulando');
    }
  }

  function handleCustom() {
    const label = customText.trim();
    if (!label) return;
    pickCategoria(label);
  }

  function setM(key: keyof MudanzaDetalles, val: string | boolean) {
    setMudanza(prev => ({ ...prev, [key]: val }));
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

  async function callAI(texto: string) {
    const contexto = `[PRESUPUESTO INCREMENTAL — ${categoria}]\nGenera SOLO las partidas de presupuesto para los elementos/trabajos descritos a continuación, sin calcular totales ni repetir lo anterior:\n\n${texto}`;
    const { data, error } = await supabase.functions.invoke('trade-voice-to-quote', {
      body: { text: contexto },
    });
    if (error) throw new Error(String((error as any).message ?? error));
    const raw = (data?.quote?.partidas ?? []) as Array<{
      concepto: string; cantidad: number; unidad: string;
      tipo_partida?: string; precio_unitario?: number; total?: number;
    }>;
    return raw.map(p => ({
      descripcion: p.concepto ?? '',
      cantidad: p.cantidad ?? 1,
      unidad: p.unidad ?? 'ud',
      tipo: (p.tipo_partida === 'mano_obra' ? 'mano_de_obra' : 'material') as 'material' | 'mano_de_obra',
      precioUnitario: p.precio_unitario ?? 0,
      total: p.total ?? 0,
    }));
  }

  async function addPartidasFromMudanzaDetalles() {
    setProcessing(true);
    try {
      const texto = buildMudanzaTexto(mudanza, categoria);
      const nuevas = await callAI(texto);
      setPartidas(nuevas);
      setPhase('acumulando');
      showToast(`${nuevas.length} partidas base generadas`, 'success');
    } catch {
      showToast('Error al procesar. Inténtalo de nuevo.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function addPartidasFromRedDetalles() {
    setProcessing(true);
    try {
      const texto = buildRedInformaticaTexto(red, categoria);
      const nuevas = await callAI(texto);
      setPartidas(nuevas);
      setPhase('acumulando');
      showToast(`${nuevas.length} partidas base generadas`, 'success');
    } catch {
      showToast('Error al procesar. Inténtalo de nuevo.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  async function addPartidas() {
    const texto = textInput.trim();
    if (!texto) return;
    setProcessing(true);
    try {
      const nuevas = await callAI(texto);
      setPartidas(prev => [...prev, ...nuevas]);
      setTextInput('');
      showToast(`${nuevas.length} partida${nuevas.length === 1 ? '' : 's'} añadida${nuevas.length === 1 ? '' : 's'}`, 'success');
    } catch {
      showToast('Error al procesar. Inténtalo de nuevo.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function handleBack() {
    if (phase === 'mudanza_detalles' || phase === 'red_detalles') { setPhase('categoria'); return; }
    if (phase === 'acumulando') {
      if (isMudanza) { setPhase('mudanza_detalles'); }
      else if (isRed) { setPhase('red_detalles'); }
      else { setPhase('categoria'); }
      return;
    }
    if (phase === 'resultado') { setPhase('acumulando'); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-[#0B0F14] z-[60] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
        <button
          onClick={phase === 'categoria' ? onClose : handleBack}
          className="flex items-center gap-1.5 text-slate-400 text-sm cursor-pointer"
        >
          {phase === 'categoria' ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Presupuesto por pasos</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 py-2.5 border-b border-white/8 shrink-0">
        {(['categoria', isMudanza ? 'mudanza_detalles' : isRed ? 'red_detalles' : null, 'acumulando', 'resultado'] as (Phase | null)[])
          .filter(Boolean)
          .map((p, i, arr) => (
          <div key={p!} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full transition-all ${
              phase === p ? 'bg-amber-400 scale-125'
                : arr.indexOf(phase) > i ? 'bg-amber-700' : 'bg-white/10'
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
                  className="bg-slate-900 border border-slate-700 hover:border-amber-500/40 rounded-2xl p-3.5 flex flex-col items-center gap-2 cursor-pointer active:opacity-70 text-center transition-colors"
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
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleCustom}
                disabled={!customText.trim()}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm cursor-pointer disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ── FASE: DETALLES MUDANZA ── */}
        {phase === 'mudanza_detalles' && (
          <div className="px-4 py-5 space-y-5 pb-32">
            <div className="text-center space-y-1">
              <Truck className="w-8 h-8 text-amber-400 mx-auto" />
              <h2 className="text-base font-bold text-white">Detalles de la mudanza</h2>
              <p className="text-slate-400 text-xs">Rellena lo que sepas — el resto lo añades después</p>
            </div>

            {/* Origen / Destino */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-amber-400" /> Origen y destino
              </p>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={mudanza.origen}
                  onChange={e => setM('origen', e.target.value)}
                  placeholder="Dirección de recogida (calle, ciudad)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={mudanza.destino}
                  onChange={e => setM('destino', e.target.value)}
                  placeholder="Dirección de entrega (calle, ciudad)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={mudanza.km}
                    onChange={e => setM('km', e.target.value)}
                    placeholder="Km aproximados"
                    className="w-36 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-slate-500">km entre domicilios</span>
                </div>
              </div>
            </div>

            {/* Accesos */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Building2 className="w-3 h-3 text-amber-400" /> Accesos
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Origen */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400">ORIGEN</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16">Planta</span>
                    <input
                      type="number" min="0" max="30"
                      value={mudanza.pisos_origen}
                      onChange={e => setM('pisos_origen', e.target.value)}
                      className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setM('ascensor_origen', !mudanza.ascensor_origen)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${mudanza.ascensor_origen ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${mudanza.ascensor_origen ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs text-slate-300">Ascensor</span>
                  </label>
                </div>
                {/* Destino */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400">DESTINO</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-16">Planta</span>
                    <input
                      type="number" min="0" max="30"
                      value={mudanza.pisos_destino}
                      onChange={e => setM('pisos_destino', e.target.value)}
                      className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setM('ascensor_destino', !mudanza.ascensor_destino)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${mudanza.ascensor_destino ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${mudanza.ascensor_destino ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs text-slate-300">Ascensor</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Logística */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Truck className="w-3 h-3 text-amber-400" /> Logística
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <p className="text-[10px] text-slate-400">Vehículos</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {['1', '2', '3', '4+'].map(v => (
                      <button
                        key={v}
                        onClick={() => setM('num_vehiculos', v)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          mudanza.num_vehiculos === v
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
                  <p className="text-[10px] text-slate-400">Volumen aprox. (m³)</p>
                  <input
                    type="number" min="0"
                    value={mudanza.m3_aprox}
                    onChange={e => setM('m3_aprox', e.target.value)}
                    placeholder="Ej: 30"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Guardamuebles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-bold text-slate-200">Guardamuebles</p>
                </div>
                <div
                  onClick={() => setM('guardamuebles', !mudanza.guardamuebles)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${mudanza.guardamuebles ? 'bg-amber-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${mudanza.guardamuebles ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
              {mudanza.guardamuebles && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Duración:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {['1', '2', '3', '6', '12'].map(m => (
                      <button
                        key={m}
                        onClick={() => setM('guardamuebles_meses', m)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          mudanza.guardamuebles_meses === m
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500">precio/mes</span>
                </div>
              )}
              <p className="text-[10px] text-slate-500">Si ofreces guardamuebles, se añadirá como partida mensual</p>
            </div>
          </div>
        )}

        {/* ── FASE: DETALLES RED INFORMÁTICA ── */}
        {phase === 'red_detalles' && (
          <div className="px-4 py-5 space-y-5 pb-32">
            <div className="text-center space-y-1">
              <Network className="w-8 h-8 text-amber-400 mx-auto" />
              <h2 className="text-base font-bold text-white">Detalles de la red</h2>
              <p className="text-slate-400 text-xs">Rellena lo que sepas — el resto lo añades después</p>
            </div>

            {/* Puestos y cableado */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Infraestructura</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                  <p className="text-[10px] text-slate-400">Puestos de trabajo</p>
                  <input
                    type="number" min="1"
                    value={red.num_puestos}
                    onChange={e => setRed(prev => ({ ...prev, num_puestos: e.target.value }))}
                    placeholder="Ej: 10"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                  <p className="text-[10px] text-slate-400">Metros cableado</p>
                  <input
                    type="number" min="0"
                    value={red.metros_cable}
                    onChange={e => setRed(prev => ({ ...prev, metros_cable: e.target.value }))}
                    placeholder="Ej: 150"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <p className="text-[10px] text-slate-400">Categoría de cable</p>
                <div className="flex gap-1.5">
                  {['Cat5e', 'Cat6', 'Cat6A', 'Cat7'].map(c => (
                    <button
                      key={c}
                      onClick={() => setRed(prev => ({ ...prev, tipo_cable: c }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        red.tipo_cable === c ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Equipos activos */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Server className="w-3 h-3 text-amber-400" /> Equipos activos
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Nº switches</span>
                  <div className="flex gap-1.5">
                    {['1', '2', '3', '4+'].map(v => (
                      <button
                        key={v}
                        onClick={() => setRed(prev => ({ ...prev, num_switches: v }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          red.num_switches === v ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { key: 'rack', label: 'Armario rack' },
                  { key: 'servidor', label: 'Servidor / NAS' },
                  { key: 'cctv', label: 'Cableado CCTV' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">{label}</span>
                    <div
                      onClick={() => setRed(prev => ({ ...prev, [key]: !(prev as any)[key] }))}
                      className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${(red as any)[key] ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${(red as any)[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">WiFi / APs</span>
                  <div
                    onClick={() => setRed(prev => ({ ...prev, ap_wifi: !prev.ap_wifi }))}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${red.ap_wifi ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${red.ap_wifi ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>
                {red.ap_wifi && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-400">Nº APs:</span>
                    <div className="flex gap-1.5">
                      {['1', '2', '3', '4+'].map(v => (
                        <button
                          key={v}
                          onClick={() => setRed(prev => ({ ...prev, num_ap: v }))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            red.num_ap === v ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FASE: ACUMULANDO ── */}
        {phase === 'acumulando' && (
          <div className="flex flex-col">
            <div className="px-4 py-3 bg-amber-600/10 border-b border-amber-500/20">
              <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mb-0.5">Categoría activa</p>
              <p className="text-sm font-bold text-white">{categoria}</p>
              <p className="text-[10px] text-slate-400">{partidas.length} partida{partidas.length !== 1 ? 's' : ''} acumulada{partidas.length !== 1 ? 's' : ''}</p>
            </div>

            {partidas.length > 0 && (
              <div className="px-4 py-3 border-b border-white/8">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Partidas hasta ahora</p>
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

            <div className="flex flex-col items-center px-6 py-6 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">
                  {isMudanza
                    ? (partidas.length === 0 ? 'Añade los enseres por estancia' : '¿Qué más hay?')
                    : (partidas.length === 0 ? '¿Qué hay que incluir?' : '¿Qué añadimos?')
                  }
                </h3>
                <p className="text-slate-400 text-xs">
                  {isMudanza
                    ? 'Describe la estancia y los muebles/enseres'
                    : (partidas.length === 0 ? 'Describe la primera zona o los primeros elementos' : 'Siguiente zona o elementos a presupuestar')
                  }
                </p>
              </div>

              <button
                onClick={recording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all select-none ${
                  recording
                    ? 'bg-red-500 shadow-[0_0_0_12px_rgba(239,68,68,0.2)] scale-110'
                    : 'bg-amber-500 shadow-[0_4px_32px_rgba(245,158,11,0.4)]'
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
                    isMudanza
                      ? 'Ej: Salón – sofá 3 plazas, 2 sillones, TV 65", mesa comedor grande con 6 sillas'
                      : 'Describe los elementos o zona a añadir...'
                  }
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
                <button
                  onClick={addPartidas}
                  disabled={!textInput.trim() || processing}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-40"
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
              <CheckCircle className="w-10 h-10 text-amber-400 mx-auto" />
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
              className="w-full py-3 rounded-2xl text-xs font-bold text-amber-400 border border-amber-500/30 cursor-pointer"
            >
              + Añadir más partidas
            </button>
          </div>
        )}
      </div>

      {/* Footer: generar partidas base (red detalles) */}
      {phase === 'red_detalles' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={addPartidasFromRedDetalles}
            disabled={processing}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-40"
            style={{ boxShadow: '0 4px 24px rgba(245,158,11,0.4)' }}
          >
            {processing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando partidas base…</>
              : <><Sparkles className="w-4 h-4" /> Generar partidas y continuar</>
            }
          </button>
        </div>
      )}

      {/* Footer: generar partidas base (mudanza detalles) */}
      {phase === 'mudanza_detalles' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={addPartidasFromMudanzaDetalles}
            disabled={processing}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-40"
            style={{ boxShadow: '0 4px 24px rgba(245,158,11,0.4)' }}
          >
            {processing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando partidas base…</>
              : <><Sparkles className="w-4 h-4" /> Generar partidas y continuar</>
            }
          </button>
        </div>
      )}

      {/* Footer: finalizar (acumulando con partidas) */}
      {phase === 'acumulando' && partidas.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={() => setPhase('resultado')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(245,158,11,0.4)' }}
          >
            <CheckCircle className="w-4 h-4" />
            Finalizar — {partidas.length} partida{partidas.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Footer: confirmar (resultado) */}
      {phase === 'resultado' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={() => onConfirm({ descripcion: categoria, partidas })}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(245,158,11,0.4)' }}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar y asignar precios
          </button>
        </div>
      )}
    </div>
  );
}
