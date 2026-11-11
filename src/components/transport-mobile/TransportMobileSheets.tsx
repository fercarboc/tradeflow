/**
 * Móvil · Transporte — ventanas inferiores con el mismo patrón que instaladores:
 *   · TransportNewSheet  → botón «+»: acciones rápidas (DeCA, hoja de ruta, servicio, presupuesto)
 *   · TransportMoreSheet → botón «Más»: rejilla de iconos con todas las secciones,
 *                          datos de empresa, contraseña, configuración y legal.
 */
import React from 'react';
import { X } from 'lucide-react';

export interface SheetItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Clases de fondo/color del icono (mismo sistema que instaladores). */
  tone: string;
  /** Texto de apoyo (solo en la ventana «+»). */
  hint?: string;
  badge?: number;
  onClick: () => void;
}

function SheetShell({ title, onClose, children, testId }: { title: string; onClose: () => void; children: React.ReactNode; testId: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose} data-testid={testId}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-center pt-3 pb-1"><span className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /></div>
        <div className="flex items-center justify-between px-5 pb-1">
          <span className="text-base font-bold text-slate-900 dark:text-white">{title}</span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700 text-slate-500 cursor-pointer active:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Ventana del botón «+»: acciones grandes, una por fila. */
export function TransportNewSheet({ items, onClose }: { items: SheetItem[]; onClose: () => void }) {
  return (
    <SheetShell title="Crear" onClose={onClose} testId="transport-new-sheet">
      <div className="flex flex-col gap-2 px-4 pt-3 pb-6">
        {items.map(item => (
          <button
            key={item.id}
            onClick={item.onClick}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left active:scale-[0.99] active:bg-slate-50 transition-transform cursor-pointer"
          >
            <span className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${item.tone}`}>{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-slate-900">{item.label}</span>
              {item.hint && <span className="block text-sm text-slate-500">{item.hint}</span>}
            </span>
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

/** Ventana del botón «Más»: rejilla de iconos agrupada por secciones. */
export function TransportMoreSheet({ groups, onClose }: { groups: { title: string; items: SheetItem[] }[]; onClose: () => void }) {
  return (
    <SheetShell title="Más opciones" onClose={onClose} testId="transport-more-sheet">
      <div className="px-4 pt-2 pb-6">
        {groups.filter(g => g.items.length).map(g => (
          <div key={g.title} className="mt-3">
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g.title}</p>
            <div className="grid grid-cols-3 gap-y-5 gap-x-2" data-testid="more-grid">
              {g.items.map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                >
                  <span className={`relative w-16 h-16 rounded-2xl flex items-center justify-center ${item.tone}`}>
                    {item.icon}
                    {!!item.badge && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-amber-400 text-gray-900 text-xs font-bold flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SheetShell>
  );
}
