import { SlidersHorizontal, X } from 'lucide-react';

export type SortBy = 'nombre' | 'precio_asc' | 'plazo_asc';

const OFICIOS: { id: string; label: string }[] = [
  { id: 'fontaneria',    label: 'Fontanería'    },
  { id: 'electricidad',  label: 'Electricidad'  },
  { id: 'albanileria',   label: 'Albañilería'   },
  { id: 'carpinteria',   label: 'Carpintería'   },
  { id: 'pintura',       label: 'Pintura'       },
  { id: 'climatizacion', label: 'Climatización' },
  { id: 'soldadura',     label: 'Soldadura'     },
];

interface Props {
  familias:     string[];
  familia:      string | null;
  onFamilia:    (f: string | null) => void;
  oficio:       string | null;
  onOficio:     (o: string | null) => void;
  onlyStock:    boolean;
  onOnlyStock:  (v: boolean) => void;
  sortBy:       SortBy;
  onSortBy:     (s: SortBy) => void;
  totalResults: number;
  loading:      boolean;
}

export default function MarketplaceFilters({
  familias,
  familia,
  onFamilia,
  oficio,
  onOficio,
  onlyStock,
  onOnlyStock,
  sortBy,
  onSortBy,
  totalResults,
  loading,
}: Props) {
  const hasActiveFilters = oficio !== null || familia !== null || onlyStock;

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white py-5 px-4 space-y-6 overflow-y-auto hidden lg:block">
      {/* Cabecera filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => { onOficio(null); onFamilia(null); onOnlyStock(false); }}
            className="flex items-center gap-1 text-[10px] text-[#1A5A96] hover:underline font-medium"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Resultados */}
      <p className="text-gray-400 text-[11px]">
        {loading ? 'Cargando…' : `${totalResults} producto${totalResults !== 1 ? 's' : ''}`}
      </p>

      {/* Oficio */}
      <div>
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
          Oficio
        </p>
        <div className="space-y-0.5">
          <FilterBtn active={oficio === null} onClick={() => onOficio(null)} label="Todos los oficios" />
          {OFICIOS.map(o => (
            <FilterBtn key={o.id} active={oficio === o.id} onClick={() => onOficio(o.id)} label={o.label} />
          ))}
        </div>
      </div>

      {/* Familia */}
      {familias.length > 0 && (
        <div>
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
            Familia
          </p>
          <div className="space-y-0.5">
            <FilterBtn active={familia === null} onClick={() => onFamilia(null)} label="Todas" />
            {familias.map(f => (
              <FilterBtn key={f} active={familia === f} onClick={() => onFamilia(f)} label={f} />
            ))}
          </div>
        </div>
      )}

      {/* Disponibilidad */}
      <div>
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
          Disponibilidad
        </p>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={onlyStock}
            onChange={e => onOnlyStock(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-[#1A5A96]"
          />
          <span className="text-gray-600 text-xs group-hover:text-gray-900 transition-colors">
            Solo con stock
          </span>
        </label>
      </div>

      {/* Ordenar */}
      <div>
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
          Ordenar por
        </p>
        <div className="space-y-0.5">
          <FilterBtn active={sortBy === 'nombre'}     onClick={() => onSortBy('nombre')}     label="Nombre A–Z" />
          <FilterBtn active={sortBy === 'precio_asc'} onClick={() => onSortBy('precio_asc')} label="Precio ↑"    />
          <FilterBtn active={sortBy === 'plazo_asc'}  onClick={() => onSortBy('plazo_asc')}  label="Entrega rápida" />
        </div>
      </div>
    </aside>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-[#EFF6FF] text-[#1A5A96] font-semibold'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {active && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1A5A96] mr-1.5 align-middle" />}
      {label}
    </button>
  );
}
