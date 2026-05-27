import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';

interface UpdatePasswordViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

type ScreenState = 'loading' | 'form' | 'success' | 'no-session';

export default function UpdatePasswordView({ setCurrentPage }: UpdatePasswordViewProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setScreen('form');
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')) {
            setScreen('form');
            subscription.unsubscribe();
          }
        });
        const timer = setTimeout(() => {
          subscription.unsubscribe();
          setScreen('no-session');
        }, 5000);
        return () => { clearTimeout(timer); subscription.unsubscribe(); };
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setScreen('success');
    setTimeout(() => setCurrentPage(ActivePage.AppDashboard), 2000);
  };

  const strengthLevel = getStrengthLevel(password);

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-[#00CFE8] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-white/40 text-sm">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (screen === 'no-session') {
    return (
      <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
          <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <svg className="h-8 w-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-display font-bold text-white mb-2">Sesión no encontrada</h2>
            <p className="text-white/40 text-sm mb-6">
              El enlace expiró o ya fue usado. Solicita un nuevo enlace de recuperación.
            </p>
            <button
              onClick={() => setCurrentPage(ActivePage.AuthResetPassword)}
              className="px-6 py-2.5 bg-[#00CFE8] hover:brightness-110 text-[#020B16] rounded-xl text-sm font-bold transition"
            >
              Recuperar contraseña
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'success') {
    return (
      <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
          <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-10 shadow-2xl">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-display font-bold text-white mb-2">¡Contraseña creada!</h2>
            <p className="text-white/40 text-sm">Accediendo a tu panel…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-white">Crea tu contraseña</h1>
          <p className="text-white/40 mt-1 text-sm">Elige una contraseña segura para tu cuenta</p>
        </div>

        <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#00CFE8] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strengthLevel
                            ? strengthLevel <= 1 ? 'bg-red-500'
                            : strengthLevel === 2 ? 'bg-amber-500'
                            : strengthLevel === 3 ? 'bg-yellow-400'
                            : 'bg-green-500'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/30">
                    {strengthLevel <= 1 ? 'Muy débil' : strengthLevel === 2 ? 'Débil' : strengthLevel === 3 ? 'Buena' : 'Muy segura'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                  confirm && confirm !== password
                    ? 'border-red-500/60 focus:ring-red-500'
                    : 'border-white/10 focus:ring-[#00CFE8]'
                }`}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden</p>
              )}
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
              disabled={submitting || !password || password !== confirm}
              className="w-full py-3 px-4 bg-[#00CFE8] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#020B16] font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando…
                </>
              ) : 'Guardar contraseña y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function getStrengthLevel(password: string): number {
  if (password.length < 6) return 1;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, score);
}
