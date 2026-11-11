// Ajustes → Cambiar contraseña del usuario que ha iniciado sesión.
import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function passwordProblem(nueva: string, repetir: string, actual: string): string | null {
  if (!actual) return 'Escribe tu contraseña actual';
  if (nueva.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres';
  if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) return 'Usa letras y números';
  if (nueva !== repetir) return 'Las contraseñas nuevas no coinciden';
  if (nueva === actual) return 'La nueva contraseña debe ser distinta de la actual';
  return null;
}

export default function ChangePasswordCard({ showToast, isLiveMode }: {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const problem = passwordProblem(nueva, repetir, actual);
    if (problem) { setError(problem); return; }
    setError('');
    if (!isLiveMode) { showToast('Contraseña cambiada (modo demo)', 'success'); setActual(''); setNueva(''); setRepetir(''); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setError('No se pudo identificar tu cuenta. Vuelve a iniciar sesión.'); return; }
      // Comprobar la contraseña actual antes de cambiarla
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: actual });
      if (authError) { setError('La contraseña actual no es correcta'); return; }
      const { error: updError } = await supabase.auth.updateUser({ password: nueva });
      if (updError) {
        const msg = updError.message.toLowerCase();
        setError(msg.includes('same') ? 'La nueva contraseña debe ser distinta de la actual'
          : msg.includes('weak') || msg.includes('short') ? 'La contraseña es demasiado débil'
          : 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
        return;
      }
      setActual(''); setNueva(''); setRepetir('');
      showToast('Contraseña cambiada ✓', 'success');
    } catch {
      setError('No se pudo cambiar la contraseña. Revisa tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base text-slate-900 focus:outline-none focus:border-blue-500';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" data-testid="change-password">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0"><KeyRound className="w-5 h-5 text-slate-600" /></div>
        <div>
          <h3 className="font-black uppercase text-xs text-slate-700 tracking-wide">Cambiar contraseña</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Mínimo 8 caracteres, con letras y números</p>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-600">Contraseña actual</span>
        <input className={inp} type={ver ? 'text' : 'password'} autoComplete="current-password" value={actual} onChange={e => setActual(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-600">Nueva contraseña</span>
        <input className={inp} type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={e => setNueva(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold text-slate-600">Repite la nueva contraseña</span>
        <input className={inp} type={ver ? 'text' : 'password'} autoComplete="new-password" value={repetir} onChange={e => setRepetir(e.target.value)} />
      </label>
      <button type="button" onClick={() => setVer(v => !v)} className="flex items-center gap-2 text-sm font-semibold text-slate-500 cursor-pointer">
        {ver ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {ver ? 'Ocultar' : 'Mostrar'} contraseñas
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-60 cursor-pointer">
        {saving ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </div>
  );
}
