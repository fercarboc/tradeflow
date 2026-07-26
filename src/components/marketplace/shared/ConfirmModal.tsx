import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmClassName?: string;
  loading: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  confirmClassName = 'bg-teal-600 hover:bg-teal-500 text-white',
  loading,
  children,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  // Enfocar el botón cancelar al abrir para seguridad (no el CTA destructivo)
  useEffect(() => {
    if (open) firstButtonRef.current?.focus();
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
            {title}
          </h2>
          <p id="modal-description" className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
            {description}
          </p>

          {children && (
            <div className="mb-4">
              {children}
            </div>
          )}

          <div className="flex gap-2">
            <button
              ref={firstButtonRef}
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${confirmClassName}`}
            >
              {loading ? (
                <span className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              ) : null}
              {loading ? 'Procesando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
