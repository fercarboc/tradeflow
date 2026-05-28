import React, { useState } from 'react';
import { CheckCircle, ArrowRight, Mic, Camera, FileText, Settings, X, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  orgId: string;
  onClose: () => void;
}

const STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: '¡Bienvenido a TradeFlow!',
    desc: 'Tu cuenta está lista. En 4 pasos rápidos descubrirás las funciones clave que te ahorrarán horas cada semana.',
    cta: 'Empezar',
  },
  {
    id: 'voz',
    icon: Mic,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: 'Presupuestos por voz',
    desc: 'Pulsa el botón de micrófono en la pantalla principal y dicta lo que vas a hacer. La IA genera el presupuesto al instante.',
    cta: 'Siguiente',
  },
  {
    id: 'foto',
    icon: Camera,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    title: 'Foto a presupuesto',
    desc: 'Saca una foto a cualquier material, albarán o instalación. La IA extrae partidas y precios automáticamente.',
    cta: 'Siguiente',
  },
  {
    id: 'cliente',
    icon: FileText,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    title: 'Guarda tu primer cliente',
    desc: 'Ve a "Clientes" y añade tu primer contacto. Vincula presupuestos y facturas para tener todo el historial en un clic.',
    cta: 'Siguiente',
  },
  {
    id: 'ajustes',
    icon: Settings,
    color: 'text-slate-300',
    bg: 'bg-slate-700/30',
    border: 'border-slate-600/30',
    title: 'Personaliza tu empresa',
    desc: 'En Ajustes → Empresa añade tu logo, NIF y datos fiscales. Aparecerán en todos tus presupuestos y facturas.',
    cta: 'Listo',
  },
];

export default function OnboardingWizard({ orgId, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleNext = async () => {
    if (isLast) {
      setSaving(true);
      await supabase.from('trade_organizations').update({ is_onboarded: true }).eq('id', orgId);
      setSaving(false);
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = async () => {
    await supabase.from('trade_organizations').update({ is_onboarded: true }).eq('id', orgId);
    onClose();
  };

  const Icon = current.icon;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Paso {step + 1} de {STEPS.length}
          </span>
          <button onClick={handleSkip} className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-6 space-y-5">
          <div className={`w-14 h-14 rounded-2xl ${current.bg} border ${current.border} flex items-center justify-center`}>
            <Icon className={`w-7 h-7 ${current.color}`} />
          </div>

          <div className="space-y-2">
            <h2 className="text-white font-black text-xl leading-tight">{current.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{current.desc}</p>
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-blue-500' : i < step ? 'w-1.5 bg-blue-500/40' : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 border border-slate-700 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
              >
                Atrás
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Guardando...' : isLast ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {current.cta}
                </>
              ) : (
                <>
                  {current.cta}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {step === 0 && (
            <button
              onClick={handleSkip}
              className="w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
            >
              Omitir introducción
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
