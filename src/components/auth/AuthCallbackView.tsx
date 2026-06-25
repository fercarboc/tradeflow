import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';

interface AuthCallbackViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function AuthCallbackView({ setCurrentPage }: AuthCallbackViewProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Capture hash immediately — Supabase may clear it before next tick
    const rawHash = window.location.hash;
    const hashParams = rawHash ? new URLSearchParams(rawHash.slice(1)) : new URLSearchParams();

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const token_hash = params.get('token_hash');
    const type = params.get('type') ?? hashParams.get('type');
    const errorParam =
      params.get('error_description') ?? params.get('error') ??
      hashParams.get('error_description') ?? hashParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam.replace(/\+/g, ' ')));
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        routeAfterSession(type, data.session?.user?.user_metadata, setCurrentPage);
      });
      return;
    }

    if (token_hash && type) {
      supabase.auth
        .verifyOtp({ token_hash, type: type as 'invite' | 'signup' | 'recovery' | 'email' })
        .then(async ({ data, error: err }) => {
          if (err) { setError(err.message); return; }
          if (type === 'invite' && data.user) {
            await supabase.from('trade_org_members').update({ activo: true }).eq('user_id', data.user.id).eq('activo', false);
          }
          routeAfterSession(type, undefined, setCurrentPage);
        });
      return;
    }

    // Flujo implícito: Supabase procesa el hash de forma asíncrona.
    // Primero comprobamos si ya hay sesión activa (el hash pudo haberse procesado
    // antes de que este componente montase — común al hacer clic desde cliente de email).
    let routed = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (routed) return;
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && sess) {
        routed = true;
        subscription.unsubscribe();
        routeAfterSession(type, sess.user?.user_metadata, setCurrentPage);
        return;
      }
      if (event === 'INITIAL_SESSION' && !sess) {
        routed = true;
        subscription.unsubscribe();
        setTimeout(() => setCurrentPage(ActivePage.Login), 500);
      }
    });

    // Comprobación inmediata: si ya existe sesión en este momento (hash ya procesado),
    // onAuthStateChange puede no disparar SIGNED_IN de nuevo.
    supabase.auth.getSession().then(({ data }) => {
      if (routed) return;
      if (data.session) {
        routed = true;
        subscription.unsubscribe();
        routeAfterSession(type, data.session.user?.user_metadata, setCurrentPage);
      }
    });

    const fallback = setTimeout(() => {
      if (!routed) {
        routed = true;
        subscription.unsubscribe();
        setCurrentPage(ActivePage.Login);
      }
    }, 5000);

    return () => {
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
          <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-display font-bold text-white mb-2">Error de autenticación</h2>
            <p className="text-white/40 text-sm mb-6">{error}</p>
            <button
              onClick={() => setCurrentPage(ActivePage.Login)}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition"
            >
              Ir al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
        <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-10 shadow-2xl">
          <div className="flex justify-center mb-5">
            <svg className="animate-spin h-12 w-12 text-[#00CFE8]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-2">Procesando…</h2>
          <p className="text-white/40 text-sm">Verificando tu sesión, un momento.</p>
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
  if (type === 'recovery' || type === 'invite') {
    setCurrentPage(ActivePage.UpdatePassword);
  } else if (type === 'signup') {
    // Forzamos logout para que el usuario se logue manualmente y llegue al panel desktop
    localStorage.setItem('trabflow_email_confirmed', '1');
    supabase.auth.signOut().then(() => setCurrentPage(ActivePage.Login));
  } else {
    setCurrentPage(ActivePage.AppDashboard);
  }
}
