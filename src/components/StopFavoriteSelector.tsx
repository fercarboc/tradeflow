/**
 * StopFavoriteSelector — Selector de paradas favoritas de la organización.
 *
 * Permite al operador:
 *   - Buscar entre las paradas guardadas (nombre, calle, municipio).
 *   - Usar una parada existente directamente.
 *   - Crear una nueva parada y guardarla como favorita.
 *
 * Aislamiento multitenant: todas las operaciones incluyen org_id.
 * Deduplicación ligera: avisa si existe una parada con el mismo nombre
 * y municipio antes de guardar (no bloquea, solo advierte).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Star, Search, Plus, MapPin, X, AlertTriangle, Loader2 } from 'lucide-react';
import type { TransportLocation } from '../lib/transportLocations';
import { locationToAddress } from '../lib/transportLocations';
import {
  loadStopFavorites,
  createStopFavorite,
  type TradeTransportStopFavorite,
} from '../lib/transportSchedules';
import QuickStopForm from './QuickStopForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** True si ya existe una favorita con mismo nombre Y misma localidad. */
export function isDuplicateStop(
  favorites: TradeTransportStopFavorite[],
  nombre: string,
  localidad: string,
): boolean {
  const nNorm = normalize(nombre);
  const lNorm = normalize(localidad);
  return favorites.some(f => {
    const fNombre = normalize(f.nombre);
    const fLoc    = normalize((f.location as TransportLocation)?.localidad ?? '');
    return fNombre === nNorm && fLoc === lNorm;
  });
}

function matchesQuery(fav: TradeTransportStopFavorite, q: string): boolean {
  if (!q) return true;
  const qn = normalize(q);
  const loc = fav.location as TransportLocation;
  return (
    normalize(fav.nombre).includes(qn) ||
    normalize(loc.calle ?? '').includes(qn) ||
    normalize(loc.localidad ?? '').includes(qn)
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StopFavoriteSelectorProps {
  orgId:    string;
  onSelect: (loc: TransportLocation) => void;
  onCancel: () => void;
}

// ── FavoriteRow ───────────────────────────────────────────────────────────────

interface FavoriteRowProps {
  fav:     TradeTransportStopFavorite;
  onUse:   () => void;
}

function FavoriteRow({ fav, onUse }: FavoriteRowProps) {
  const loc = fav.location as TransportLocation;
  const addr = locationToAddress(loc);
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{fav.nombre}</p>
        {addr && <p className="text-xs text-slate-500 truncate">{addr}</p>}
      </div>
      <button
        type="button"
        onClick={onUse}
        className="shrink-0 px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
      >
        Usar
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function StopFavoriteSelector({ orgId, onSelect, onCancel }: StopFavoriteSelectorProps) {
  const [favorites, setFavorites]   = useState<TradeTransportStopFavorite[]>([]);
  const [loading,   setLoading]     = useState(true);
  const [error,     setError]       = useState<string | null>(null);
  const [query,     setQuery]       = useState('');
  const [showForm,  setShowForm]    = useState(false);
  const [saving,    setSaving]      = useState(false);
  const [dupWarn,   setDupWarn]     = useState(false);
  const [pendingLoc, setPendingLoc] = useState<TransportLocation | null>(null);

  const loadFavs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadStopFavorites(orgId);
      setFavorites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar paradas');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadFavs(); }, [loadFavs]);

  const handleFormConfirm = async (loc: TransportLocation) => {
    const nombre    = loc.nombre_lugar ?? '';
    const localidad = loc.localidad ?? '';

    if (nombre && localidad && isDuplicateStop(favorites, nombre, localidad)) {
      setPendingLoc(loc);
      setShowForm(false);
      setDupWarn(true);
      return;
    }

    await saveAndSelect(loc);
  };

  const saveAndSelect = async (loc: TransportLocation) => {
    setSaving(true);
    setError(null);
    try {
      const nombre = loc.nombre_lugar?.trim() || loc.calle?.trim() || 'Parada';
      await createStopFavorite(orgId, {
        nombre,
        tipo_lugar: loc.tipo_lugar ?? null,
        location:   loc as Record<string, unknown>,
      });
      await loadFavs();
      onSelect(loc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar parada');
      setSaving(false);
    }
  };

  const filtered = favorites.filter(f => matchesQuery(f, query));

  if (showForm) {
    return (
      <QuickStopForm
        orgId={orgId}
        onConfirm={handleFormConfirm}
        onCancel={() => setShowForm(false)}
        label="Nueva parada favorita"
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar parada"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Paradas guardadas</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, calle o municipio…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Warning duplicado */}
          {dupWarn && pendingLoc && (
            <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-semibold">
                  Ya existe una parada similar. ¿Guardar de todos modos?
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setDupWarn(false); setPendingLoc(null); }}
                  className="flex-1 px-3 py-1.5 text-xs border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => { setDupWarn(false); saveAndSelect(pendingLoc); }}
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Guardando…' : 'Guardar igualmente'}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando paradas…</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              {query ? 'No hay resultados para esa búsqueda.' : 'Aún no hay paradas guardadas.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(f => (
                <FavoriteRow
                  key={f.id}
                  fav={f}
                  onUse={() => onSelect(f.location as TransportLocation)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva parada
          </button>
        </div>
      </div>
    </div>
  );
}
