import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';

interface AuthCallbackViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function AuthCallbackView({ setCurrentPage }: AuthCallbackViewProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const token_hash = params.get('token_hash');
    const type = params.get('type');
    const errorParam = params.get('error_description') || params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    // PKCE flow: intercambia el code por una sesión
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        routeAfterSession(type, data.session?.user?.user_metadata, setCurrentPage);
      });
      return;
    }

    // token_hash flow (invitaciones, magic link)
    if (token_hash && type) {
      supabase.auth
        .verifyOtp({ token_hash, type: type as 'invite' | 'signup' | 'recovery' | 'email' })
        .then(({ error: err }) => {
          if (err) { setError(err.message); return; }
          routeAfterSession(type, undefined, setCurrentPage);
        });
      return;
    }

    // Sin parámetros válidos — espera el evento onAuthStateChange del hash implícito
    const timer = setTimeout(() => {
      // Si en 3s no llegó nada, ir al login
      setCurrentPage(ActivePage.Login);
    }, 3000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-red-500/15 flex items-center justify-center">
                <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-display font-bold text-white mb-2">Error de autenticación</h2>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button
              onClick={() => setCurrentPage(ActivePage.Login)}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition"
            >
              Ir al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 shadow-2xl">
          <div className="flex justify-center mb-5">
            <svg className="animate-spin h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-2">Procesando…</h2>
          <p className="text-slate-400 text-sm">Verificando tu sesión, un momento.</p>
        </div>
      </div>
    </div>
  );
}

function routeAfterSession(
  type: string | null,
  _meta: Record<string, unknown> | undefined,
  setCurrentPage: (p: ActivePage) => void,
) {
  if (type === 'recovery') {
    setCurrentPage(ActivePage.UpdatePassword);
  } else if (type === 'invite' || type === 'signup') {
    setCurrentPage(ActivePage.UpdatePassword);
  } else {
    setCurrentPage(ActivePage.AppDashboard);
  }
}
