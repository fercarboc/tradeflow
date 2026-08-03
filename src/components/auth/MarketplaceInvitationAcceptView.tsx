import { useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { ActivePage } from '../../types';
import {
  previewMarketplaceInvitation,
  acceptMarketplaceInvitation,
  type InvitationPreview,
} from '../../lib/api/marketplace-actors';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
}

// ── Estado de la vista ────────────────────────────────────────────────────────

type ViewState =
  | 'validating'       // llamando a preview_marketplace_invitation
  | 'unauthenticated'  // invitación válida, sin sesión → mostrar formulario
  | 'authenticated'    // invitación válida, sesión con email correcto → CTA aceptar
  | 'accepting'        // llamando a accept_marketplace_invitation
  | 'accepted'         // aceptado con éxito → redirigir a /proveedor
  | 'email_pending'    // signUp sin confirmación → pedir confirmar email
  | 'expired'
  | 'revoked'
  | 'already_accepted'
  | 'invalid_token'
  | 'error';

type FormMode = 'new' | 'login';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-8 w-8 text-[#00CFE8] mx-auto" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-9" />
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1f38] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
      {children}
    </div>
  );
}

function InvitationHeader({ preview }: { preview: InvitationPreview }) {
  return (
    <div className="bg-[#00CFE8]/10 border-b border-white/10 px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#00CFE8] mb-1">
        Invitación al Portal Proveedor
      </p>
      <p className="text-white font-semibold text-lg leading-snug">
        {preview.actor_nombre}
      </p>
      {preview.role_nombre && (
        <p className="text-white/50 text-sm mt-0.5">{preview.role_nombre}</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MarketplaceInvitationAcceptView({ setCurrentPage, session }: Props) {
  const [viewState, setViewState] = useState<ViewState>('validating');
  const [preview, setPreview]     = useState<InvitationPreview | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string>('');
  const [formMode, setFormMode]   = useState<FormMode>('new');

  // Form fields
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  // ── Token desde URL ────────────────────────────────────────────────────────

  const rawToken = new URLSearchParams(window.location.search).get('token') ?? '';

  // ── Paso 1: preview (sin auth) ─────────────────────────────────────────────

  useEffect(() => {
    if (!rawToken) {
      setViewState('invalid_token');
      return;
    }

    previewMarketplaceInvitation(rawToken)
      .then((inv) => {
        setPreview(inv);
        switch (inv.estado) {
          case 'expired':         setViewState('expired');         break;
          case 'revoked':         setViewState('revoked');         break;
          case 'already_accepted': setViewState('already_accepted'); break;
          case 'invalid_token':   setViewState('invalid_token');   break;
          case 'valid':
            // Determinar si el usuario ya tiene sesión con el email correcto
            if (session) {
              const sessionEmail = session.user.email?.toLowerCase().trim() ?? '';
              const invEmail     = (inv.email ?? '').toLowerCase().trim();
              if (sessionEmail === invEmail) {
                setViewState('authenticated');
              } else {
                setErrorMsg(
                  `Tu cuenta activa (${session.user.email}) no coincide con el email de la invitación (${inv.email}). Cierra sesión y usa el enlace desde la cuenta correcta.`,
                );
                setViewState('error');
              }
            } else {
              setViewState('unauthenticated');
            }
            break;
          default:
            setViewState('error');
            setErrorMsg('Estado de invitación desconocido.');
        }
      })
      .catch((err) => {
        setViewState('error');
        setErrorMsg(err?.message ?? 'Error desconocido al verificar la invitación.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawToken]);

  // ── Paso 3: aceptar invitación (ya autenticado) ───────────────────────────

  const doAccept = useCallback(async () => {
    setViewState('accepting');
    try {
      await acceptMarketplaceInvitation(rawToken);
      setViewState('accepted');
      setTimeout(() => setCurrentPage(ActivePage.PortalProveedor), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setViewState('error');
    }
  }, [rawToken, setCurrentPage]);

  // ── Formulario: nuevo usuario ─────────────────────────────────────────────

  const doSignUp = useCallback(async () => {
    setFormError(null);
    if (!name.trim()) { setFormError('Introduce tu nombre.'); return; }
    if (password.length < 8) { setFormError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setFormError('Las contraseñas no coinciden.'); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email:    preview!.email!,
        password,
        options:  { data: { full_name: name.trim() } },
      });
      if (error) throw error;

      if (data.session) {
        // Sin confirmación de email → aceptar inmediatamente
        await acceptMarketplaceInvitation(rawToken);
        setViewState('accepted');
        setTimeout(() => setCurrentPage(ActivePage.PortalProveedor), 2500);
      } else {
        // Supabase requiere confirmar email antes de tener sesión
        setViewState('email_pending');
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [name, password, confirm, preview, rawToken, setCurrentPage]);

  // ── Formulario: usuario existente ─────────────────────────────────────────

  const doLogin = useCallback(async () => {
    setFormError(null);
    if (!password) { setFormError('Introduce tu contraseña.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email:    preview!.email!,
        password,
      });
      if (error) throw error;
      // signInWithPassword actualiza la sesión → aceptar
      await acceptMarketplaceInvitation(rawToken);
      setViewState('accepted');
      setTimeout(() => setCurrentPage(ActivePage.PortalProveedor), 2500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [password, preview, rawToken, setCurrentPage]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'new') doSignUp();
    else doLogin();
  };

  // ── Renders por estado ────────────────────────────────────────────────────

  if (viewState === 'validating') {
    return (
      <Shell>
        <Card>
          <div className="p-10 text-center">
            <Spinner />
            <p className="text-white/50 text-sm mt-4">Verificando invitación…</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'accepting') {
    return (
      <Shell>
        <Card>
          <div className="p-10 text-center">
            <Spinner />
            <p className="text-white/50 text-sm mt-4">Aceptando invitación…</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'accepted') {
    return (
      <Shell>
        <Card>
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-1">¡Bienvenido al portal!</p>
            <p className="text-white/50 text-sm">Accediendo a tu panel de proveedor…</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'email_pending') {
    return (
      <Shell>
        <Card>
          {preview && <InvitationHeader preview={preview} />}
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[#00CFE8]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#00CFE8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg mb-2">Confirma tu correo</p>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Hemos enviado un enlace de confirmación a{' '}
              <span className="text-white font-medium">{preview?.email}</span>.
              Haz clic en él y después vuelve a este enlace para iniciar sesión y completar la aceptación.
            </p>
            <button
              onClick={() => { setFormMode('login'); setViewState('unauthenticated'); }}
              className="text-[#00CFE8] text-sm hover:underline"
            >
              Ya confirmé mi correo → iniciar sesión
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'expired') {
    return (
      <Shell>
        <Card>
          <div className="p-8 text-center">
            <StatusIcon color="amber" icon="clock" />
            <p className="text-white font-semibold text-lg mb-2">Invitación caducada</p>
            <p className="text-white/60 text-sm">Este enlace ha caducado. Pide al administrador que te envíe una nueva invitación.</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'revoked') {
    return (
      <Shell>
        <Card>
          <div className="p-8 text-center">
            <StatusIcon color="red" icon="ban" />
            <p className="text-white font-semibold text-lg mb-2">Invitación revocada</p>
            <p className="text-white/60 text-sm">Este enlace ha sido cancelado. Contacta con el administrador del portal.</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'already_accepted') {
    return (
      <Shell>
        <Card>
          <div className="p-8 text-center">
            <StatusIcon color="cyan" icon="check" />
            <p className="text-white font-semibold text-lg mb-2">Invitación ya aceptada</p>
            <p className="text-white/60 text-sm mb-6">Esta invitación ya fue usada anteriormente.</p>
            <button
              onClick={() => setCurrentPage(ActivePage.PortalProveedor)}
              className="px-5 py-2.5 bg-[#00CFE8] hover:bg-[#00b8d0] text-[#020B16] font-semibold rounded-xl text-sm transition"
            >
              Ir al portal
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'invalid_token') {
    return (
      <Shell>
        <Card>
          <div className="p-8 text-center">
            <StatusIcon color="red" icon="x" />
            <p className="text-white font-semibold text-lg mb-2">Enlace inválido</p>
            <p className="text-white/60 text-sm">Este enlace de invitación no es válido. Comprueba que copiaste la URL completa.</p>
          </div>
        </Card>
      </Shell>
    );
  }

  if (viewState === 'error') {
    return (
      <Shell>
        <Card>
          <div className="p-8 text-center">
            <StatusIcon color="red" icon="x" />
            <p className="text-white font-semibold text-lg mb-2">Error</p>
            <p className="text-white/60 text-sm">{errorMsg || 'Se produjo un error inesperado.'}</p>
          </div>
        </Card>
      </Shell>
    );
  }

  // ── authenticated ─────────────────────────────────────────────────────────

  if (viewState === 'authenticated') {
    return (
      <Shell>
        <Card>
          {preview && <InvitationHeader preview={preview} />}
          <div className="p-8">
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              Has iniciado sesión como{' '}
              <span className="text-white font-medium">{session?.user.email}</span>.
              Pulsa el botón para unirte al portal de{' '}
              <span className="text-white font-medium">{preview?.actor_nombre}</span>.
            </p>
            <button
              onClick={doAccept}
              className="w-full py-3 bg-[#00CFE8] hover:bg-[#00b8d0] text-[#020B16] font-bold rounded-xl text-sm transition"
            >
              Aceptar invitación
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  // ── unauthenticated ───────────────────────────────────────────────────────

  return (
    <Shell>
      <Card>
        {preview && <InvitationHeader preview={preview} />}

        {/* Mode tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => { setFormMode('new'); setFormError(null); }}
            className={`flex-1 py-3 text-sm font-medium transition ${
              formMode === 'new'
                ? 'text-[#00CFE8] border-b-2 border-[#00CFE8]'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Crear cuenta
          </button>
          <button
            onClick={() => { setFormMode('login'); setFormError(null); }}
            className={`flex-1 py-3 text-sm font-medium transition ${
              formMode === 'login'
                ? 'text-[#00CFE8] border-b-2 border-[#00CFE8]'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Ya tengo cuenta
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          {/* Email bloqueado */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
              Correo electrónico
            </label>
            <input
              type="email"
              value={preview?.email ?? ''}
              readOnly
              tabIndex={-1}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white/40 text-sm cursor-not-allowed select-none"
            />
          </div>

          {/* Nombre — solo en modo nuevo */}
          {formMode === 'new' && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Tu nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre y apellidos"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#00CFE8]/60 focus:ring-1 focus:ring-[#00CFE8]/30 transition"
              />
            </div>
          )}

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={formMode === 'new' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
                autoFocus={formMode === 'login'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#00CFE8]/60 focus:ring-1 focus:ring-[#00CFE8]/30 transition pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                tabIndex={-1}
              >
                {showPwd ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña — solo en modo nuevo */}
          {formMode === 'new' && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wide">
                Confirmar contraseña
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#00CFE8]/60 focus:ring-1 focus:ring-[#00CFE8]/30 transition"
              />
            </div>
          )}

          {formError && (
            <p className="text-red-400 text-sm bg-red-400/10 rounded-xl px-4 py-3">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#00CFE8] hover:bg-[#00b8d0] disabled:opacity-50 text-[#020B16] font-bold rounded-xl text-sm transition mt-1"
          >
            {submitting
              ? 'Procesando…'
              : formMode === 'new'
                ? 'Crear cuenta y aceptar invitación'
                : 'Iniciar sesión y aceptar invitación'}
          </button>

          <p className="text-white/30 text-xs text-center pt-1">
            El acceso queda registrado con fines de seguridad y auditoría.
          </p>
        </form>
      </Card>
    </Shell>
  );
}

// ── StatusIcon helper ─────────────────────────────────────────────────────────

function StatusIcon({ color, icon }: { color: 'cyan' | 'amber' | 'red'; icon: 'check' | 'clock' | 'ban' | 'x' }) {
  const bg = color === 'cyan' ? 'bg-[#00CFE8]/10' : color === 'amber' ? 'bg-amber-500/10' : 'bg-red-500/10';
  const fg = color === 'cyan' ? 'text-[#00CFE8]' : color === 'amber' ? 'text-amber-400' : 'text-red-400';
  return (
    <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center mx-auto mb-4`}>
      <svg className={`w-7 h-7 ${fg}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon === 'check' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        )}
        {icon === 'clock' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
        {icon === 'ban' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        )}
        {icon === 'x' && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        )}
      </svg>
    </div>
  );
}
