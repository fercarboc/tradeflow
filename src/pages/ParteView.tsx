import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle, Clock, User, FileText } from 'lucide-react';
import { getParteInfo } from '../lib/supabase';
import type { ParteInfo } from '../lib/supabase';

type PageState = 'loading' | 'ready' | 'error';

export default function ParteView() {
  const token = window.location.pathname.split('/parte/')[1]?.split('/')[0] ?? '';

  const [state, setState] = useState<PageState>('loading');
  const [info, setInfo] = useState<ParteInfo | null>(null);

  useEffect(() => {
    if (!token) { setState('error'); return; }
    getParteInfo(token)
      .then(data => {
        if (!data) { setState('error'); return; }
        setInfo(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (state === 'error' || !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 font-semibold">Parte no encontrado o no disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-5">
      <div className="w-full max-w-sm space-y-5">

        {/* Cabecera empresa */}
        <div className="text-center space-y-2">
          {info.org_logo_url && (
            <img src={info.org_logo_url} alt={info.org_nombre} className="h-12 mx-auto object-contain" />
          )}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{info.org_nombre}</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
            </div>
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">Trabajo completado</p>
          </div>
        </div>

        {/* Datos del trabajo */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Parte de trabajo</p>
                <p className="text-base font-black text-gray-900 leading-snug">{info.job_titulo}</p>
              </div>
            </div>
          </div>

          {(info.cliente_nombre || info.job_fecha || info.job_hora_fin) && (
            <div className="px-5 py-3 space-y-2 border-b border-gray-100">
              {info.cliente_nombre && (
                <div className="flex items-center gap-2.5">
                  <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700">{info.cliente_nombre}</span>
                </div>
              )}
              {(info.job_fecha || info.job_hora_fin) && (
                <div className="flex items-center gap-2.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-500">
                    {[info.job_fecha, info.job_hora_fin].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {info.job_notas && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Descripción del trabajo</p>
              <p className="text-sm text-gray-700 leading-relaxed">{info.job_notas}</p>
            </div>
          )}

          {/* Firma del cliente */}
          {info.firma_url ? (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Conformidad del cliente</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-3">
                <img
                  src={info.firma_url}
                  alt="Firma del cliente"
                  className="w-full max-h-28 object-contain"
                />
              </div>
              {info.cliente_nombre && (
                <p className="text-center text-xs text-gray-400 mt-2 font-medium">{info.cliente_nombre}</p>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-[11px] font-bold text-emerald-600">Trabajo aceptado y firmado</p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 text-center">
              <p className="text-xs text-gray-400">Sin firma de conformidad registrada</p>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300">
          Powered by <span className="font-bold">TRABFLOW</span>
        </p>
      </div>
    </div>
  );
}
