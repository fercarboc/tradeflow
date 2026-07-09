import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ActivePage } from '../../types';

interface NavbarProps {
  setCurrentPage: (page: ActivePage) => void;
}

const NAV_LINKS = [
  { label: 'Funciones', page: ActivePage.ComoFunciona },
  { label: 'Precios', page: ActivePage.Precios },
  { label: 'Asistente IA', page: ActivePage.AsisTecnico },
  { label: 'Herramientas', page: ActivePage.Herramientas },
  { label: 'Contacto', page: ActivePage.Contacto },
];

export default function Navbar({ setCurrentPage }: NavbarProps) {
  const [open, setOpen] = useState(false);

  const goTo = (page: ActivePage) => {
    setCurrentPage(page);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer shrink-0"
          onClick={() => goTo(ActivePage.Home)}
        >
          <img src="/tradeflow.png" alt="TRABFLOW" className="h-7 w-auto" />
          <span className="font-black text-[#1C2535] text-base tracking-widest uppercase">TRABFLOW</span>
          <span className="text-[10px] font-bold bg-[#1A5A96]/10 text-[#1A5A96] px-1.5 py-0.5 rounded-full leading-none">
            AI
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ label, page }) => (
            <button
              key={page}
              onClick={() => goTo(page)}
              className="text-sm font-medium text-[#1C2535]/60 hover:text-[#1C2535] transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => goTo(ActivePage.Login)}
            className="text-sm font-semibold text-[#1C2535] border border-[#1C2535]/20 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => goTo(ActivePage.Registro)}
            className="text-sm font-bold text-white bg-[#1A5A96] rounded-lg px-5 py-2.5 hover:bg-[#1A5A96]/90 transition-all cursor-pointer shadow-md hover:shadow-lg"
          >
            Empezar gratis
          </button>
        </div>

        <button
          className="md:hidden text-[#1C2535] p-1"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ label, page }) => (
            <button
              key={page}
              onClick={() => goTo(page)}
              className="block w-full text-left text-sm font-medium text-[#1C2535]/70 py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {label}
            </button>
          ))}
          <div className="pt-3 space-y-2 border-t border-gray-100 mt-2">
            <button
              onClick={() => goTo(ActivePage.Login)}
              className="w-full text-sm font-semibold text-[#1C2535] border border-[#1C2535]/20 rounded-lg py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => goTo(ActivePage.Registro)}
              className="w-full text-sm font-bold text-white bg-[#1A5A96] rounded-lg py-2.5 cursor-pointer hover:bg-[#1A5A96]/90 transition-colors"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
