import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ActivePage } from '../../types';

interface NavbarProps {
  setCurrentPage: (page: ActivePage) => void;
}

const NAV_LINKS = [
  { label: 'Funciones', page: ActivePage.ComoFunciona },
  { label: 'Marketplace', page: ActivePage.MarketplacePublico },
  { label: 'Proveedores', page: ActivePage.Proveedores },
  { label: 'Precios', page: ActivePage.Precios },
  { label: 'Asistente IA', page: ActivePage.AsisTecnico },
  { label: 'Herramientas', page: ActivePage.Herramientas },
  { label: 'Contacto', page: ActivePage.Contacto },
];

const MOBILE_MENU_ID = 'landing-mobile-menu';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] focus-visible:ring-offset-2';

// La navegación completa (7 enlaces + 2 botones) necesita ~1250 px: por debajo
// de xl se usa el menú desplegable.
export default function Navbar({ setCurrentPage }: NavbarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const goTo = (page: ActivePage) => {
    setCurrentPage(page);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          className={`flex items-center gap-2 cursor-pointer shrink-0 rounded-lg ${FOCUS_RING}`}
          onClick={() => goTo(ActivePage.Home)}
          aria-label="TrabFlow — ir al inicio"
        >
          <img src="/tradeflow.png" alt="" className="h-7 w-auto" />
          <span className="font-black text-[#1C2535] text-base tracking-widest uppercase">TRABFLOW</span>
          <span className="text-[10px] font-bold bg-[#1A5A96]/10 text-[#1A5A96] px-1.5 py-0.5 rounded-full leading-none">
            AI
          </span>
        </button>

        <nav className="hidden xl:flex items-center gap-7" aria-label="Navegación principal">
          {NAV_LINKS.map(({ label, page }) => (
            <button
              key={page}
              type="button"
              onClick={() => goTo(page)}
              className={`whitespace-nowrap rounded text-sm font-medium text-[#1C2535]/60 hover:text-[#1C2535] transition-colors cursor-pointer ${FOCUS_RING}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden xl:flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => goTo(ActivePage.Login)}
            className={`whitespace-nowrap text-sm font-semibold text-[#1C2535] border border-[#1C2535]/20 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer ${FOCUS_RING}`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => goTo(ActivePage.Registro)}
            className={`whitespace-nowrap text-sm font-bold text-white bg-[#1A5A96] rounded-lg px-5 py-2.5 hover:bg-[#1A5A96]/90 transition-all cursor-pointer shadow-md hover:shadow-lg ${FOCUS_RING}`}
          >
            Empezar gratis
          </button>
        </div>

        {/* Por debajo de xl: CTA principal visible (desde sm) + botón de menú */}
        <div className="flex items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => goTo(ActivePage.Registro)}
            className={`hidden sm:block whitespace-nowrap text-sm font-bold text-white bg-[#1A5A96] rounded-lg px-4 py-2 hover:bg-[#1A5A96]/90 transition-colors cursor-pointer ${FOCUS_RING}`}
          >
            Empezar gratis
          </button>
          <button
            type="button"
            className={`text-[#1C2535] p-2 rounded-lg hover:bg-gray-50 cursor-pointer ${FOCUS_RING}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
          >
            {open ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id={MOBILE_MENU_ID} className="xl:hidden bg-white border-t border-gray-100">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" aria-label="Navegación principal">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {NAV_LINKS.map(({ label, page }) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => goTo(page)}
                  className={`block w-full text-left text-sm font-medium text-[#1C2535]/70 py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${FOCUS_RING}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="pt-3 mt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => goTo(ActivePage.Login)}
                className={`w-full text-sm font-semibold text-[#1C2535] border border-[#1C2535]/20 rounded-lg py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${FOCUS_RING}`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => goTo(ActivePage.Registro)}
                className={`w-full text-sm font-bold text-white bg-[#1A5A96] rounded-lg py-2.5 cursor-pointer hover:bg-[#1A5A96]/90 transition-colors ${FOCUS_RING}`}
              >
                Empezar gratis
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
