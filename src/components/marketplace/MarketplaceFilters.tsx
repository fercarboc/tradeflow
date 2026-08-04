import { SlidersHorizontal } from 'lucide-react';

export type SortBy = 'nombre' | 'precio_asc' | 'plazo_asc';

interface Props {
  familias:      string[];
  familia:       string | null;
  onFamilia:     (f: string | null) => void;
  onlyStock:     boolean;
  onOnlyStock:   (v: boolean) => void;
  sortBy:        SortBy;
  onSortBy:      (s: SortBy) => void;
  totalResults:  number;
  loading:       boolean;
}

export default function MarketplaceFilters({
  familias,
  familia,
  onFamilia,
  onlyStock,
  onOnlyStock,
  sortBy,
  onSortBy,
  totalResults,
  loading,
}: Props) {
  return (
    <aside className="w-52 shrink-0 border-r border-white/8 py-4 px-3 space-y-5 overflow-y-auto hidden lg:block">
      <div className="flex items-center gap-1.5 text-white/40 text-[10px] font-semibold uppercase tracking-wider">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtros
      </div>

      {/* Resultados */}
      <p className="text-white/30 text-[11px]">
        {loading ? 'Cargando…' : `${totalResults} producto${totalResults !== 1 ? 's' : ''}`}
      </p>

      {/* Familia */}
      <div>
        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">
          Familia
        </p>
        <div className="space-y-0.5">
          <FamiliaBtn active={familia === null} onClick={() => onFamilia(null)} label="Todas" />
          {familias.map(f => (
            <FamiliaBtn key={f} active={familia === f} onClick={() => onFamilia(f)} label={f} />
          ))}
        </div>
      </div>

      {/* Stock */}
      <div>
        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">
          Disponibilidad
        </p>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={onlyStock}
            onChange={e => onOnlyStock(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-[#00CFE8]"
          />
          <span className="text-white/60 text-xs group-hover:text-white/80 transition-colors">
            Solo con stock
          </span>
        </label>
      </div>

      {/* Ordenar */}
      <div>
        <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">
          Ordenar por
        </p>
        <div className="space-y-0.5">
          <SortBtn active={sortBy === 'nombre'}    onClick={() => onSortBy('nombre')}    label="Nombre A–Z" />
          <SortBtn active={sortBy === 'precio_asc'} onClick={() => onSortBy('precio_asc')} label="Precio ↑" />
          <SortBtn active={sortBy === 'plazo_asc'}  onClick={() => onSortBy('plazo_asc')}  label="Entrega rápida" />
        </div>
      </div>
    </aside>
  );
}

function FamiliaBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-[#00CFE8]/15 text-[#00CFE8] font-medium'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}

function SortBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
        active
          ? 'text-[#00CFE8] font-medium'
          : 'text-white/50 hover:text-white/80'
      }`}
    >
      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#00CFE8] shrink-0" />}
      {!active && <span className="w-1.5 h-1.5 shrink-0" />}
      {label}
    </button>
  );
}
