import { Package, Search } from 'lucide-react';

interface Props {
  query:        string;
  onClearQuery: () => void;
}

export default function MarketplaceEmptyState({ query, onClearQuery }: Props) {
  const isSearch = query.trim().length > 0;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-gray-50 flex-1">
      <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-4">
        {isSearch ? (
          <Search className="w-8 h-8 text-gray-300" />
        ) : (
          <Package className="w-8 h-8 text-gray-300" />
        )}
      </div>
      <p className="text-gray-700 text-sm font-semibold mb-1">
        {isSearch ? `Sin resultados para "${query}"` : 'No hay productos disponibles'}
      </p>
      <p className="text-gray-400 text-xs mb-5">
        {isSearch
          ? 'Prueba con otro término o cambia los filtros'
          : 'El catálogo está vacío en este momento'}
      </p>
      {isSearch && (
        <button
          onClick={onClearQuery}
          className="text-xs font-semibold text-[#1A5A96] hover:underline transition-colors"
        >
          Limpiar búsqueda
        </button>
      )}
    </div>
  );
}
