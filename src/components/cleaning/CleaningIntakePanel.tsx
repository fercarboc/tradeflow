import { useState, useRef } from 'react';
import { Mic, MicOff, Sparkles, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { parseCleaningIntake, CleaningQuoteIntake, calculatePersonHours } from '../../lib/cleaning/cleaningIntake';
import { getMissingQuestions } from '../../lib/cleaning/cleaningQuestions';

export interface CleaningIntakePanelProps {
  onConfirm: (intake: Partial<CleaningQuoteIntake>) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const SPACE_LABELS: Record<string, string> = {
  vivienda: 'Vivienda / piso', oficina: 'Oficina', despacho: 'Despacho',
  local_comercial: 'Local comercial', comunidad: 'Comunidad', garaje: 'Garaje',
  nave: 'Nave', edificio: 'Edificio', otro: 'Otro',
};
const SERVICE_LABELS: Record<string, string> = {
  limpieza_integral: 'Limpieza integral', limpieza_general: 'Limpieza general',
  mantenimiento: 'Mantenimiento recurrente', puntual: 'Limpieza puntual',
  fin_de_obra: 'Fin de obra / post-reforma', cristales: 'Cristales',
  limpieza_profunda: 'Limpieza profunda', cambio_inquilino: 'Cambio de inquilino', otro: 'Otro',
};

// Chips de respuesta rápida para preguntas clave.
const SPACE_OPTIONS = Object.entries(SPACE_LABELS).map(([v, l]) => ({ value: v, label: l }));
const SERVICE_OPTIONS = Object.entries(SERVICE_LABELS).map(([v, l]) => ({ value: v, label: l }));
const RECURRENCE_OPTIONS = [
  { value: 'one_off', label: 'Puntual (una sola vez)' },
  { value: 'recurring', label: 'Recurrente / periódico' },
];
const FURNISHING_OPTIONS = [
  { value: 'vacio', label: 'Vacío' },
  { value: 'parcialmente_amueblado', label: 'Parcialmente amueblado' },
  { value: 'amueblado', label: 'Amueblado' },
  { value: 'equipado', label: 'Equipado' },
];

export default function CleaningIntakePanel({ onConfirm, showToast }: CleaningIntakePanelProps) {
  const [rawText, setRawText] = useState('');
  const [recording, setRecording] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [intake, setIntake] = useState<Partial<CleaningQuoteIntake>>({});
  const [showDetected, setShowDetected] = useState(true);
  const recognitionRef = useRef<unknown>(null);

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  function startRecording() {
    if (!SpeechAPI) { showToast('Dictado no disponible en este navegador. Escribe directamente.', 'info'); return; }
    const r = new SpeechAPI();
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const text = (e.results[0]?.[0]?.transcript ?? '').trim();
      setRawText(prev => prev ? `${prev} ${text}` : text);
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

  function handleAnalyze() {
    const text = rawText.trim();
    if (!text) { showToast('Describe primero qué hay que limpiar', 'info'); return; }
    const parsed = parseCleaningIntake(text);
    setIntake(parsed);
    setAnalyzed(true);
    setShowDetected(true);
  }

  function setField<K extends keyof CleaningQuoteIntake>(key: K, value: CleaningQuoteIntake[K] | undefined) {
    setIntake(prev => {
      if (value === undefined) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }

  function parseNumber(val: string): number | undefined {
    const n = parseFloat(val.replace(',', '.'));
    return isNaN(n) || n <= 0 ? undefined : n;
  }

  const missing = analyzed ? getMissingQuestions(intake) : [];
  const { personHours, estimatedDuration } = calculatePersonHours(intake);

  // Mínimo para confirmar: al menos spaceType o algún dato relevante.
  const canConfirm = analyzed && (!!intake.spaceType || !!intake.serviceType || rawText.trim().length > 5);

  // Resumen de campos detectados para mostrar al usuario.
  const detectedFields: { label: string; value: string }[] = [];
  if (intake.spaceType) detectedFields.push({ label: 'Espacio', value: SPACE_LABELS[intake.spaceType] ?? intake.spaceType });
  if (intake.serviceType) detectedFields.push({ label: 'Servicio', value: SERVICE_LABELS[intake.serviceType] ?? intake.serviceType });
  if (intake.recurrence) detectedFields.push({ label: 'Modalidad', value: intake.recurrence === 'one_off' ? 'Puntual' : 'Recurrente' });
  if (intake.surfaceM2) detectedFields.push({ label: 'Superficie', value: `${intake.surfaceM2} m²` });
  if (intake.rooms) detectedFields.push({ label: 'Habitaciones', value: String(intake.rooms) });
  if (intake.bathrooms) detectedFields.push({ label: 'Baños/aseos', value: String(intake.bathrooms) });
  if (intake.floors) detectedFields.push({ label: 'Plantas', value: String(intake.floors) });
  if (intake.elevators) detectedFields.push({ label: 'Ascensores', value: String(intake.elevators) });
  if (intake.workers) detectedFields.push({ label: 'Operarios', value: String(intake.workers) });
  if (intake.estimatedHoursPerWorker) detectedFields.push({ label: 'Horas/operario', value: `${intake.estimatedHoursPerWorker} h` });
  if (personHours != null) detectedFields.push({ label: 'Horas-persona', value: `${personHours} h` });
  if (estimatedDuration != null && (intake.workers ?? 1) > 1) detectedFields.push({ label: 'Duración estimada', value: `${estimatedDuration} h` });
  if (intake.visitsPerWeek) detectedFields.push({ label: 'Visitas/semana', value: String(intake.visitsPerWeek) });
  if (intake.visitsPerMonth) detectedFields.push({ label: 'Visitas/mes', value: String(intake.visitsPerMonth) });
  if (intake.garage) detectedFields.push({ label: 'Garaje', value: 'Sí' });
  if (intake.terrace) detectedFields.push({ label: 'Terraza', value: 'Sí' });
  if (intake.windows) detectedFields.push({ label: 'Cristales', value: 'Sí' });
  if (intake.blinds) detectedFields.push({ label: 'Persianas', value: 'Sí' });
  if (intake.escaparates) detectedFields.push({ label: 'Escaparates', value: 'Sí' });
  if (intake.furnishingState) detectedFields.push({ label: 'Estado', value: FURNISHING_OPTIONS.find(o => o.value === intake.furnishingState)?.label ?? intake.furnishingState });
  if (intake.frequencies && intake.frequencies.length > 0) {
    intake.frequencies.forEach(f => {
      const freq = f.timesPerWeek != null ? `${f.timesPerWeek}×/semana` : `${f.timesPerMonth}×/mes`;
      detectedFields.push({ label: f.task, value: freq });
    });
  }

  return (
    <div className="px-5 py-4 space-y-5 pb-36">

      {/* Encabezado */}
      <div className="text-center space-y-1.5">
        <span className="text-3xl">🧹</span>
        <h2 className="text-lg font-black text-white">¿Qué hay que limpiar?</h2>
        <p className="text-[12px] text-white/40 leading-relaxed">
          Cuéntamelo como quieras — habla o escribe. Cuanto más describas, mejor la propuesta.
        </p>
      </div>

      {/* Texto + micrófono */}
      <div className="space-y-2">
        <textarea
          value={rawText}
          onChange={e => { setRawText(e.target.value); setAnalyzed(false); }}
          placeholder={'Ej: Limpieza de piso de fin de obra, dos habitaciones y dos baños.\nO: Local de 80 metros, limpieza puntual, escaparate, dos personas cuatro horas.'}
          rows={4}
          className="w-full bg-[#111827] border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-500/70 transition-colors resize-none"
        />
        <div className="flex gap-2">
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all select-none ${
              recording ? 'bg-red-600 text-white animate-pulse' : 'bg-white/8 hover:bg-white/12 text-white/60 hover:text-white'
            }`}
          >
            {recording ? <><MicOff className="w-3.5 h-3.5" /> Grabando…</> : <><Mic className="w-3.5 h-3.5" /> Mantén para hablar</>}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!rawText.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 text-amber-400 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analizar texto
          </button>
        </div>
      </div>

      {/* Resumen de campos detectados */}
      {analyzed && (
        <div className="bg-[#0f1a2e] border border-white/8 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDetected(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white/70">
                {detectedFields.length > 0 ? `${detectedFields.length} datos detectados` : 'Sin datos detectados en el texto'}
              </span>
            </div>
            {showDetected ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
          </button>
          {showDetected && detectedFields.length > 0 && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {detectedFields.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-1">
                  <span className="text-[10px] text-white/35 shrink-0">{label}</span>
                  <span className="text-[10px] font-semibold text-white/70 text-right truncate">{value}</span>
                </div>
              ))}
            </div>
          )}
          {showDetected && detectedFields.length === 0 && (
            <p className="px-4 pb-3 text-[11px] text-white/30">
              No se han podido extraer datos del texto. Rellena los campos de abajo o reescribe con más detalle.
            </p>
          )}
        </div>
      )}

      {/* Preguntas dinámicas — solo campos relevantes ausentes */}
      {analyzed && missing.length > 0 && (
        <div className="space-y-4">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
            Completa los datos que faltan{missing.some(m => m.priority === 'required') ? ' (requeridos)' : ''}
          </p>

          {missing.map(q => (
            <div key={q.key} className="space-y-2">
              <p className="text-xs font-semibold text-white/70">
                {q.label}
                {q.priority === 'required' && <span className="text-amber-400 ml-1">*</span>}
              </p>

              {/* Chips para campos de selección */}
              {q.key === 'spaceType' && (
                <div className="flex flex-wrap gap-1.5">
                  {SPACE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setField('spaceType', o.value as CleaningQuoteIntake['spaceType'])}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
                        intake.spaceType === o.value ? 'bg-amber-500 text-white' : 'bg-white/8 text-white/50 hover:bg-white/12'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {q.key === 'serviceType' && (
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setField('serviceType', o.value as CleaningQuoteIntake['serviceType'])}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
                        intake.serviceType === o.value ? 'bg-amber-500 text-white' : 'bg-white/8 text-white/50 hover:bg-white/12'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {q.key === 'recurrence' && (
                <div className="flex gap-2">
                  {RECURRENCE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setField('recurrence', o.value as CleaningQuoteIntake['recurrence'])}
                      className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                        intake.recurrence === o.value ? 'bg-amber-500 text-white' : 'bg-white/8 text-white/50 hover:bg-white/12'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {q.key === 'furnishingState' && (
                <div className="flex flex-wrap gap-1.5">
                  {FURNISHING_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setField('furnishingState', o.value as CleaningQuoteIntake['furnishingState'])}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
                        intake.furnishingState === o.value ? 'bg-amber-500 text-white' : 'bg-white/8 text-white/50 hover:bg-white/12'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Inputs numéricos */}
              {(q.key === 'surfaceM2' || q.key === 'rooms' || q.key === 'bathrooms' || q.key === 'floors' || q.key === 'portals' || q.key === 'elevators' || q.key === 'workers' || q.key === 'estimatedHoursPerWorker' || q.key === 'visitsPerWeek' || q.key === 'visitsPerMonth') && (
                <input
                  type="number"
                  min="0"
                  step={q.key === 'estimatedHoursPerWorker' || q.key === 'surfaceM2' ? '0.5' : '1'}
                  placeholder={q.key === 'surfaceM2' ? 'Ej: 80' : q.key === 'estimatedHoursPerWorker' ? 'Ej: 3' : 'Número'}
                  value={(intake[q.key] as number | undefined) ?? ''}
                  onChange={e => {
                    const n = parseNumber(e.target.value);
                    setField(q.key as any, n as any);
                  }}
                  className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-500/70 transition-colors"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Horas-persona en tiempo real */}
      {analyzed && intake.workers && intake.estimatedHoursPerWorker && (
        <div className="bg-sky-500/8 border border-sky-500/20 rounded-xl px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-sky-400/70 uppercase font-bold tracking-wider">Horas-persona</p>
            <p className="text-lg font-black text-sky-300">{personHours} h</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Duración</p>
            <p className="text-base font-bold text-white/60">≈ {estimatedDuration} h</p>
          </div>
        </div>
      )}

      {/* Botón confirmar */}
      {canConfirm && (
        <div className="pt-2">
          <button
            onClick={() => onConfirm({ ...intake, notes: rawText.trim() || undefined })}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm cursor-pointer transition-colors"
            style={{ boxShadow: '0 8px 32px rgba(245,158,11,0.4)' }}
          >
            <Sparkles className="w-4.5 h-4.5" />
            Generar partidas de limpieza
          </button>
          <p className="text-center text-[10px] text-white/25 mt-2">
            Podrás revisar, añadir y editar todas las partidas antes de confirmar
          </p>
        </div>
      )}
    </div>
  );
}
