import { useState } from 'react';
import { ArrowRight, CalendarCheck, Loader2 } from 'lucide-react';
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
    <section className="bg-[#1A5A96] py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">

          {/* Left: icon + text */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white mb-1">Únete a la beta privada</h3>
              <p className="text-white/65 text-sm leading-relaxed max-w-xs">
                Sé de los primeros en probar TradeFlow AI y ayúdanos a construir la mejor herramienta para instaladores.
              </p>
            </div>
          </div>

          {/* Right: form */}
          <div className="w-full md:w-auto md:min-w-[320px]">
            {done ? (
              <div className="text-center py-3">
                <p className="text-white font-bold text-base">¡Apuntado! 🎉</p>
                <p className="text-white/60 text-sm mt-1">Te avisaremos cuando tu acceso esté listo.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Tu email"
                    required
                    className="flex-1 bg-white rounded-xl px-4 py-3 text-sm text-[#1C2535] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="shrink-0 bg-[#1C2535] hover:bg-[#0F1720] text-white font-bold text-sm px-5 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Solicitar acceso <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
                {error && <p className="text-red-300 text-xs">{error}</p>}
                <p className="text-white/35 text-xs text-center">
                  Al solicitar acceso, aceptas nuestra{' '}
                  <span className="underline cursor-pointer">Política de Privacidad</span>.
                </p>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
