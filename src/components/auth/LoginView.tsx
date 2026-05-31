import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';

interface LoginViewProps {
  setCurrentPage: (page: ActivePage) => void;
}

const supportsCredentials = () =>
  typeof window !== 'undefined' &&
  'credentials' in navigator &&
  typeof (window as any).PasswordCredential !== 'undefined';

export default function LoginView({ setCurrentPage }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('trabflow_email_confirmed')) {
      localStorage.removeItem('trabflow_email_confirmed');
      setEmailConfirmed(true);
    }
    // Intentar obtener credenciales guardadas silenciosamente
    if (supportsCredentials()) {
      (navigator.credentials as any)
        .get({ password: true, mediation: 'silent' })
        .then((cred: any) => {
          if (cred?.id) {
            setSavedEmail(cred.id);
            setBioAvailable(true);
            setEmail(cred.id);
            // Auto-login silencioso si hay credencial guardada
            doLogin(cred.id, cred.password).catch(() => {
              // Si falla el auto-login silencioso, solo pre-rellenar el email
            });
          } else if (supportsCredentials()) {
            // No hay credencial silenciosa, pero la API existe — mostrar botón
            setBioAvailable(true);
          }
        })
        .catch(() => {
          if (supportsCredentials()) setBioAvailable(true);
        });
    }
  }, []);

  const doLogin = async (emailVal: string, passwordVal: string) => {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: emailVal.trim(),
      password: passwordVal,
    });
    if (authError) throw authError;
  };

  const storeCredential = async (emailVal: string, passwordVal: string) => {
    if (!supportsCredentials()) return;
    try {
      const cred = new (window as any).PasswordCredential({
        id: emailVal,
        password: passwordVal,
        name: emailVal,
      });
      await navigator.credentials.store(cred);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await doLogin(email, password);
      await storeCredential(email.trim(), password);
    } catch (authError: any) {
      setError(translateError(authError.message ?? ''));
    }
    setLoading(false);
  };

  const handleBiometricLogin = async () => {
    if (!supportsCredentials()) return;
    setBioLoading(true);
    setError(null);
    try {
      const cred = await (navigator.credentials as any).get({
        password: true,
        mediation: 'required',
      });
      if (cred?.id && cred?.password) {
        await doLogin(cred.id, cred.password);
      } else {
        setError('No se encontraron credenciales guardadas.');
      }
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        setError('Autenticación cancelada o no disponible.');
      }
    }
    setBioLoading(false);
  };

  const isMobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-white">Accede a tu cuenta</h1>
          <p className="text-white/40 mt-1 text-sm">Gestiona tus presupuestos y obras desde aquí</p>
        </div>

        {emailConfirmed && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 text-sm text-emerald-400 mb-4">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>¡Email confirmado! Ya puedes iniciar sesión.</span>
          </div>
        )}

        {/* Botón biométrico — solo si hay API y es móvil o hay credencial guardada */}
        {bioAvailable && (isMobileUA || savedEmail) && (
          <button
            onClick={handleBiometricLogin}
            disabled={bioLoading}
            className="w-full mb-4 py-3.5 px-4 bg-[#0d1f38] border border-[#00CFE8]/30 hover:border-[#00CFE8]/60 rounded-2xl text-white font-bold flex items-center justify-center gap-3 transition-all disabled:opacity-50 cursor-pointer group"
          >
            {bioLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-[#00CFE8]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[#00CFE8]">Verificando...</span>
              </>
            ) : (
              <>
                {/* Fingerprint icon */}
                <svg className="h-6 w-6 text-[#00CFE8] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1C7.37 1 3.6 4.07 3.6 7.8c0 1.49.56 2.87 1.5 3.95M12 1c4.63 0 8.4 3.07 8.4 6.8 0 1.49-.56 2.87-1.5 3.95M12 1v0M8.1 19.5c-.33-1.18-.5-2.43-.5-3.7 0-2.43 1.97-4.4 4.4-4.4s4.4 1.97 4.4 4.4c0 1.79-.57 3.46-1.54 4.82M12 11.1v0M9.6 23c.07-2.3.9-4.4 2.23-6.06M14.4 23c-.34-1.54-1-2.95-1.92-4.13" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 12.5C4.56 11.32 4 9.83 4 8.2 4 4.22 7.58 1 12 1s8 3.22 8 7.2c0 1.63-.56 3.12-1.5 4.3M7 16.8c0-2.65 2.24-4.8 5-4.8s5 2.15 5 4.8c0 2.13-.97 4.03-2.5 5.2" />
                </svg>
                <div className="text-left">
                  <span className="block text-sm font-bold text-white">
                    {savedEmail ? `Entrar como ${savedEmail}` : 'Entrar con huella / Face ID'}
                  </span>
                  <span className="block text-[10px] text-white/40 font-normal">Acceso biométrico rápido</span>
                </div>
              </>
            )}
          </button>
        )}

        <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-8 shadow-2xl">
          {bioAvailable && (isMobileUA || savedEmail) && (
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-white/30 uppercase tracking-widest">o entra con email</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#00CFE8] focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
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
              disabled={loading}
              className="w-full py-3 px-4 bg-[#00CFE8] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[#020B16] font-bold rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-3">
            <button
              onClick={() => setCurrentPage(ActivePage.AuthResetPassword)}
              className="text-sm text-white/40 hover:text-[#00CFE8] transition"
            >
              ¿Olvidaste tu contraseña?
            </button>
            <div>
              <span className="text-white/30 text-sm">¿No tienes cuenta? </span>
              <button
                onClick={() => setCurrentPage(ActivePage.Registro)}
                className="text-sm text-[#00CFE8] hover:brightness-110 font-medium transition"
              >
                Regístrate gratis
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-white/20">
          © {new Date().getFullYear()} TrabFlow ·{' '}
          <button onClick={() => setCurrentPage(ActivePage.Privacidad)} className="hover:text-white/40 transition">
            Privacidad
          </button>
        </p>
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
  if (msg.includes('Too many requests')) return 'Demasiados intentos. Espera unos minutos.';
  return msg;
}
