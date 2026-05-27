import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';

interface AuthResetPasswordViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

type State = 'form' | 'sent' | 'loading';

export default function AuthResetPasswordView({ setCurrentPage }: AuthResetPasswordViewProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('form');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('loading');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://www.trabflow.com/update-password',
    });

    if (resetError) {
      setState('form');
      setError(resetError.message);
      return;
    }

    setState('sent');
  };

  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-white">Recuperar contraseña</h1>
          <p className="text-white/40 mt-1 text-sm">Te enviaremos un enlace para crear una nueva contraseña</p>
        </div>

        <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-8 shadow-2xl">
          {state === 'sent' ? (
            <div className="text-center py-4">
              <div className="flex justify-center mb-5">
                <div className="h-16 w-16 rounded-full bg-[#00CFE8]/10 flex items-center justify-center">
                  <svg className="h-8 w-8 text-[#00CFE8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-lg font-display font-bold text-white mb-2">Revisa tu email</h2>
              <p className="text-white/40 text-sm mb-6">
                Hemos enviado un enlace de recuperación a{' '}
                <span className="text-white font-medium">{email}</span>.
                El enlace expira en 1 hora.
              </p>
              <p className="text-white/25 text-xs">¿No lo ves? Revisa la carpeta de spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Email de tu cuenta
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#00CFE8] focus:border-transparent transition"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-red-400">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full py-3 px-4 bg-[#00CFE8] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[#020B16] font-bold rounded-xl transition flex items-center justify-center gap-2"
              >
                {state === 'loading' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enviando…
                  </>
                ) : 'Enviar enlace de recuperación'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <button
              onClick={() => setCurrentPage(ActivePage.Login)}
              className="text-sm text-white/40 hover:text-white/70 transition flex items-center justify-center gap-1 mx-auto"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver al login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
