import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Info, ShoppingBag, User, MapPin, Package, AlertCircle, Search } from 'lucide-react';
import { ActivePage } from '../../types';
import { useSession } from '../../context/SessionContext';
import { useMarketplaceCart } from '../../hooks/useMarketplaceCart';
import {
  getMarketplaceCatalog,
  getMarketplaceFamilias,
} from '../../lib/api/marketplace-catalog';
import type { MarketplaceCatalogItem, CatalogPage, OfferingDetail } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';
import type { CartItem } from '../../lib/api/marketplace-checkout';
import { getCartDetail } from '../../lib/api/marketplace-checkout';
import {
  loadPurchaseContext,
  clearPurchaseContext,
} from '../../lib/marketplace/purchase-context';
import type { MarketplacePurchaseContext } from '../../lib/marketplace/purchase-context';

import MarketplaceBanner           from './MarketplaceBanner';
import MarketplaceHeader           from './MarketplaceHeader';
import MarketplaceFilters          from './MarketplaceFilters';
import type { SortBy }             from './MarketplaceFilters';
import MarketplaceGrid             from './MarketplaceGrid';
import MarketplaceProductSlideOver from './MarketplaceProductSlideOver';
import CartSidebar                 from './CartSidebar';
import { CartSidebarDesktop }      from './CartSidebar';

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

// ─── Pantalla principal ────────────────────────────────────────────────────────

interface Props {
  setCurrentPage: (p: ActivePage) => void;
  mode?: 'public' | 'professional';
}

export default function ScreenMarketplace({ setCurrentPage, mode = 'professional' }: Props) {
  const { org }    = useSession();
  const { state, actions } = useMarketplaceCart();

  // ── Contexto de compra (llega desde presupuesto) ───────────────────────────
  const [purchaseCtx, setPurchaseCtx]       = useState<MarketplacePurchaseContext | null>(null);
  const [unresolvedItems, setUnresolvedItems] = useState<CartItem[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const ctx = loadPurchaseContext();
    if (!ctx) return;

    setPurchaseCtx(ctx);
    setMobileCartOpen(true);

    // Evitar hidratación doble en StrictMode
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const cartId = sessionStorage.getItem('mkt_cart_id') ?? ctx.cartId;
    if (!cartId) return;

    // Hidratar carrito local desde el server cart
    getCartDetail(cartId).then(detail => {
      const resolved: LocalCartItem[] = detail.items
        .filter(item => item.activo && item.selected_offering_id)
        .map(item => ({
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
        }));

      const unresolved = detail.items.filter(item => item.activo && !item.selected_offering_id);

      actions.replaceWithServerCart(resolved, cartId);
      setUnresolvedItems(unresolved);
    }).catch(() => {
      // Si el carrito no existe o expiró, continuar sin hidratación
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearCtx = useCallback(() => {
    clearPurchaseContext();
    setPurchaseCtx(null);
    setUnresolvedItems([]);
    sessionStorage.removeItem('mkt_cart_id');
    actions.clearCart('manual');
  }, [actions]);

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
  const [slideOverItem, setSlideOverItem]   = useState<MarketplaceCatalogItem | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { toast, show: showToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cargar familias una sola vez ───────────────────────────────────────────
  useEffect(() => {
    getMarketplaceFamilias().then(setFamilias).catch(() => {});
  }, []);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = query.trim() ? 350 : 0;
    debounceRef.current = setTimeout(loadCatalog, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadCatalog]);

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
  const handleCheckout = mode === 'public'
    ? () => {
        sessionStorage.setItem('mk_return', '1');
        setCurrentPage(ActivePage.Login);
      }
    : () => setCurrentPage(ActivePage.MarketplaceComprar);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <MarketplaceHeader
        mode={mode}
        setCurrentPage={setCurrentPage}
        cartCount={cartCount}
        onOpenCart={() => setMobileCartOpen(true)}
        query={query}
        onQueryChange={setQuery}
        orgName={org?.nombre}
      />

      {/* Banner contextual presupuesto */}
      {purchaseCtx && (
        <PurchaseContextBanner
          ctx={purchaseCtx}
          unresolvedCount={unresolvedItems.length}
          onClear={handleClearCtx}
        />
      )}

      {/* Líneas sin proveedor */}
      {unresolvedItems.length > 0 && (
        <UnresolvedLinesPanel
          items={unresolvedItems}
          onSearch={setQuery}
        />
      )}

      {/* Layout 3 columnas */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Filtros (izquierda) */}
        <MarketplaceFilters
          familias={familias}
          familia={familia}
          onFamilia={setFamilia}
          oficio={oficio}
          onOficio={setOficio}
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
          totalResults={filteredItems.length}
          loading={loading}
        />

        {/* Centro: banner + productos */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!purchaseCtx && <MarketplaceBanner onCategory={handleBannerCategory} />}

          <div className="flex-1 overflow-y-auto">
            <MarketplaceGrid
              items={filteredItems}
              loading={loading}
              error={error}
              query={query}
              onClearQuery={() => setQuery('')}
              onAddBest={handleAddBest}
              onViewOptions={setSlideOverItem}
            />
          </div>
        </div>

        {/* Carrito (derecha) */}
        <CartSidebarDesktop
          items={cartItems}
          onUpdateQty={actions.updateQuantity}
          onRemove={actions.removeItem}
          onCheckout={handleCheckout}
        />
      </div>

      {/* SlideOver opciones */}
      <MarketplaceProductSlideOver
        item={slideOverItem}
        onClose={() => setSlideOverItem(null)}
        onAdd={handleAddFromSlideOver}
        currentOfferingId={currentSlideOverCartItem?.offeringId ?? null}
        currentProviderName={currentSlideOverCartItem?.supplierName ?? null}
        currentQty={currentSlideOverCartItem?.cantidad ?? 1}
        onSubstitute={currentSlideOverCartItem ? handleSubstitute : undefined}
      />

      {/* Carrito drawer móvil */}
      <CartSidebar
        items={cartItems}
        isOpen={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        onUpdateQty={actions.updateQuantity}
        onRemove={actions.removeItem}
        onCheckout={handleCheckout}
      />

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
