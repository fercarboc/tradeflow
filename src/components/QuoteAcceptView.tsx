import { useState, useEffect } from 'react';
import { getQuoteByToken, respondQuoteToken } from '../lib/supabase';
import type { QuoteToken } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, FileText, Loader2 } from 'lucide-react';

interface Props {
  token: string;
}

function fmtEur(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export default function QuoteAcceptView({ token }: Props) {
  const [record, setRecord] = useState<QuoteToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuoteByToken(token)
      .then(r => setRecord(r))
      .catch(() => setError('No se pudo cargar el presupuesto.'))
      .finally(() => setLoading(false));
  }, [token]);

  const respond = async (action: 'accepted' | 'rejected') => {
    setActing(true);
    try {
      await respondQuoteToken(token, action);
      setDone(action);
      setRecord(prev => prev ? { ...prev, status: action } : prev);
    } catch {
      setError('Error al procesar la respuesta. Inténtalo de nuevo.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="font-bold text-slate-800 text-sm">{error ?? 'Enlace no válido o caducado.'}</p>
        </div>
      </div>
    );
  }

  const quote = record.quote_data as {
    id: string;
    nombreCliente: string;
    descripcion: string;
    partidas: Array<{ descripcion: string; tipo: string; cantidad: number; precioUnitario: number; total: number }>;
    total: number;
    fecha: string;
    empresa: string;
    emailEmpresa?: string;
    telefonoEmpresa?: string;
  };

  const status = done ?? record.status;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-5">

        {/* Header empresa */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Presupuesto</p>
          <h1 className="text-lg font-black text-slate-900">{quote.empresa ?? 'TradeFlow'}</h1>
          {quote.emailEmpresa && <p className="text-xs text-slate-500 mt-0.5">{quote.emailEmpresa}</p>}
          {quote.telefonoEmpresa && <p className="text-xs text-slate-500">{quote.telefonoEmpresa}</p>}
        </div>

        {/* Detalle del presupuesto */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-mono">Nº {quote.id}</p>
              <p className="text-xs text-slate-500 mt-0.5">{quote.fecha}</p>
            </div>
            <FileText className="w-5 h-5 text-slate-300" />
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <p className="text-xs font-bold text-slate-500 mb-0.5">Cliente</p>
            <p className="text-sm font-semibold text-slate-900">{quote.nombreCliente}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 mb-0.5">Descripción</p>
            <p className="text-sm text-slate-700">{quote.descripcion}</p>
          </div>

          {/* Partidas */}
          <div className="h-px bg-slate-100" />
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="text-left pb-2">Concepto</th>
                <th className="text-right pb-2">Cant.</th>
                <th className="text-right pb-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(quote.partidas ?? []).map((p, i) => (
                <tr key={i}>
                  <td className="py-2 text-slate-700 pr-4">{p.descripcion}</td>
                  <td className="py-2 text-right text-slate-500 whitespace-nowrap">{p.cantidad}</td>
                  <td className="py-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{fmtEur(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="h-px bg-slate-200" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-black text-slate-900 uppercase tracking-wide">Total</span>
            <span className="text-lg font-black text-slate-900">{fmtEur(quote.total ?? 0)}</span>
          </div>
        </div>

        {/* Acciones o estado */}
        {status === 'pending' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-3">
            <p className="text-xs text-slate-500 text-center">
              Al aceptar este presupuesto confirmas tu conformidad con las condiciones detalladas.
            </p>
            <button
              onClick={() => respond('accepted')}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-wide cursor-pointer transition-colors disabled:opacity-60"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Acepto el presupuesto
            </button>
            <button
              onClick={() => respond('rejected')}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl text-sm uppercase tracking-wide cursor-pointer transition-colors disabled:opacity-60"
            >
              <XCircle className="w-4 h-4" />
              Rechazar
            </button>
          </div>
        )}

        {status === 'accepted' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-black text-emerald-800 text-sm uppercase tracking-wide">Presupuesto aceptado</p>
            <p className="text-xs text-emerald-600 mt-1">El instalador recibirá la confirmación. Gracias.</p>
          </div>
        )}

        {status === 'rejected' && (
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center">
            <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="font-black text-slate-700 text-sm uppercase tracking-wide">Presupuesto rechazado</p>
            <p className="text-xs text-slate-500 mt-1">El instalador ha sido notificado. Puedes contactarle para discutir las condiciones.</p>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 pb-4">Gestionado con TradeFlow · trabflow.com</p>
      </div>
    </div>
  );
}
