/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Bus, Clock, Phone, Mail, LogOut, CheckCircle, RefreshCw } from 'lucide-react';

interface TransportePendingViewProps {
  onLogout: () => void;
  /** Called when user clicks "Comprobar activación" or when polling detects change. */
  onCheck?: () => void;
}

const POLL_INTERVAL_MS = 60_000;

export default function TransportePendingView({ onLogout, onCheck }: TransportePendingViewProps) {
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!onCheck) return;
    intervalRef.current = setInterval(() => {
      onCheck();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onCheck]);

  const handleCheck = async () => {
    if (!onCheck || checking) return;
    setChecking(true);
    try { onCheck(); }
    finally { setTimeout(() => setChecking(false), 1500); }
  };

  return (
    <div className="min-h-screen bg-[#020B16] flex flex-col items-center justify-center px-4 font-sans">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <img src="/tradeflow.png" alt="TRABFLOW" className="h-7 w-auto" />
        <span className="text-[#FFC400] font-black tracking-widest uppercase text-sm">TRABFLOW</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117] p-8 shadow-[0_0_48px_-12px_rgba(0,0,0,0.8)] text-center">

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#FFC400]/30 bg-[#FFC400]/10">
          <Bus className="h-8 w-8 text-[#FFC400]" aria-hidden="true" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-black text-white mb-2">
          Solicitud recibida
        </h1>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Tu solicitud de acceso a <span className="font-bold text-white/80">TrabFlow Transporte</span> está siendo procesada.
          El equipo activará tu cuenta en las próximas horas.
        </p>

        {/* Pilot info */}
        <div className="mb-6 rounded-xl border border-[#FFC400]/20 bg-[#FFC400]/5 px-5 py-4 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[#FFC400] shrink-0" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-widest text-[#FFC400]">Fase piloto</span>
          </div>
          <ul className="space-y-2">
            {[
              'Acceso sin coste durante la fase piloto',
              'Activación manual por el equipo TrabFlow',
              'Sin permanencia ni compromiso',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-white/60">
                <CheckCircle className="h-4 w-4 text-[#FFC400] shrink-0 mt-0.5" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Check activation button */}
        {onCheck && (
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#FFC400]/10 border border-[#FFC400]/30 px-5 py-2.5 text-sm font-bold text-[#FFC400] transition hover:bg-[#FFC400]/20 disabled:opacity-50 cursor-pointer mb-4"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
            {checking ? 'Comprobando…' : 'Comprobar activación'}
          </button>
        )}

        {/* Contact */}
        <p className="text-xs text-white/40 mb-4">
          ¿Tienes dudas? Escríbenos o llámanos directamente:
        </p>
        <div className="flex flex-col gap-2 mb-8">
          <div className="flex items-center justify-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-[#FFC400] shrink-0" aria-hidden="true" />
            <span className="font-bold text-white/80 select-all tracking-wider">672 336 572</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-[#FFC400] shrink-0" aria-hidden="true" />
            <span className="font-bold text-white/80 select-all">hola@trabflow.com</span>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/60 transition hover:border-white/25 hover:text-white cursor-pointer"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>

    </div>
  );
}
