import { useState, useEffect } from 'react';
import { getFinancialDocumentPublic, type TradeFinancialDocument } from '../lib/supabase';
import { buildAdDocumentHtml } from '../lib/printAdDocument';

interface Props {
  token: string;
}

export default function FinDocPublicView({ token }: Props) {
  const [doc, setDoc] = useState<TradeFinancialDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    getFinancialDocumentPublic(token)
      .then(d => { if (d) setDoc(d); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020B16' }}>
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Cargando documento…</div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020B16', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Documento no encontrado</div>
        <div style={{ color: '#64748b', fontSize: 13 }}>El enlace puede ser inválido o haber caducado.</div>
        <a href="https://trabflow.com" style={{ color: '#7c3aed', fontSize: 13 }}>Ir a TrabFlow →</a>
      </div>
    );
  }

  const html = buildAdDocumentHtml(doc);

  return (
    <iframe
      srcDoc={html}
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
      title={`Documento ${doc.doc_number}`}
    />
  );
}
