// Ajustes → Legal y privacidad: acceso a textos legales y preferencias de cookies.
import { FileText, ShieldCheck, Cookie, ScrollText, Sparkles, ChevronRight, SlidersHorizontal } from 'lucide-react';

const LINKS = [
  { href: '/aviso-legal', title: 'Aviso legal', icon: <FileText className="w-5 h-5" /> },
  { href: '/privacidad', title: 'Política de privacidad', icon: <ShieldCheck className="w-5 h-5" /> },
  { href: '/cookies', title: 'Política de cookies', icon: <Cookie className="w-5 h-5" /> },
  { href: '/terminos', title: 'Términos y condiciones', icon: <ScrollText className="w-5 h-5" /> },
  { href: '/ia-disclaimer', title: 'Uso de la inteligencia artificial', icon: <Sparkles className="w-5 h-5" /> },
];

export default function LegalLinksCard({ onCookiePreferences }: { onCookiePreferences?: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" data-testid="legal-links">
      <div className="px-5 pt-5 pb-3 border-b border-slate-100">
        <h3 className="font-black uppercase text-xs text-slate-700 tracking-wide">Legal y privacidad</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">Textos legales de TrabFlow y tus preferencias de cookies</p>
      </div>
      <div className="divide-y divide-slate-100">
        {LINKS.map(l => (
          <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-4 active:bg-slate-50">
            <span className="text-slate-500">{l.icon}</span>
            <span className="flex-1 text-base font-semibold text-slate-800">{l.title}</span>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </a>
        ))}
        {onCookiePreferences && (
          <button type="button" onClick={onCookiePreferences} className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-slate-50 cursor-pointer">
            <span className="text-slate-500"><SlidersHorizontal className="w-5 h-5" /></span>
            <span className="flex-1 text-base font-semibold text-slate-800">Configurar cookies</span>
            <ChevronRight className="w-5 h-5 text-slate-300" />
          </button>
        )}
      </div>
    </div>
  );
}
