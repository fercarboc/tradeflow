import { useState, useRef } from 'react';
import { Mic, MicOff, Sparkles, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  parseCleaningIntake,
  CleaningQuoteIntake,
  calculatePersonHours,
  parseNumericField,
} from '../../lib/cleaning/cleaningIntake';
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

const BOOLEAN_FIELD_KEYS: Array<keyof CleaningQuoteIntake> = [
  'windows', 'garage', 'terrace', 'blinds', 'escaparates',
];

const NUMERIC_INTAKE_KEYS: Array<keyof CleaningQuoteIntake> = [
  'surfaceM2', 'rooms', 'bathrooms', 'floors', 'portals', 'elevators',
  'workers', 'estimatedHoursPerWorker', 'visitsPerWeek', 'visitsPerMonth',
];

interface DetectedField {
  key: keyof CleaningQuoteIntake | null; // null = valor calculado, no editable directamente
  label: string;
  value: string;
}

export default function CleaningIntakePanel({ onConfirm, showToast }: CleaningIntakePanelProps) {
  const [rawText, setRawText] = useState('');
  const [recording, setRecording] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [intake, setIntake] = useState<Partial<CleaningQuoteIntake>>({});
  const [showDetected, setShowDetected] = useState(true);
  // Raw text acumulado en los inputs numéricos.
  // No se consolida en intake hasta blur/Enter para evitar que el campo
  // desaparezca mientras el usuario escribe (p. ej. "8" al escribir "88").
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
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
    setNumericDrafts({});
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

  // Consolida el draft numérico en intake y limpia el draft.
  function commitNumericDraft(key: string) {
    const raw = numericDrafts[key] ?? '';
    const n = parseNumericField(key, raw);
    setField(key as keyof CleaningQuoteIntake, n as any);
    setNumericDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
  }

  // Al pulsar "editar" en un campo detectado:
  // — pre-rellena el draft con el valor actual (para campos numéricos)
  // — elimina el valor del intake → el campo reaparece en la sección de pendientes
  function handleEditDetectedField(key: keyof CleaningQuoteIntake) {
    const current = intake[key];
    if (current != null && typeof current === 'number') {
      setNumericDrafts(prev => ({ ...prev, [key]: String(current) }));
    }
    setField(key, undefined);
  }

  const missing = analyzed ? getMissingQuestions(intake) : [];
  const { personHours, estimatedDuration } = calculatePersonHours(intake);

  const canConfirm = analyzed && !missing.some(q => q.priority === 'required');

  // Campos detectados — incluyen la clave para soportar edición.
  const detectedFields: DetectedField[] = [];
  if (intake.spaceType) detectedFields.push({ key: 'spaceType', label: 'Espacio', value: SPACE_LABELS[intake.spaceType] ?? intake.spaceType });
  if (intake.serviceType) detectedFields.push({ key: 'serviceType', label: 'Servicio', value: SERVICE_LABELS[intake.serviceType] ?? intake.serviceType });
  if (intake.recurrence) detectedFields.push({ key: 'recurrence', label: 'Modalidad', value: intake.recurrence === 'one_off' ? 'Puntual' : 'Recurrente' });
  if (intake.surfaceM2) detectedFields.push({ key: 'surfaceM2', label: 'Superficie', value: `${intake.surfaceM2} m²` });
  if (intake.rooms) detectedFields.push({ key: 'rooms', label: 'Habitaciones', value: String(intake.rooms) });
  // bathrooms: 0 es válido → usar != null en lugar de comprobación de veracidad
  if (intake.bathrooms != null) detectedFields.push({ key: 'bathrooms', label: 'Baños/aseos', value: String(intake.bathrooms) });
  if (intake.floors != null) detectedFields.push({ key: 'floors', label: 'Plantas', value: String(intake.floors) });
  if (intake.elevators) detectedFields.push({ key: 'elevators', label: 'Ascensores', value: String(intake.elevators) });
  if (intake.workers) detectedFields.push({ key: 'workers', label: 'Operarios', value: String(intake.workers) });
  if (intake.estimatedHoursPerWorker) detectedFields.push({ key: 'estimatedHoursPerWorker', label: 'Horas/operario', value: `${intake.estimatedHoursPerWorker} h` });
  if (personHours != null) detectedFields.push({ key: null, label: 'Horas-persona', value: `${personHours} h` });
  if (estimatedDuration != null && (intake.workers ?? 1) > 1) detectedFields.push({ key: null, label: 'Duración estimada', value: `${estimatedDuration} h` });
  if (intake.visitsPerWeek) detectedFields.push({ key: 'visitsPerWeek', label: 'Visitas/semana', value: String(intake.visitsPerWeek) });
  if (intake.visitsPerMonth) detectedFields.push({ key: 'visitsPerMonth', label: 'Visitas/mes', value: String(intake.visitsPerMonth) });
  // Booleanos: mostrar aunque sean false (el profesional puede haberlos respondido explícitamente)
  if (intake.garage !== undefined) detectedFields.push({ key: 'garage', label: 'Garaje', value: intake.garage ? 'Sí' : 'No' });
  if (intake.terrace !== undefined) detectedFields.push({ key: 'terrace', label: 'Terraza', value: intake.terrace ? 'Sí' : 'No' });
  if (intake.windows !== undefined) detectedFields.push({ key: 'windows', label: 'Cristales', value: intake.windows ? 'Sí' : 'No' });
  if (intake.blinds !== undefined) detectedFields.push({ key: 'blinds', label: 'Persianas', value: intake.blinds ? 'Sí' : 'No' });
  if (intake.escaparates !== undefined) detectedFields.push({ key: 'escaparates', label: 'Escaparates', value: intake.escaparates ? 'Sí' : 'No' });
  if (intake.furnishingState) detectedFields.push({ key: 'furnishingState', label: 'Estado', value: FURNISHING_OPTIONS.find(o => o.value === intake.furnishingState)?.label ?? intake.furnishingState });
  if (intake.frequencies && intake.frequencies.length > 0) {
    intake.frequencies.forEach(f => {
      const freq = f.timesPerWeek != null ? `${f.timesPerWeek}×/semana` : `${f.timesPerMonth}×/mes`;
      detectedFields.push({ key: null, label: f.task, value: freq });
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

      {/* Resumen de campos detectados — editables */}
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
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {detectedFields.map(({ key, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-white/35 shrink-0">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-white/70">{value}</span>
                    {/* Booleanos: toggle Sí/No inline */}
                    {key && BOOLEAN_FIELD_KEYS.includes(key) ? (
                      <div className="flex gap-1">
                        {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
                          <button
                            key={l}
                            onClick={() => setField(key, v as any)}
                            className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition-colors ${
                              (intake[key] as boolean | undefined) === v
                                ? 'bg-amber-500 text-white'
                                : 'bg-white/8 text-white/30 hover:bg-white/12'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    ) : key ? (
                      /* Enum/numéricos: "editar" limpia el campo y lo envía a la sección de pendientes */
                      <button
                        onClick={() => handleEditDetectedField(key)}
                        className="text-[9px] text-amber-400/40 hover:text-amber-400 cursor-pointer transition-colors"
                      >
                        editar
                      </button>
                    ) : null}
                  </div>
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

              {/* Inputs numéricos — draft state: onChange acumula texto, blur/Enter consolida */}
              {NUMERIC_INTAKE_KEYS.includes(q.key) && (
                <input
                  type="number"
                  min="0"
                  step={q.key === 'estimatedHoursPerWorker' || q.key === 'surfaceM2' ? '0.5' : '1'}
                  placeholder={q.key === 'surfaceM2' ? 'Ej: 80' : q.key === 'estimatedHoursPerWorker' ? 'Ej: 3' : 'Número'}
                  value={numericDrafts[q.key] ?? ''}
                  onChange={e => setNumericDrafts(prev => ({ ...prev, [q.key]: e.target.value }))}
                  onBlur={() => commitNumericDraft(q.key)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-amber-500/70 transition-colors"
                />
              )}

              {/* Chips Sí / No para campos booleanos */}
              {BOOLEAN_FIELD_KEYS.includes(q.key) && (
                <div className="flex gap-2">
                  {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
                    <button
                      key={l}
                      onClick={() => setField(q.key as any, v as any)}
                      className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                        (intake[q.key as keyof CleaningQuoteIntake] as boolean | undefined) === v
                          ? 'bg-amber-500 text-white'
                          : 'bg-white/8 text-white/50 hover:bg-white/12'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
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

      {/* Aviso cuando faltan campos requeridos */}
      {analyzed && missing.some(q => q.priority === 'required') && (
        <p className="text-center text-[10px] text-amber-400/70">
          Completa los campos marcados con * para generar las partidas
        </p>
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
