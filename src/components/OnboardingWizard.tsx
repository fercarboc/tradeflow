import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  orgId: string;
  onClose: () => void;
}

const STEPS = [
  {
    id: 'catalogo',
    emoji: '📦',
    title: 'Tu catálogo base está listo',
    desc: 'Hemos cargado materiales y precios de mercado para tu sector. Puedes usarlos desde el primer presupuesto y ajustar precios cuando quieras.',
    tip: null,
    cta: 'Empezar',
  },
  {
    id: 'voz',
    emoji: '🎤',
    title: 'Presupuesto por voz en 30 segundos',
    desc: 'Pulsa el botón de micrófono y dicta lo que vas a hacer. Por ejemplo: "cambiar grifo de cocina con media hora de mano de obra". La IA genera el presupuesto al instante.',
    tip: 'Funciona igual desde el móvil en obra y desde el PC en la oficina.',
    cta: 'Siguiente',
  },
  {
    id: 'ia',
    emoji: '🧠',
    title: 'La IA aprende tus precios',
    desc: 'No necesitas configurar nada manualmente. Cada vez que ajustes un precio en un presupuesto, queda guardado en tu catálogo. Con el tiempo, los presupuestos serán cada vez más precisos.',
    tip: 'Si no tienes un material en catálogo, la IA lo detecta igual y tú solo confirmas el precio.',
    cta: 'Siguiente',
  },
  {
    id: 'factura',
    emoji: '🧾',
    title: 'De presupuesto a factura en 1 clic',
    desc: 'Cuando el cliente acepte, convierte el presupuesto en factura con un solo clic. Descarga el PDF o envíaselo directamente. Todo queda grabado con el historial del cliente.',
    tip: null,
    cta: 'Siguiente',
  },
  {
    id: 'empresa',
    emoji: '⚙️',
    title: 'Añade los datos de tu empresa',
    desc: 'Ve a Ajustes → Empresa y añade tu logo, NIF y dirección fiscal. Aparecerán en todos tus presupuestos y facturas desde el primer día.',
    tip: null,
    cta: 'Listo',
  },
];

export default function OnboardingWizard({ orgId, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / STEPS.length) * 100;

  const finish = async () => {
    setSaving(true);
    await supabase.from('trade_organizations').update({ is_onboarded: true }).eq('id', orgId);
    setSaving(false);
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      finish();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#0d1f38] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Barra de progreso */}
        <div className="h-1 bg-white/8">
          <div
            className="h-full bg-[#00CFE8] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-white/30 hover:text-white/60 text-xs transition-colors cursor-pointer"
          >
            Omitir
          </button>
        </div>

        {/* Contenido */}
        <div className="px-6 pt-4 pb-6 space-y-4">
          <div className="text-4xl">{current.emoji}</div>

          <div className="space-y-2">
            <h2 className="text-white font-black text-lg leading-tight">{current.title}</h2>
            <p className="text-white/50 text-sm leading-relaxed">{current.desc}</p>
          </div>

          {current.tip && (
            <div className="bg-[#00CFE8]/8 border border-[#00CFE8]/20 rounded-xl px-3 py-2.5">
              <p className="text-[#00CFE8]/80 text-xs leading-relaxed">{current.tip}</p>
            </div>
          )}

          {/* Puntos de progreso */}
          <div className="flex gap-1.5 pt-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? 'w-5 bg-[#00CFE8]' : i < step ? 'w-1.5 bg-[#00CFE8]/35' : 'w-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>

          {/* Botones */}
          <div className="flex gap-2.5 pt-1">
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2.5 border border-white/15 rounded-xl text-sm font-bold text-white/40 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              >
                Atrás
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 py-2.5 bg-[#00CFE8] hover:brightness-110 disabled:opacity-50 text-[#020B16] rounded-xl text-sm font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </>
              ) : isLast ? (
                <>✓ {current.cta}</>
              ) : (
                <>{current.cta} →</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
