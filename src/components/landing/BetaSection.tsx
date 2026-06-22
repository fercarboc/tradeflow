import { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { submitWaitlist } from '../../lib/supabase';

export default function BetaSection() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await submitWaitlist({ nombre: 'Waitlist', email: email.trim() });
      setDone(true);
    } catch {
      setError('Ha ocurrido un error. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#1C2535] py-20 lg:py-28">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-[#C8922A]/20 text-[#E8B05A] text-xs font-bold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C8922A] animate-pulse" />
          Acceso anticipado · 3 meses gratis
        </div>

        <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 leading-tight">
          Únete a la beta privada
        </h2>
        <p className="text-[#8A9BB5] leading-relaxed mb-10">
          Sé de los primeros instaladores en usar TrabFlow. Acceso completo sin coste durante la beta. Sin tarjeta de crédito.
        </p>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-[#4A6741]/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#4A6741]" />
            </div>
            <p className="text-white font-bold text-lg">¡Ya estás en la lista!</p>
            <p className="text-[#8A9BB5] text-sm">Te avisaremos en cuanto tu acceso esté listo.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#1A5A96] focus:ring-1 focus:ring-[#1A5A96] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex items-center justify-center gap-2 bg-[#1A5A96] text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#1A5A96]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Solicitar acceso
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        <p className="mt-5 text-xs text-white/25">
          Sin spam. Puedes darte de baja en cualquier momento. Consulta nuestra{' '}
          <span className="underline cursor-pointer hover:text-white/50 transition-colors">
            política de privacidad
          </span>
          .
        </p>

        <div className="mt-12 grid grid-cols-3 gap-6 pt-10 border-t border-white/10">
          {[
            { value: '3 meses', label: 'Prueba gratuita' },
            { value: '100%', label: 'Funciones completas' },
            { value: '0 €', label: 'Sin tarjeta de crédito' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-black text-white mb-1">{value}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
