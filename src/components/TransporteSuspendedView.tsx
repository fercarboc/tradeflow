/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertOctagon, Phone, Mail, LogOut } from 'lucide-react';

interface TransporteSuspendedViewProps {
  onLogout: () => void;
}

export default function TransporteSuspendedView({ onLogout }: TransporteSuspendedViewProps) {
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
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <AlertOctagon className="h-8 w-8 text-red-400" aria-hidden="true" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-black text-white mb-2">
          Acceso suspendido
        </h1>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Tu acceso a <span className="font-bold text-white/80">TrabFlow Transporte</span> ha sido
          temporalmente suspendido. Contacta con el equipo para conocer el motivo o reactivar tu cuenta.
        </p>

        {/* Contact */}
        <div className="mb-8 rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="text-xs text-white/40 mb-3">Contacta con nosotros para resolverlo:</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-[#FFC400] shrink-0" aria-hidden="true" />
              <span className="font-bold text-white/80 select-all tracking-wider">672 336 572</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-[#FFC400] shrink-0" aria-hidden="true" />
              <span className="font-bold text-white/80 select-all">hola@trabflow.com</span>
            </div>
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
