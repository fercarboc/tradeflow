import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';

interface AuthActivateViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

type State = 'loading' | 'success' | 'error';

export default function AuthActivateView({ setCurrentPage }: AuthActivateViewProps) {
  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type') as 'invite' | 'signup' | 'recovery' | null;

    if (!token_hash || !type) {
      setState('error');
      setErrorMsg('Enlace inválido o incompleto. Solicita un nuevo enlace de invitación.');
      return;
    }

    supabase.auth
      .verifyOtp({ token_hash, type })
      .then(({ error }) => {
        if (error) {
          setState('error');
          setErrorMsg(translateError(error.message));
          return;
        }
        setState('success');
        // Pequeño delay para que el usuario vea el mensaje de éxito
        setTimeout(() => setCurrentPage(ActivePage.UpdatePassword), 1500);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 shadow-2xl">
          {state === 'loading' && (
            <>
              <div className="flex justify-center mb-5">
                <svg className="animate-spin h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">Activando tu cuenta</h2>
              <p className="text-slate-400 text-sm">Verificando tu invitación…</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="h-16 w-16 rounded-full bg-green-500/15 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">¡Cuenta activada!</h2>
              <p className="text-slate-400 text-sm">Ahora crea tu contraseña para acceder a TrabFlow.</p>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="flex justify-center mb-5">
                <div className="h-16 w-16 rounded-full bg-red-500/15 flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">Enlace inválido</h2>
              <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
              <button
                onClick={() => setCurrentPage(ActivePage.Login)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition"
              >
                Ir al login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes('expired')) return 'El enlace ha caducado. Solicita un nuevo enlace de invitación.';
  if (msg.includes('invalid')) return 'El enlace es inválido. Puede que ya haya sido usado.';
  if (msg.includes('Token has expired')) return 'El enlace ha caducado. Solicita uno nuevo.';
  return msg;
}
