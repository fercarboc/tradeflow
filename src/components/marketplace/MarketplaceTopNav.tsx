import { Home, LayoutGrid, Tag, Sparkles, Award, Building2, Package, Heart } from 'lucide-react';
import type { AdDestinationType } from '../../lib/marketplace-ad-types';

// Barra de navegación superior de la Home del Marketplace.
// Secciones activas: Inicio, Categorías, Mayoristas.
// Secciones preparadas (sin funcionalidad backend todavía): Ofertas, Novedades, Marcas, Mis listas.
// "Mis pedidos": llama a onMisPedidos si se proporciona.

interface NavItem {
  id:       string;
  label:    string;
  Icon:     React.ComponentType<{ className?: string }>;
  enabled:  boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inicio',     label: 'Inicio',      Icon: Home,      enabled: true  },
  { id: 'categorias', label: 'Categorías',  Icon: LayoutGrid, enabled: true  },
  { id: 'ofertas',    label: 'Ofertas',     Icon: Tag,        enabled: false },
  { id: 'novedades',  label: 'Novedades',   Icon: Sparkles,   enabled: false },
  { id: 'marcas',     label: 'Marcas',      Icon: Award,      enabled: false },
  { id: 'mayoristas', label: 'Mayoristas',  Icon: Building2,  enabled: true  },
  { id: 'pedidos',    label: 'Mis pedidos', Icon: Package,    enabled: true  },
  { id: 'listas',     label: 'Mis listas',  Icon: Heart,      enabled: false },
];

interface Props {
  activeTab?:    string;
  onGoHome:      () => void;
  onGoToCatalog: (oficio?: string | null, search?: string) => void;
  onNavigateAd?: (type: AdDestinationType, value?: string) => void;
  onMisPedidos?: () => void;
  centerSlot?:   React.ReactNode;
  rightSlot?:    React.ReactNode;
  className?:    string;
}

export default function MarketplaceTopNav({
  activeTab = 'inicio',
  onGoHome,
  onGoToCatalog,
  onMisPedidos,
  centerSlot,
  rightSlot,
  className = '',
}: Props) {

  function handleClick(id: string) {
    switch (id) {
      case 'inicio':     return onGoHome();
      case 'categorias': return onGoToCatalog();
      case 'mayoristas': return onGoToCatalog();
      case 'pedidos':    return onMisPedidos?.();
      default:           return;
    }
  }

  return (
    <nav
      className={`bg-white border-b border-gray-100 shrink-0 ${centerSlot ? '' : 'overflow-x-auto scrollbar-none'} ${className}`}
      aria-label="Navegación marketplace"
    >
      <div className="flex items-center gap-1 px-2 w-full">
        {/* Ítems de navegación */}
        <div className="flex items-center gap-0.5 shrink-0">
          {NAV_ITEMS.map(({ id, label, Icon, enabled }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                onClick={enabled ? () => handleClick(id) : undefined}
                disabled={!enabled}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0',
                  isActive
                    ? 'border-[#1A5A96] text-[#1A5A96]'
                    : enabled
                      ? 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                      : 'border-transparent text-gray-300 cursor-not-allowed',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Slot central — buscador */}
        {centerSlot && (
          <div className="flex-1 px-3 py-1.5">
            {centerSlot}
          </div>
        )}

        {/* Slot derecha — ubicación */}
        {rightSlot && (
          <div className="shrink-0 pr-2">
            {rightSlot}
          </div>
        )}
      </div>
    </nav>
  );
}
