import { Linkedin, Youtube, Instagram } from 'lucide-react';
import { ActivePage } from '../../types';

interface LandingFooterProps {
  setCurrentPage: (page: ActivePage) => void;
}

const COL_PRODUCTO = [
  { label: 'Funciones', page: ActivePage.ComoFunciona },
  { label: 'Precios', page: ActivePage.Precios },
  { label: 'Asistente IA', page: ActivePage.AsisTecnico },
  { label: 'Roadmap', page: ActivePage.Home },
];

const COL_RECURSOS = [
  { label: 'Blog', page: ActivePage.Home },
  { label: 'Guías', page: ActivePage.Home },
  { label: 'Centro de ayuda', page: ActivePage.Contacto },
  { label: 'Plantillas', page: ActivePage.Home },
];

const COL_EMPRESA = [
  { label: 'Sobre nosotros', page: ActivePage.Contacto },
  { label: 'Carreras', page: ActivePage.Contacto },
  { label: 'Contacto', page: ActivePage.Contacto },
  { label: 'Prensa', page: ActivePage.Contacto },
];

const COL_LEGAL = [
  { label: 'Términos y condiciones', page: ActivePage.Terminos },
  { label: 'Privacidad', page: ActivePage.Privacidad },
  { label: 'Cookies', page: ActivePage.Cookies },
];

export default function LandingFooter({ setCurrentPage }: LandingFooterProps) {
  const goTo = (page: ActivePage) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0 });
  };

  return (
    <footer className="bg-[#1C2535] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">

        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 mb-12">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div
              className="flex items-center gap-2 cursor-pointer mb-3"
              onClick={() => goTo(ActivePage.Home)}
            >
              <img src="/tradeflow.png" alt="TRABFLOW" className="h-7 w-auto" style={{ filter: 'brightness(10)' }} />
              <span className="font-black text-white text-base tracking-widest uppercase">TRABFLOW</span>
              <span className="text-[9px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed mb-5 max-w-[200px]">
              El sistema operativo del instalador autónomo. Menos papeleo, más trabajo, más ingresos.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-3.5 h-3.5 text-white/60" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-3.5 h-3.5 text-white/60" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-3.5 h-3.5 text-white/60" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">Producto</p>
            <ul className="space-y-2.5">
              {COL_PRODUCTO.map(({ label, page }) => (
                <li key={label}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/55 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">Recursos</p>
            <ul className="space-y-2.5">
              {COL_RECURSOS.map(({ label, page }) => (
                <li key={label}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/55 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">Empresa</p>
            <ul className="space-y-2.5">
              {COL_EMPRESA.map(({ label, page }) => (
                <li key={label}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/55 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">Legal</p>
            <ul className="space-y-2.5">
              {COL_LEGAL.map(({ label, page }) => (
                <li key={label}>
                  <button
                    onClick={() => goTo(page)}
                    className="text-sm text-white/55 hover:text-white transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © 2026 TradeFlow Technologies, S.L. Todos los derechos reservados.
          </p>
          <p className="text-xs text-white/20 flex items-center gap-1">
            Hecho en España 🇪🇸
          </p>
        </div>

      </div>
    </footer>
  );
}
