import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Info, ShoppingBag, User, MapPin, Package, AlertCircle, Search, X } from 'lucide-react';
import { ActivePage } from '../../types';
import { useSession } from '../../context/SessionContext';
import { useMarketplaceCart } from '../../hooks/useMarketplaceCart';
import {
  getMarketplaceCatalog,
  getMarketplaceFamilias,
  getActorIdsWithPickupLocations,
} from '../../lib/api/marketplace-catalog';
import type { MarketplaceCatalogItem, CatalogPage, OfferingDetail } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import type { CartItem } from '../../lib/api/marketplace-checkout';
import { getCartDetail, updateCartItem } from '../../lib/api/marketplace-checkout';
import { useMarketplaceLocation, PRESET_LOCATIONS } from '../../hooks/useMarketplaceLocation';
import type { MarketplaceLocation } from '../../hooks/useMarketplaceLocation';
import {
  loadPurchaseContext,
  clearPurchaseContext,
  savePurchaseContext,
} from '../../lib/marketplace/purchase-context';
import type { MarketplacePurchaseContext } from '../../lib/marketplace/purchase-context';
import { createFreeCart, addFreeCartItems } from '../../lib/api/marketplace-checkout';
import type { FreeCartItemInput } from '../../lib/api/marketplace-checkout';

import MarketplaceHeader           from './MarketplaceHeader';
import type { SortBy }             from './MarketplaceFilters';
import MarketplaceProductSlideOver from './MarketplaceProductSlideOver';
import DesktopMarketplaceLayout    from './DesktopMarketplaceLayout';
import MobileMarketplaceLayout     from './MobileMarketplaceLayout';
import MarketplaceHome             from './MarketplaceHome';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 3000);
  }, []);
  return { toast, show };
}

// ─── Banner de ubicación de contexto (B2) ────────────────────────────────────

function LocationBanner({ location, onChangeRequest }: {
  location: MarketplaceLocation;
  onChangeRequest: () => void;
}) {
  return (
    <div className="bg-[#1A5A96]/5 border-b border-[#1A5A96]/10 px-4 py-2 flex items-center gap-2 text-xs text-gray-600 shrink-0">
      <MapPin className="w-3 h-3 text-[#1A5A96] shrink-0" />
      <span>
        Disponibilidad cerca de{' '}
        <span className="font-semibold text-gray-900">{location.localidad}</span>
        {location.comunidad_autonoma && (
          <span className="text-gray-400"> · {location.comunidad_autonoma}</span>
        )}
      </span>
      <button
        onClick={onChangeRequest}
        className="ml-1 text-[#1A5A96] font-medium hover:underline"
      >
        Cambiar
      </button>
    </div>
  );
}

function LocationSetButton({ onRequest }: { onRequest: () => void }) {
  return (
    <button
      onClick={onRequest}
      className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-[#1A5A96] transition-colors border-b border-transparent hover:border-[#1A5A96]/30 px-4 py-1.5 shrink-0"
    >
      <MapPin className="w-3 h-3" />
      Activar disponibilidad local
    </button>
  );
}

function LocationSelectorModal({ current, onSelect, onClose }: {
  current: MarketplaceLocation | null;
  onSelect: (loc: MarketplaceLocation | null) => void;
  onClose: () => void;
}) {
  const [customLocalidad, setCustomLocalidad] = useState(current?.localidad ?? '');

  function handlePreset(loc: MarketplaceLocation) {
    onSelect(loc);
    onClose();
  }

  function handleCustom() {
    if (!customLocalidad.trim()) return;
    onSelect({ localidad: customLocalidad.trim() });
    onClose();
  }

  function handleClear() {
    onSelect(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Ubicación de referencia</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Muestra recogida local y precios con promociones de tu zona.
          Sin acceso a tu ubicación GPS.
        </p>
        <div className="space-y-1.5">
          {PRESET_LOCATIONS.map(loc => (
            <button
              key={loc.localidad}
              onClick={() => handlePreset(loc)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                current?.localidad === loc.localidad
                  ? 'bg-[#1A5A96] text-white'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{loc.localidad}</span>
              {loc.comunidad_autonoma && (
                <span className={`text-[11px] ml-auto ${
                  current?.localidad === loc.localidad ? 'text-white/70' : 'text-gray-400'
                }`}>{loc.comunidad_autonoma}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customLocalidad}
            onChange={e => setCustomLocalidad(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustom()}
            placeholder="Otra localidad…"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96]"
          />
          <button
            onClick={handleCustom}
            disabled={!customLocalidad.trim()}
            className="px-3 py-2 rounded-xl bg-[#1A5A96] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#154d82] transition-colors"
          >
            OK
          </button>
        </div>
        {current && (
          <button
            onClick={handleClear}
            className="w-full text-xs text-gray-400 hover:text-gray-600 text-center transition-colors"
          >
            Quitar ubicación de referencia
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Banner contextual presupuesto ────────────────────────────────────────────

function PurchaseContextBanner({ ctx, unresolvedCount, onClear }: {
  ctx: MarketplacePurchaseContext;
  unresolvedCount: number;
  onClear: () => void;
}) {
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center gap-3 text-xs text-blue-800 flex-wrap">
      <ShoppingBag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
      {ctx.quoteRef && (
        <span className="font-semibold">{ctx.quoteRef}</span>
      )}
      {ctx.customerName && (
        <span className="flex items-center gap-1 text-blue-700">
          <User className="w-3 h-3" />
          {ctx.customerName}
        </span>
      )}
      {ctx.projectName && (
        <span className="flex items-center gap-1 text-blue-700">
          <MapPin className="w-3 h-3" />
          {ctx.projectName}
        </span>
      )}
      {ctx.lineCount != null && ctx.lineCount > 0 && (
        <span className="flex items-center gap-1 text-blue-600">
          <Package className="w-3 h-3" />
          {ctx.lineCount} línea{ctx.lineCount !== 1 ? 's' : ''} de material
        </span>
      )}
      {unresolvedCount > 0 && (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertCircle className="w-3 h-3" />
          {unresolvedCount} sin proveedor
        </span>
      )}
      <button
        onClick={onClear}
        className="ml-auto text-blue-400 hover:text-blue-600 text-[10px] underline shrink-0"
      >
        Limpiar contexto
      </button>
    </div>
  );
}

// ─── Líneas sin proveedor ─────────────────────────────────────────────────────

function UnresolvedLinesPanel({ items, onSearch }: {
  items: CartItem[];
  onSearch: (q: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        {items.length} material{items.length !== 1 ? 'es' : ''} sin proveedor disponible — búscalos en el catálogo
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onSearch(item.up_nombre_canonico ?? item.descripcion_original)}
            className="inline-flex items-center gap-1.5 bg-white border border-amber-200 hover:border-amber-400 text-amber-800 text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
          >
            <Search className="w-3 h-3" />
            {item.up_nombre_canonico ?? item.descripcion_original}
            <span className="text-amber-500">· {item.cantidad} {item.unidad}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sync carrito local → server cart (pre-checkout) ─────────────────────────
// Garantiza INV-1: cart UI lines == persisted cart lines antes de navegar al wizard.
// Opera en tres pasos: añadir ítems nuevos, actualizar cantidades, desactivar eliminados.

async function syncCartBeforeCheckout(
  cartId:     string,
  localItems: LocalCartItem[],
): Promise<void> {
  console.log('[C6.6:SYNC_BEGIN]', { cartId, localCount: localItems.length });
  try {
    const serverDetail = await getCartDetail(cartId);
    const serverItems  = serverDetail.items.filter(i => i.activo);

    const serverById        = new Map(serverItems.map(i => [i.id, i]));
    const serverOfferingIds = new Set<string>(
      serverItems.flatMap(i => (i.selected_offering_id ? [i.selected_offering_id] : [])),
    );
    const localServerIds = new Set<string>(
      localItems.filter(i => serverById.has(i.cartItemId)).map(i => i.cartItemId),
    );

    console.log('[C6.6:QUOTE_LINES]', {
      cartId,
      localCount:  localItems.length,
      localActors: [...new Set(localItems.map(i => i.supplierActorId))],
      items:       localItems.map(i => ({ cid: i.cartItemId, off: i.offeringId, actor: i.supplierActorId, qty: i.cantidad })),
    });
    console.log('[C6.6:QUOTE_SELECTIONS]', {
      cartId,
      serverCount:  serverItems.length,
      resolved:     serverItems.filter(i => i.selected_offering_id).length,
      unresolved:   serverItems.filter(i => !i.selected_offering_id).length,
      serverActors: [...new Set(serverItems.map(i => i.selected_actor_id).filter(Boolean))],
      items:        serverItems.map(i => ({ id: i.id, off: i.selected_offering_id, actor: i.selected_actor_id, qty: i.cantidad })),
    });

    // 1. Nuevos ítems en local que no están en el server (ni por ID ni por offeringId)
    const toAdd: FreeCartItemInput[] = localItems
      .filter(i =>
        !serverById.has(i.cartItemId) &&
        i.offeringId && i.supplierActorId &&
        !serverOfferingIds.has(i.offeringId),
      )
      .map(i => ({
        descripcion:          i.nombre,
        cantidad:             i.cantidad,
        unidad:               i.unidadComercial || i.unidadTecnica || 'ud',
        universal_product_id: i.universalProductId || null,
        offering_id:          i.offeringId,
        actor_id:             i.supplierActorId,
        precio_unitario:      i.precioUnitario,
      }));
    if (toAdd.length > 0) {
      console.log('[C6.6:SYNC_ADD]', { cartId, count: toAdd.length, offerings: toAdd.map(i => i.offering_id) });
      await addFreeCartItems(cartId, toAdd);
    }

    // 2. Cambios de cantidad en ítems que ya están en el server
    const toUpdate = localItems.filter(i => {
      const s = serverById.get(i.cartItemId);
      return s && s.cantidad !== i.cantidad;
    });
    if (toUpdate.length > 0) {
      console.log('[C6.6:SYNC_UPDATE]', { cartId, count: toUpdate.length });
    }
    await Promise.all(toUpdate.map(i => updateCartItem({ itemId: i.cartItemId, cantidad: i.cantidad })));

    // 3. Desactivar ítems del server que el usuario eliminó del carrito local.
    // EXCLUIR items no-resueltos (selected_offering_id = null): no se añaden al carrito
    // local durante la hidratación, por lo que aparecerían falsamente como "eliminados".
    const toDeactivate = serverItems.filter(
      s => !localServerIds.has(s.id) && s.selected_offering_id != null,
    );
    if (toDeactivate.length > 0) {
      console.log('[C6.6:SYNC_DEACTIVATE]', { cartId, count: toDeactivate.length, ids: toDeactivate.map(s => s.id) });
    }
    await Promise.all(toDeactivate.map(s => updateCartItem({ itemId: s.id, activo: false })));
  } catch (err) {
    console.error('[C6.6:SYNC_ERROR]', {
      cartId,
      localCount: localItems.length,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    throw err;
  }
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

interface Props {
  setCurrentPage: (p: ActivePage) => void;
  mode?: 'public' | 'professional';
}

export default function ScreenMarketplace({ setCurrentPage, mode = 'professional' }: Props) {
  const { org }    = useSession();
  const { state, actions } = useMarketplaceCart();

  // ── Contexto de ubicación (B2) ─────────────────────────────────────────────
  const { location, setLocation } = useMarketplaceLocation();
  const [locationModalOpen,  setLocationModalOpen]  = useState(false);

  // ── Vista: home (entrada comercial) o catalog (búsqueda/filtros) ───────────
  // Si existe purchaseCtx en sessionStorage, se va directo al catálogo sin pasar por home.
  const [view, setView] = useState<'home' | 'catalog'>(() =>
    loadPurchaseContext() != null ? 'catalog' : 'home',
  );
  const [actorIdsWithPickup, setActorIdsWithPickup] = useState<Set<string>>(new Set());

  // ── Contexto de compra (llega desde presupuesto) ───────────────────────────
  const [purchaseCtx, setPurchaseCtx]           = useState<MarketplacePurchaseContext | null>(null);
  const [unresolvedItems, setUnresolvedItems]   = useState<CartItem[]>([]);
  const [isHydrating, setIsHydrating]           = useState(false);
  const [pendingMerge, setPendingMerge]         = useState<{ resolved: LocalCartItem[]; cartId: string; unresolved: CartItem[] } | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const ctx = loadPurchaseContext();
    if (!ctx) return;
    console.log('[RC1-C1D] ScreenMarketplace: contexto fresco detectado', { cartId: ctx.cartId, quoteRef: ctx.quoteRef });

    setPurchaseCtx(ctx);
    setView('catalog');
    openMobileCart();

    // Evitar hidratación doble en StrictMode
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const cartId = sessionStorage.getItem('mkt_cart_id') ?? ctx.cartId;
    if (!cartId) return;

    setIsHydrating(true);
    // Hidratar carrito local desde el server cart
    getCartDetail(cartId).then(detail => {
      const resolved: LocalCartItem[] = detail.items
        .filter(item => item.activo && item.selected_offering_id)
        .map(item => {
          console.log('[C6.5:QUOTE_INPUT]', {
            cartItemId:   item.id,
            offering_id:  item.selected_offering_id,
            actor_id:     item.selected_actor_id,
            qty:          item.cantidad,
            status:       'resolved',
          });
          return {
            cartItemId:         item.id,
            universalProductId: item.universal_product_id ?? '',
            offeringId:         item.selected_offering_id!,
            supplierActorId:    item.selected_actor_id ?? '',
            supplierName:       item.selected_actor_nombre ?? '',
            supplierRef:        null,
            nombre:             item.up_nombre_canonico ?? item.descripcion_original,
            imagen:             item.image_url,
            cantidad:           item.cantidad,
            unidadTecnica:      item.unidad,
            unidadComercial:    item.unidad,
            precioUnitario:     item.precio_unitario_final ?? 0,
            stockDisponible:    true,
            plazoEntregaDias:   0,
            sourceType:         'quote' as const,
            quoteItemId:        item.source_item_id,
            lineaOrigen:        'quote' as const,
          };
        });

      const unresolved = detail.items.filter(item => item.activo && !item.selected_offering_id);
      unresolved.forEach(item => {
        console.log('[C6.5:QUOTE_INPUT]', {
          cartItemId: item.id,
          offering_id: null,
          status: 'unresolved',
          reason: 'no_offering_selected',
          descripcion: item.descripcion_original,
        });
      });
      console.log('[RC1-C1D] ScreenMarketplace: hidratación completada', { resolved: resolved.length, unresolved: unresolved.length });

      setIsHydrating(false);

      // Si ya hay items en el carrito local, preguntar si reemplazar o fusionar
      // (se lee directamente desde el ref para evitar stale closure)
      setPendingMerge(prev => {
        if (prev) return prev; // ya hay un diálogo pendiente
        return { resolved, cartId, unresolved };
      });
    }).catch(() => {
      setIsHydrating(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando llega el pendingMerge, comprobar si hay items pre-existentes
  useEffect(() => {
    if (!pendingMerge) return;
    const { resolved, cartId, unresolved } = pendingMerge;
    const existingCount = state.items.filter(i => i.sourceType !== 'quote').length;
    if (existingCount > 0) {
      // Mostrar diálogo de merge — lo resolvemos vía showMergeDialog
      setMergeDialogData({ resolved, cartId, unresolved, existingCount });
    } else {
      actions.replaceWithServerCart(resolved, cartId);
      setUnresolvedItems(unresolved);
    }
    setPendingMerge(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMerge]);

  // Estado del diálogo merge/replace
  type MergeDialogData = { resolved: LocalCartItem[]; cartId: string; unresolved: CartItem[]; existingCount: number };
  const [mergeDialogData, setMergeDialogData] = useState<MergeDialogData | null>(null);

  const handleMergeReplace = useCallback(() => {
    if (!mergeDialogData) return;
    actions.replaceWithServerCart(mergeDialogData.resolved, mergeDialogData.cartId);
    setUnresolvedItems(mergeDialogData.unresolved);
    setMergeDialogData(null);
  }, [mergeDialogData, actions]);

  const handleMergeKeep = useCallback(() => {
    if (!mergeDialogData) return;
    // Fusionar: añadir los items del presupuesto que no estén ya en el carrito
    const existingOfferingIds = new Set(state.items.map(i => i.offeringId));
    const toAdd = mergeDialogData.resolved.filter(i => !existingOfferingIds.has(i.offeringId));
    toAdd.forEach(item => actions.addItem(item));
    setUnresolvedItems(mergeDialogData.unresolved);
    setMergeDialogData(null);
  }, [mergeDialogData, actions, state.items]);

  const handleClearCtx = useCallback(() => {
    const qid = purchaseCtx?.quoteId ?? null;
    clearPurchaseContext();
    if (qid) sessionStorage.removeItem(`mkt_cart_id_${qid}`);
    else sessionStorage.removeItem('mkt_cart_id_noquote');
    sessionStorage.removeItem('mkt_cart_id'); // legacy
    setPurchaseCtx(null);
    setUnresolvedItems([]);
    actions.clearCart('manual');
  }, [actions, purchaseCtx?.quoteId]);

  // Navega desde Home al catálogo aplicando filtros opcionales
  const handleGoToCatalog = useCallback((oficio?: string | null, search?: string, actor?: string) => {
    if (oficio) setOficio(oficio);
    if (search) setQuery(search);
    if (actor) setSelectedActores([actor]);
    setView('catalog');
  }, []);

  // ── Filtros RPC ────────────────────────────────────────────────────────────
  const [query,     setQuery]     = useState('');
  const [oficio,    setOficio]    = useState<string | null>(null);
  const [familia,   setFamilia]   = useState<string | null>(null);
  const [onlyStock, setOnlyStock] = useState(false);
  const [sortBy,    setSortBy]    = useState<SortBy>('nombre');
  const [familias,  setFamilias]  = useState<string[]>([]);

  // ── Filtros cliente-side ───────────────────────────────────────────────────
  const [selectedActores, setSelectedActores] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // ── Datos ──────────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [slideOverItem,   setSlideOverItem]   = useState<MarketplaceCatalogItem | null>(null);
  const [mobileCartOpen,    setMobileCartOpen]    = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  // T11: drawers nunca abiertos simultáneamente
  const openMobileFilters  = useCallback(() => { setMobileCartOpen(false);   setMobileFiltersOpen(true);  }, []);
  const closeMobileFilters = useCallback(() => { setMobileFiltersOpen(false); }, []);
  const openMobileCart     = useCallback(() => { setMobileFiltersOpen(false); setMobileCartOpen(true);    }, []);
  const closeMobileCart    = useCallback(() => { setMobileCartOpen(false);    }, []);
  const [checkingOut,     setCheckingOut]     = useState(false);
  const { toast, show: showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cargar familias una sola vez ───────────────────────────────────────────
  useEffect(() => {
    getMarketplaceFamilias().then(setFamilias).catch(() => {});
  }, []);

  // ── Cargar actores con recogida (para señal en tarjetas) ───────────────────
  useEffect(() => {
    if (!location) { setActorIdsWithPickup(new Set()); return; }
    getActorIdsWithPickupLocations().then(setActorIdsWithPickup).catch(() => {});
  }, [location?.localidad]);

  // ── Cargar catálogo ────────────────────────────────────────────────────────
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await getMarketplaceCatalog({
        query:     query.trim() || undefined,
        familia:   familia ?? undefined,
        oficio:    oficio ?? undefined,
        onlyStock,
        sortBy,
        limit:     96,
        offset:    0,
      });
      setCatalog(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar catálogo');
    } finally {
      setLoading(false);
    }
  }, [query, oficio, familia, onlyStock, sortBy]);

  useEffect(() => {
    if (view !== 'catalog') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = query.trim() ? 350 : 0;
    debounceRef.current = setTimeout(loadCatalog, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadCatalog, view]);

  // ── Lista dinámica de nombres de actores para el filtro ───────────────────
  const actorNombres = useMemo((): string[] => {
    const seen = new Set<string>();
    for (const item of catalog?.items ?? []) {
      for (const n of item.actor_nombres) seen.add(n);
    }
    return [...seen].sort();
  }, [catalog]);

  // ── Filtrado cliente-side ──────────────────────────────────────────────────
  const filteredItems = useMemo((): MarketplaceCatalogItem[] => {
    let items = catalog?.items ?? [];

    if (selectedActores.length > 0) {
      items = items.filter(it =>
        it.actor_nombres.some(n =>
          selectedActores.some(a => n.toLowerCase().includes(a.toLowerCase())),
        ),
      );
    }

    const mn = minPrice !== '' ? parseFloat(minPrice) : null;
    const mx = maxPrice !== '' ? parseFloat(maxPrice) : null;
    if (mn !== null || mx !== null) {
      items = items.filter(it => {
        const p = it.precio_min ?? 0;
        if (mn !== null && p < mn) return false;
        if (mx !== null && p > mx) return false;
        return true;
      });
    }

    return items;
  }, [catalog, selectedActores, minPrice, maxPrice]);

  // ── Banner: seleccionar categoría aplica filtro ────────────────────────────
  const handleBannerCategory = useCallback((newOficio: string | null) => {
    setOficio(newOficio);
  }, []);

  // ── Añadir la mejor offering ───────────────────────────────────────────────
  const handleAddBest = useCallback((item: MarketplaceCatalogItem) => {
    if (!item.best_offering_id || !item.best_actor_id) {
      showToast('No hay offering disponible para añadir', 'error');
      return;
    }

    const cartItem: Omit<LocalCartItem, 'cartItemId'> = {
      universalProductId: item.up_id,
      offeringId:         item.best_offering_id,
      supplierActorId:    item.best_actor_id,
      supplierName:       item.best_actor_nombre ?? '',
      supplierRef:        item.best_supplier_ref,
      nombre:             item.nombre_canonico,
      imagen:             item.image_url,
      cantidad:           1,
      unidadTecnica:      item.unidad,
      unidadComercial:    item.best_unidad ?? item.unidad,
      precioUnitario:     item.best_precio ?? 0,
      stockDisponible:    item.best_stock,
      plazoEntregaDias:   item.best_plazo ?? 0,
      sourceType:         'free',
      lineaOrigen:        'manual',
    };

    actions.addItem(cartItem);
    showToast(
      item.best_stock
        ? `${item.nombre_canonico} añadido al carrito`
        : `${item.nombre_canonico} añadido (sin stock confirmado)`,
      item.best_stock ? 'success' : 'info',
    );
  }, [actions, showToast]);

  const handleAddFromSlideOver = useCallback((item: Omit<LocalCartItem, 'cartItemId'>) => {
    actions.addItem(item);
    showToast(`${item.nombre} añadido al carrito`, 'success');
  }, [actions, showToast]);

  const handleSubstitute = useCallback((offering: OfferingDetail, qty: number) => {
    if (!slideOverItem) return;
    const existing = state.items.find(i => i.universalProductId === slideOverItem.up_id);
    if (existing) actions.removeItem(existing.cartItemId);
    actions.addItem({
      universalProductId: slideOverItem.up_id,
      offeringId:         offering.offering_id,
      supplierActorId:    offering.actor_id,
      supplierName:       offering.actor_nombre,
      supplierRef:        offering.supplier_ref,
      nombre:             slideOverItem.nombre_canonico,
      imagen:             offering.image_url ?? slideOverItem.image_url,
      cantidad:           qty,
      unidadTecnica:      slideOverItem.unidad,
      unidadComercial:    offering.unidad,
      precioUnitario:     offering.precio_coste ?? 0,
      stockDisponible:    offering.stock_disponible,
      plazoEntregaDias:   offering.plazo_dias,
      sourceType:         'free',
      lineaOrigen:        'manual',
    });
    showToast(`Proveedor cambiado a ${offering.actor_nombre}`, 'success');
  }, [slideOverItem, state.items, actions, showToast]);

  const cartItems = state.items;
  const cartCount = cartItems.length;

  const currentSlideOverCartItem = useMemo(() => {
    if (!slideOverItem) return null;
    return cartItems.find(i => i.universalProductId === slideOverItem.up_id) ?? null;
  }, [slideOverItem, cartItems]);

  // ── Checkout handler ───────────────────────────────────────────────────────
  // INV-1: antes de navegar al wizard, el server cart debe reflejar exactamente
  // lo que muestra el carrito UI. syncCartBeforeCheckout garantiza esto siempre.
  const handleCheckout = mode === 'public'
    ? () => {
        sessionStorage.setItem('mk_return', '1');
        setCurrentPage(ActivePage.Login);
      }
    : async () => {
        if (checkingOut) return;
        setCheckingOut(true);
        try {
          const existingCtx = loadPurchaseContext();

          if (existingCtx?.cartId) {
            // Carrito existente (presupuesto o libre previo):
            // sincronizar carrito local → server cart antes de navegar.
            // BUG B fix: antes navegaba sin sincronizar → ítems manuales (actor C) se perdían.
            console.log('[C6.6:CART_FROM_QUOTE]', { cartId: existingCtx.cartId, source: existingCtx.source, localItems: state.items.length });
            await syncCartBeforeCheckout(existingCtx.cartId, state.items);
            setCurrentPage(ActivePage.MarketplaceComprar);
            return;
          }

          // Nuevo carrito libre: crear server cart desde los ítems locales
          const freeItems = state.items.filter(i => i.offeringId && i.supplierActorId);
          if (freeItems.length === 0 || !org?.id) {
            setCurrentPage(ActivePage.MarketplaceComprar);
            return;
          }

          const cartId = await createFreeCart(org.id);
          const payload: FreeCartItemInput[] = freeItems.map(i => ({
            descripcion:          i.nombre,
            cantidad:             i.cantidad,
            unidad:               i.unidadComercial || i.unidadTecnica || 'ud',
            universal_product_id: i.universalProductId || null,
            offering_id:          i.offeringId,
            actor_id:             i.supplierActorId,
            precio_unitario:      i.precioUnitario,
          }));
          await addFreeCartItems(cartId, payload);
          savePurchaseContext({
            source:    'free',
            cartId,
            orgId:     org.id,
            createdAt: new Date().toISOString(),
          });
          setCurrentPage(ActivePage.MarketplaceComprar);
        } catch {
          showToast('No se pudo preparar el carrito. Inténtalo de nuevo.', 'error');
        } finally {
          setCheckingOut(false);
        }
      };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <MarketplaceHeader
        mode={mode}
        setCurrentPage={setCurrentPage}
        cartCount={cartCount}
        onOpenCart={openMobileCart}
        query={query}
        onQueryChange={setQuery}
        orgName={org?.nombre}
        onGoHome={view === 'catalog' ? () => setView('home') : undefined}
        hideSearch={view === 'home'}
      />

      {/* Banners contextuales — solo en vista catálogo */}
      {view === 'catalog' && purchaseCtx && (
        <PurchaseContextBanner
          ctx={purchaseCtx}
          unresolvedCount={unresolvedItems.length}
          onClear={handleClearCtx}
        />
      )}

      {view === 'catalog' && (
        location
          ? <LocationBanner location={location} onChangeRequest={() => setLocationModalOpen(true)} />
          : <LocationSetButton onRequest={() => setLocationModalOpen(true)} />
      )}

      {view === 'catalog' && unresolvedItems.length > 0 && (
        <UnresolvedLinesPanel
          items={unresolvedItems}
          onSearch={setQuery}
        />
      )}

      {/* Vista Home */}
      {view === 'home' && (
        <MarketplaceHome
          onGoToCatalog={handleGoToCatalog}
          onGoHome={() => setView('home')}
          cartCount={cartCount}
          onOpenCart={openMobileCart}
          location={location}
          onChangeLocation={() => setLocationModalOpen(true)}
          onMisPedidos={() => setCurrentPage(ActivePage.SeguimientoMaterial)}
        />
      )}

      {/* Vista Catálogo */}
      {view === 'catalog' && (
        <>
          {/* Desktop: 3 columnas (filtros | catálogo | carrito) */}
          <DesktopMarketplaceLayout
            familias={familias}
            familia={familia}
            onFamilia={setFamilia}
            oficio={oficio}
            onOficio={setOficio}
            actorNombres={actorNombres}
            selectedActores={selectedActores}
            onActores={setSelectedActores}
            onlyStock={onlyStock}
            onOnlyStock={setOnlyStock}
            sortBy={sortBy}
            onSortBy={setSortBy}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinPrice={setMinPrice}
            onMaxPrice={setMaxPrice}
            filteredItems={filteredItems}
            loading={loading}
            error={error}
            purchaseCtx={purchaseCtx}
            actorIdsWithPickup={actorIdsWithPickup}
            query={query}
            onClearQuery={() => setQuery('')}
            onAddBest={handleAddBest}
            onViewItem={setSlideOverItem}
            onCategory={handleBannerCategory}
            cartItems={cartItems}
            onUpdateQty={actions.updateQuantity}
            onRemove={actions.removeItem}
            onCheckout={checkingOut ? undefined : handleCheckout}
            quoteRef={purchaseCtx?.quoteRef}
          />

          {/* Mobile: chips + filtros + sort + grid + FAB + drawers */}
          <MobileMarketplaceLayout
            familias={familias}
            familia={familia}
            onFamilia={setFamilia}
            oficio={oficio}
            onOficio={setOficio}
            actorNombres={actorNombres}
            selectedActores={selectedActores}
            onActores={setSelectedActores}
            onlyStock={onlyStock}
            onOnlyStock={setOnlyStock}
            sortBy={sortBy}
            onSortBy={setSortBy}
            minPrice={minPrice}
            maxPrice={maxPrice}
            onMinPrice={setMinPrice}
            onMaxPrice={setMaxPrice}
            filteredItems={filteredItems}
            loading={loading}
            error={error}
            purchaseCtx={purchaseCtx}
            actorIdsWithPickup={actorIdsWithPickup}
            query={query}
            onClearQuery={() => setQuery('')}
            onAddBest={handleAddBest}
            onViewItem={setSlideOverItem}
            cartItems={cartItems}
            onUpdateQty={actions.updateQuantity}
            onRemove={actions.removeItem}
            onCheckout={checkingOut ? undefined : handleCheckout}
            quoteRef={purchaseCtx?.quoteRef}
            mobileFiltersOpen={mobileFiltersOpen}
            onOpenMobileFilters={openMobileFilters}
            onCloseMobileFilters={closeMobileFilters}
            mobileCartOpen={mobileCartOpen}
            onOpenMobileCart={openMobileCart}
            onCloseMobileCart={closeMobileCart}
          />
        </>
      )}

      {/* SlideOver — común a ambos layouts (z-50) */}
      <MarketplaceProductSlideOver
        item={slideOverItem}
        onClose={() => setSlideOverItem(null)}
        onAdd={handleAddFromSlideOver}
        currentOfferingId={currentSlideOverCartItem?.offeringId ?? null}
        currentProviderName={currentSlideOverCartItem?.supplierName ?? null}
        currentQty={currentSlideOverCartItem?.cantidad ?? 1}
        onSubstitute={currentSlideOverCartItem ? handleSubstitute : undefined}
        location={location}
        orgId={org?.id ?? null}
      />

      {/* Overlay de hidratación del presupuesto */}
      {isHydrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-8 h-8 border-2 border-[#1A5A96] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-700">Preparando materiales del presupuesto…</p>
          </div>
        </div>
      )}

      {/* Modal merge/replace — cuando hay carrito pre-existente y llega un presupuesto */}
      {mergeDialogData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Tienes artículos en el carrito</h3>
            <p className="text-sm text-gray-600 mb-5">
              Tienes {mergeDialogData.existingCount} artículo{mergeDialogData.existingCount !== 1 ? 's' : ''} de una compra anterior.
              ¿Qué quieres hacer con el carrito del presupuesto?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleMergeReplace}
                className="w-full py-2.5 rounded-xl bg-[#1A5A96] text-white text-sm font-semibold hover:bg-[#1A5A96]/90 transition-colors"
              >
                Usar sólo los materiales del presupuesto
              </button>
              <button
                onClick={handleMergeKeep}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Añadir al carrito existente
              </button>
              <button
                onClick={() => setMergeDialogData(null)}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal selector de ubicación (B2) */}
      {locationModalOpen && (
        <LocationSelectorModal
          current={location}
          onSelect={setLocation}
          onClose={() => setLocationModalOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-white text-emerald-700 border border-emerald-200'
              : toast.type === 'error'
              ? 'bg-white text-red-600 border border-red-200'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}
          {toast.type === 'error'   && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />}
          {toast.type === 'info'    && <Info className="w-3.5 h-3.5 shrink-0 text-blue-500" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
