import { Package, Search } from 'lucide-react';

interface Props {
  query: string;
  onClearQuery: () => void;
}

export default function MarketplaceEmptyState({ query, onClearQuery }: Props) {
  const isSearch = query.trim().length > 0;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        {isSearch ? (
          <Search className="w-8 h-8 text-white/30" />
        ) : (
          <Package className="w-8 h-8 text-white/30" />
        )}
      </div>
      <p className="text-white/60 text-sm font-medium mb-1">
        {isSearch
          ? `Sin resultados para "${query}"`
          : 'No hay productos disponibles'}
      </p>
      <p className="text-white/30 text-xs mb-4">
        {isSearch
          ? 'Prueba con otro término o cambia los filtros'
          : 'El catálogo del marketplace está vacío'}
      </p>
      {isSearch && (
        <button
          onClick={onClearQuery}
          className="text-xs text-[#00CFE8] hover:text-[#00b8cf] transition-colors"
        >
          Limpiar búsqueda
        </button>
      )}
    </div>
  );
}
