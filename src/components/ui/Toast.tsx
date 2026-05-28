import { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const CFG: Record<ToastType, { icon: typeof CheckCircle; cls: string }> = {
  success: { icon: CheckCircle,    cls: 'bg-emerald-900/90 border-emerald-700 text-emerald-200' },
  error:   { icon: XCircle,        cls: 'bg-red-900/90 border-red-700 text-red-200' },
  warning: { icon: AlertTriangle,  cls: 'bg-yellow-900/90 border-yellow-700 text-yellow-200' },
  info:    { icon: AlertTriangle,  cls: 'bg-blue-900/90 border-blue-700 text-blue-200' },
};

let _nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, durationMs = 4000) => {
    const id = ++_nextId;
    setToasts(prev => [...prev, { id, type, message }]);
    const timer = setTimeout(() => dismiss(id), durationMs);
    timers.current.set(id, timer);
  }, [dismiss]);

  return { toasts, toast, dismiss };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

export function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const { icon: Icon, cls } = CFG[t.type];
        return (
          <div key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-sm pointer-events-auto ${cls}`}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="text-sm flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer transition-opacity">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Modal de confirmación simple — reemplaza window.confirm()
interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmModal({ message, onConfirm, onCancel, danger = false }: ConfirmModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${danger ? 'text-red-400' : 'text-yellow-400'}`} />
          <p className="text-white text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-semibold cursor-pointer transition-colors text-white ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'
            }`}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
