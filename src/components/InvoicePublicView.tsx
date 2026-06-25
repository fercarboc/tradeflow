import { useState, useEffect } from 'react';
import { getInvoiceByViewToken } from '../lib/supabase';
import { buildInvoiceHtml } from '../lib/printTradeInvoice';
import { Loader2, XCircle } from 'lucide-react';

interface Props {
  token: string;
}

export default function InvoicePublicView({ token }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('Enlace no válido.'); setLoading(false); return; }
    getInvoiceByViewToken(token)
      .then(data => {
        if (!data) { setError('Factura no encontrada o enlace caducado.'); return; }
        const { invoice, org } = data;
        const lines = invoice.trade_invoice_lines ?? [];
        const invForPrint = {
          ...invoice,
          trade_clients: invoice.trade_clients
            ? { nombre: invoice.trade_clients.nombre }
            : null,
        };
        const orgForPrint = {
          nombre: org.nombre,
          razon_social: org.razon_social,
          nif: org.nif,
          cif: org.nif,
          direccion: org.direccion,
          ciudad: org.ciudad,
          telefono: org.telefono,
          email: org.email,
          logo_url: org.logo_url,
        };
        setHtml(buildInvoiceHtml(invForPrint, lines, orgForPrint));
      })
      .catch(() => setError('No se pudo cargar la factura.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="font-bold text-slate-800 text-sm">{error ?? 'Enlace no válido.'}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      className="w-full border-0"
      style={{ height: '100dvh' }}
      title="Factura"
    />
  );
}
