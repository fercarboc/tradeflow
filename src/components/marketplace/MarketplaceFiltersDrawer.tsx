import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { MARKETPLACE_OFICIOS } from '../../lib/marketplace-config';
import type { SortBy } from './MarketplaceFilters';

// ─── Props — interfaz idéntica a MarketplaceFilters ──────────────────────────

interface Props {
  isOpen:          boolean;
  onClose:         () => void;
  familias:        string[];
  familia:         string | null;
  onFamilia:       (f: string | null) => void;
  oficio:          string | null;
  onOficio:        (o: string | null) => void;
  actorNombres:    string[];
  selectedActores: string[];
  onActores:       (a: string[]) => void;
  onlyStock:       boolean;
  onOnlyStock:     (v: boolean) => void;
  sortBy:          SortBy;
  onSortBy:        (s: SortBy) => void;
  minPrice:        string;
  maxPrice:        string;
  onMinPrice:      (v: string) => void;
  onMaxPrice:      (v: string) => void;
  totalResults:    number;
  loading:         boolean;
}

// ─── Sub-componentes internos ─────────────────────────────────────────────────

function Section({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:text-gray-900"
      >
        {label}
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function OficioItem({
  label, color, active, onClick,
}: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
        active
          ? 'bg-[#EFF6FF] text-[#1A5A96] font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: active ? '#1A5A96' : color }}
      />
      {label}
    </button>
  );
}

function CheckItem({
  label, checked, onChange, radio = false,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; radio?: boolean }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group py-1.5 px-1 rounded-xl hover:bg-gray-50">
      <input
        type={radio ? 'radio' : 'checkbox'}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 border-gray-300 accent-[#1A5A96] shrink-0"
      />
      <span className={`text-sm transition-colors ${
        checked ? 'text-[#1A5A96] font-semibold' : 'text-gray-600 group-hover:text-gray-900'
      }`}>
        {label}
      </span>
    </label>
  );
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

export default function MarketplaceFiltersDrawer({
  isOpen, onClose,
  familias, familia, onFamilia,
  oficio, onOficio,
  actorNombres, selectedActores, onActores,
  onlyStock, onOnlyStock,
  sortBy, onSortBy,
  minPrice, maxPrice, onMinPrice, onMaxPrice,
  totalResults, loading,
}: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    oficio: true, proveedor: true, disponibilidad: true, familia: false, precio: false,
  });

  const toggle = (key: string) =>
    setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const hasFilters = oficio !== null || familia !== null || selectedActores.length > 0
    || onlyStock || minPrice !== '' || maxPrice !== '';

  const clearAll = () => {
    onOficio(null); onFamilia(null); onActores([]); onOnlyStock(false);
    onMinPrice(''); onMaxPrice('');
  };

  const toggleActor = (name: string) => {
    if (selectedActores.includes(name)) {
      onActores(selectedActores.filter(a => a !== name));
    } else {
      onActores([...selectedActores, name]);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] transform transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros del catálogo"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </div>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <button
                onClick={clearAll}
                className="text-xs text-[#1A5A96] font-semibold hover:underline"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar filtros"
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Categoría */}
          <Section label="Categoría" open={openSections.oficio} onToggle={() => toggle('oficio')}>
            <div className="space-y-0.5">
              <OficioItem
                label="Todos"
                color="#1A5A96"
                active={oficio === null}
                onClick={() => onOficio(null)}
              />
              {MARKETPLACE_OFICIOS.map(o => (
                <OficioItem
                  key={o.id}
                  label={o.label}
                  color={o.color}
                  active={oficio === o.id}
                  onClick={() => onOficio(oficio === o.id ? null : o.id)}
                />
              ))}
            </div>
          </Section>

          {/* Disponibilidad */}
          <Section label="Disponibilidad" open={openSections.disponibilidad} onToggle={() => toggle('disponibilidad')}>
            <CheckItem
              label="Solo en stock"
              checked={onlyStock}
              onChange={v => onOnlyStock(v)}
            />
          </Section>

          {/* Proveedor */}
          {actorNombres.length > 0 && (
            <Section label="Proveedor" open={openSections.proveedor} onToggle={() => toggle('proveedor')}>
              <div className="space-y-0.5">
                {actorNombres.map(m => (
                  <label
                    key={m}
                    className="flex items-center gap-3 cursor-pointer group py-1.5 px-1 rounded-xl hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedActores.includes(m)}
                      onChange={() => toggleActor(m)}
                      className="w-4 h-4 rounded border-gray-300 accent-[#1A5A96] shrink-0"
                    />
                    <span className={`text-sm transition-colors truncate ${
                      selectedActores.includes(m)
                        ? 'text-[#1A5A96] font-semibold'
                        : 'text-gray-600 group-hover:text-gray-900'
                    }`}>
                      {m}
                    </span>
                  </label>
                ))}
              </div>
            </Section>
          )}

          {/* Familia */}
          {familias.length > 0 && (
            <Section label="Familia" open={openSections.familia} onToggle={() => toggle('familia')}>
              <div className="space-y-0.5">
                <CheckItem label="Todas" checked={familia === null} onChange={() => onFamilia(null)} radio />
                {familias.map(f => (
                  <CheckItem
                    key={f}
                    label={f}
                    checked={familia === f}
                    onChange={() => onFamilia(familia === f ? null : f)}
                    radio
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Precio */}
          <Section label="Precio" open={openSections.precio} onToggle={() => toggle('precio')}>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Mín. (€)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={minPrice}
                  onChange={e => onMinPrice(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Máx. (€)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="∞"
                  value={maxPrice}
                  onChange={e => onMaxPrice(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96]"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3.5 border-t border-gray-100 bg-white">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-[#1A5A96] text-white text-sm font-bold hover:bg-[#154d82] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
          >
            {loading ? 'Cargando…' : `Ver ${totalResults} resultado${totalResults !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  );
}
