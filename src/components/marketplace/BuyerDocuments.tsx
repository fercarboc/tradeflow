// MP-FIN-5C — Layout de dos bloques para documentos del comprador.
// Gestiona búsqueda con debounce 300ms compartido entre ambos bloques.
// No inner components — todos definidos a nivel de módulo.
import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import BuyerDocList from './BuyerDocList'
import BuyerDocRefList from './BuyerDocRefList'

// ── Search bar (module-level) ─────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Buscar por documento, pedido o proveedor…"
        className="w-full pl-9 pr-8 py-2 text-sm bg-slate-800/60 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#1A5A96]/60 focus:border-[#1A5A96]/40 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded hover:bg-slate-700 cursor-pointer transition-colors"
        >
          <X className="h-3.5 w-3.5 text-slate-400" />
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orgId: string
}

export default function BuyerDocuments({ orgId }: Props) {
  const [query, setQuery]           = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  return (
    <div className="space-y-6">
      {/* Buscador global */}
      <SearchBar value={query} onChange={setQuery} />

      {/* Bloque A — Resúmenes de compra */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <BuyerDocList orgId={orgId} search={debouncedQuery} />
      </div>

      {/* Bloque B — Documentos de proveedores */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <BuyerDocRefList orgId={orgId} search={debouncedQuery} />
      </div>
    </div>
  )
}
