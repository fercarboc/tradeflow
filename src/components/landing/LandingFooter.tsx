import { ActivePage } from '../../types';

interface LandingFooterProps {
  setCurrentPage: (page: ActivePage) => void;
}

const LINKS = {
  producto: [
    { label: 'Funciones', page: ActivePage.ComoFunciona },
    { label: 'Precios', page: ActivePage.Precios },
    { label: 'Asistente IA', page: ActivePage.AsisTecnico },
  ],
  empresa: [
    { label: 'Contacto', page: ActivePage.Contacto },
  ],
  legal: [
    { label: 'Aviso Legal', page: ActivePage.AvisoLegal },
    { label: 'Privacidad', page: ActivePage.Privacidad },
    { label: 'Cookies', page: ActivePage.Cookies },
    { label: 'Términos', page: ActivePage.Terminos },
  ],
};

export default function LandingFooter({ setCurrentPage }: LandingFooterProps) {
  const goTo = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0 });
  };

  return (
    <footer className="bg-[#1C2535] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div
              className="flex items-center gap-2 cursor-pointer mb-3"
              onClick={() => goTo(ActivePage.Home)}
            >
              <img src="/tradeflow.png" alt="TRABFLOW" className="h-7 w-auto brightness-200" />
              <span className="font-black text-white text-base tracking-widest uppercase">TRABFLOW</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-[200px]">
              La herramienta que trabaja contigo. Gestión inteligente para instaladores.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Producto</p>
            <ul className="space-y-2.5">
              {LINKS.producto.map(({ label, page }) => (
                <li key={page}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Empresa</p>
            <ul className="space-y-2.5">
              {LINKS.empresa.map(({ label, page }) => (
                <li key={page}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Legal</p>
            <ul className="space-y-2.5">
              {LINKS.legal.map(({ label, page }) => (
                <li key={page}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">© 2025 TRABFLOW. Todos los derechos reservados.</p>
          <p className="text-xs text-white/20">Hecho en España 🇪🇸</p>
        </div>
      </div>
    </footer>
  );
}
