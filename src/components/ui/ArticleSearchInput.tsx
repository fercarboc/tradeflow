import React, { useEffect, useRef, useMemo, useState } from 'react';
import type { TradeCatalogProduct } from '../../lib/supabase';

export interface ArticleSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  onProductSelect: (descripcion: string, unidad: string, precio: number | null) => void;
  catalogProducts: TradeCatalogProduct[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ArticleSearchInput({
  value,
  onChange,
  onProductSelect,
  catalogProducts,
  disabled,
  placeholder = 'Descripción del material',
  className = 'text-sm text-slate-800 bg-transparent focus:outline-none w-full disabled:text-slate-500',
}: ArticleSearchInputProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    const q = value.toLowerCase();
    return catalogProducts
      .filter(p =>
        p.nombre_generico.toLowerCase().includes(q) ||
        p.familia.toLowerCase().includes(q) ||
        (p.subfamilia?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 8);
  }, [value, catalogProducts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (product: TradeCatalogProduct) => {
    const preferred =
      product.trade_catalog_variants?.find(v => v.is_preferred && v.activo) ??
      product.trade_catalog_variants?.find(v => v.activo);
    onProductSelect(product.nombre_generico, product.unidad, preferred?.precio_material ?? null);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        disabled={disabled}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.length >= 2) setOpen(true);
        }}
        placeholder={placeholder}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
          {filtered.map(p => {
            const pref =
              p.trade_catalog_variants?.find(v => v.is_preferred && v.activo) ??
              p.trade_catalog_variants?.find(v => v.activo);
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  handleSelect(p);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5 border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {p.nombre_generico}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 truncate">
                    {p.familia}
                    {p.subfamilia ? ` · ${p.subfamilia}` : ''}
                  </span>
                  {pref && (
                    <span className="text-[10px] font-bold text-blue-600 shrink-0">
                      {pref.precio_material.toFixed(2)} € / {p.unidad}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
