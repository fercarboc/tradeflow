import React from 'react';
import { CheckCircle, MessageCircle, CreditCard, Wrench, ShoppingCart, FileText, X } from 'lucide-react';
import type { Presupuesto } from '../types';

interface Props {
  quote: Presupuesto;
  onWhatsApp: () => void;
  onCobrar: () => void;
  onCrearTrabajo: () => void;
  onPedirMaterial: () => void;
  onVerPresupuesto: () => void;
  onClose: () => void;
}

interface ActionBtn {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
  className: string;
  shadow: string;
}

export default function ScreenPostConfirm({
  quote, onWhatsApp, onCobrar, onCrearTrabajo, onPedirMaterial, onVerPresupuesto, onClose,
}: Props) {
  const totalConIva = ((quote.total ?? 0) * 1.21).toFixed(2);

  const actions: ActionBtn[] = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      label: 'Enviar por WhatsApp',
      sublabel: 'Con enlace de aceptación',
      onClick: onWhatsApp,
      className: 'bg-emerald-500 hover:bg-emerald-400 text-white',
      shadow: '0 8px 24px rgba(16,185,129,0.45)',
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      label: 'Cobrar ahora',
      sublabel: 'Crea factura y registra pago',
      onClick: onCobrar,
      className: 'bg-blue-500 hover:bg-blue-400 text-white',
      shadow: '0 8px 24px rgba(59,130,246,0.45)',
    },
    {
      icon: <Wrench className="w-6 h-6" />,
      label: 'Crear trabajo',
      sublabel: 'Planifica la visita/instalación',
      onClick: onCrearTrabajo,
      className: 'bg-violet-500 hover:bg-violet-400 text-white',
      shadow: '0 8px 24px rgba(139,92,246,0.45)',
    },
    {
      icon: <ShoppingCart className="w-6 h-6" />,
      label: 'Pedir material',
      sublabel: 'Solicita materiales al proveedor',
      onClick: onPedirMaterial,
      className: 'bg-amber-500 hover:bg-amber-400 text-white',
      shadow: '0 8px 24px rgba(245,158,11,0.45)',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080C10] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 shrink-0">
        <div className="w-9 h-9" />
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-white/70 text-sm font-bold">Presupuesto listo</span>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/8 text-white/60 hover:text-white hover:bg-white/12 transition-colors"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Quote summary */}
      <div className="px-5 pt-4 pb-6 shrink-0">
        <div className="bg-white/6 border border-white/10 rounded-2xl px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">
                {quote.id && quote.id !== '' ? quote.id : 'Nuevo presupuesto'}
              </p>
              <p className="text-white font-black text-base leading-snug truncate">
                {quote.descripcion || 'Presupuesto'}
              </p>
              {quote.nombreCliente && (
                <p className="text-white/50 text-sm mt-0.5 truncate">{quote.nombreCliente}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-white/40 text-[10px] font-bold uppercase">Total IVA inc.</p>
              <p className="text-2xl font-black text-amber-400">{totalConIva}€</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex-1 px-5 space-y-3 overflow-y-auto pb-4">
        <p className="text-white/30 text-xs font-bold uppercase tracking-widest text-center mb-2">
          ¿Qué quieres hacer ahora?
        </p>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-colors cursor-pointer ${action.className}`}
            style={{ boxShadow: action.shadow }}
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              {action.icon}
            </div>
            <div className="text-left">
              <p className="text-base font-black leading-tight">{action.label}</p>
              <p className="text-xs opacity-75 font-semibold mt-0.5">{action.sublabel}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 pb-8 pt-3 shrink-0 space-y-2">
        <button
          onClick={onVerPresupuesto}
          className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 text-white/70 hover:text-white font-bold py-3.5 rounded-2xl text-sm transition-colors"
        >
          <FileText className="w-4 h-4" />
          Ver ficha del presupuesto
        </button>
      </div>
    </div>
  );
}
