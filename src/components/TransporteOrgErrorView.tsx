import React from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';

interface Props {
  onRetry: () => void;
  onLogout: () => void;
}

export default function TransporteOrgErrorView({ onRetry, onLogout }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
      <h1 className="text-xl font-semibold text-gray-800 mb-2">
        Error al configurar tu cuenta
      </h1>
      <p className="text-gray-500 max-w-sm mb-6 text-sm">
        No se pudo crear tu organización de Transporte. Esto puede deberse a un
        problema temporal de conexión. Puedes reintentar ahora o volver a intentarlo
        más tarde.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
        <button
          onClick={onLogout}
          className="flex-1 flex items-center justify-center gap-2 border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-6">
        Si el problema persiste, contacta con soporte en{' '}
        <span className="font-medium">info@trabflow.com</span>
      </p>
    </div>
  );
}
