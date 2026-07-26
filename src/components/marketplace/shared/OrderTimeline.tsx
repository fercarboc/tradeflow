import React from 'react';
import { OrderLifecycleEstado } from '../../../lib/api/marketplace-orders';

const INSTALLER_STEPS: { estado: OrderLifecycleEstado; label: string }[] = [
  { estado: 'pending',   label: 'Realizado'   },
  { estado: 'confirmed', label: 'Confirmado'  },
  { estado: 'preparing', label: 'Preparando'  },
  { estado: 'shipped',   label: 'En tránsito' },
  { estado: 'delivered', label: 'Recibido'    },
];

const SUPPLIER_STEPS: { estado: OrderLifecycleEstado; label: string }[] = [
  { estado: 'pending',   label: 'Pedido'     },
  { estado: 'confirmed', label: 'Confirmado' },
  { estado: 'preparing', label: 'Preparando' },
  { estado: 'shipped',   label: 'Enviado'    },
  { estado: 'delivered', label: 'Entregado'  },
];

// Orden numérico de estados para calcular progreso
const ESTADO_ORDER: Partial<Record<OrderLifecycleEstado, number>> = {
  pending:   0,
  confirmed: 1,
  preparing: 2,
  shipped:   3,
  delivered: 4,
  completed: 4,
};

interface OrderTimelineProps {
  estado: OrderLifecycleEstado;
  installerView?: boolean;
  cancelReason?: string | null;
}

export default function OrderTimeline({ estado, installerView = true, cancelReason }: OrderTimelineProps) {
  if (estado === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 shrink-0" aria-hidden="true">
          <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pedido cancelado</p>
          {cancelReason && (
            <p className="text-xs text-slate-500 mt-0.5">Motivo: {cancelReason}</p>
          )}
        </div>
      </div>
    );
  }

  const steps      = installerView ? INSTALLER_STEPS : SUPPLIER_STEPS;
  const currentIdx = ESTADO_ORDER[estado] ?? 0;

  return (
    <ol className="flex items-center gap-0" aria-label="Progreso del pedido">
      {steps.map((step, idx) => {
        const isPast   = idx < currentIdx;
        const isActive = idx === currentIdx;

        return (
          <React.Fragment key={step.estado}>
            {idx > 0 && (
              <li
                className={`h-0.5 flex-1 motion-safe:transition-colors ${
                  isPast ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
                aria-hidden="true"
              />
            )}
            <li className="flex flex-col items-center gap-1" aria-current={isActive ? 'step' : undefined}>
              <div className={`h-2.5 w-2.5 rounded-full border-2 motion-safe:transition-colors ${
                isPast   ? 'border-teal-500 bg-teal-500'
                : isActive ? 'border-teal-500 bg-teal-500 ring-2 ring-teal-200 dark:ring-teal-900'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
              }`} aria-hidden="true" />
              <span className={`text-[9px] leading-none text-center ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 font-semibold'
                  : isPast
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-slate-300 dark:text-slate-600'
              }`}>
                {step.label}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
