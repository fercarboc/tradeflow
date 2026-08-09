# RC1-C.5B — Integración Visual de Locations, Stock Local y Promociones

**Fecha:** 2026-08-09  
**Sprint:** RC1 — Release Candidate 1  
**Estado:** COMPLETADO

---

## Resumen

Integración visual completa de la infraestructura RC1-C.5A.2 (locations, stock local, precio por ubicación, promociones) en todos los puntos de contacto del marketplace y el portal de proveedor.

---

## Fases implementadas

### B1 — Señales en tarjeta de producto
**Archivo:** `src/components/marketplace/MarketplaceProductCard.tsx`

- Nuevo prop `hasPickupNearby?: boolean`
- Chip "Recogida local disponible" con `MapPin` icon cuando hay tienda cercana
- Sin llamadas async por tarjeta — la señal se resuelve desde el Set precargado

### B2 — Banner de ubicación en Marketplace
**Archivo:** `src/components/marketplace/ScreenMarketplace.tsx`

Componentes a nivel de módulo (sin inner components):
- `LocationBanner` — barra "Disponibilidad cerca de: X · Cambiar"
- `LocationSetButton` — botón de activación cuando no hay contexto
- `LocationSelectorModal` — selector con 6 presets + input libre + opción vaciar

Hook de estado:
- `useMarketplaceLocation()` — contexto persistido en `sessionStorage`
- Clave: `mkt_location_ctx`

### B3 & B4 — Comparador con precio local
**Archivo:** `src/components/marketplace/MarketplaceProductSlideOver.tsx`

- `enrich()` ejecuta en paralelo: `getLocationsForActor()` por cada actor único + `resolveEffectivePriceWithLocation()` por cada offering
- Cancellación con flag `cancelled` al limpiar el efecto
- `OfferingRow` muestra precio local vs. precio base cuando hay deal local (`effectivePrice.net_amount < offering.precio_coste`)
- Etiqueta del source: `promotion_id` → muestra nombre de promo; `location` → precio local; `national` → precio estándar

### B5 — Sección de recogida en SlideOver
**Archivo:** `src/components/marketplace/MarketplaceProductSlideOver.tsx`

- Sección "Recogida disponible" bajo cada offering cuando hay locations con `permite_recogida`
- Muestra top 3 locations con: nombre, tipo, localidad, distancia km
- Estado de stock: chip por location

### B6 — Fallback nacional sin stock local
**Archivo:** `src/components/marketplace/MarketplaceProductSlideOver.tsx`

- Cuando `effectivePrice.price_source === 'national'` y hay location context → aviso "Precio nacional (sin stock local en [localidad])"
- Consistente con la lógica `get_local_stock` de la BD

### B7 — Etiquetado de promociones
**Archivo:** `src/components/marketplace/MarketplaceProductSlideOver.tsx`

- `price_source` discrimina entre `national_promo`, `regional_promo`, `local_promo`
- Badge de promo con scope (Nacional / Regional / Local) visible en `OfferingRow`

### B8 — Portal: Tiendas y almacenes (CRUD)
**Archivo:** `src/components/portal/PortalTiendas.tsx`

Layout dos paneles:
- **Panel izquierdo:** lista de locations con búsqueda + filtro; toggle activa/inactiva
- **Panel derecho:** detalle de la location seleccionada con tabs Configuración / Stock local
- `LocationSlideOver` — formulario crear/editar con todos los campos del spec (nombre, tipo, dirección, localidad, provincia, teléfono, email, permite_recogida, permite_entrega_local, radio_servicio_km, activa, orden)
- `LocationCard` — visual con tipo badge, estado, capacidades
- Operación: upsert a `trade_marketplace_supplier_locations`

### B9 — Stock local por location
**Archivo:** `src/components/portal/PortalTiendas.tsx` (tab "Stock local")

- Componente `StockLocalTab` — carga inventory + offerings del actor en paralelo
- Muestra todas las referencias del catálogo (con o sin override)
- Edición inline de: `stock_status`, `stock_cantidad`, `plazo_local_dias`
- Guardado individual por fila con `upsert` sobre `trade_marketplace_location_inventory`
- No permite modificar offerings de otro actor (query filtrada por `actor_id`)

### B10 — Promociones locales en Portal
**Archivo:** `src/components/portal/PortalMarketing.tsx`

- Lista con filtros: estado (activa/programada/inactiva/expirada) + alcance (nacional/regional/local) + búsqueda libre
- `PromoCard` — muestra código, nombre, scope badge, status badge, valor formateado, fechas
- `PromoSlideOver` — formulario completo: tipo, valor, fechas, alcance, comunidades, locations target, offerings target, toggle activa
- Operación: upsert a `trade_marketplace_promotions`
- Aviso invariante: "Las promociones afectan al precio, no al ranking"

### Portal tabs registrados
**Archivos:** `src/components/portal/PortalContext.tsx`, `src/components/portal/PortalProveedorView.tsx`

- `PortalTab` type extendido con `'tiendas' | 'marketing'`
- `VALID_TABS` actualizado
- Nav items: Store icon (Tiendas) + Tag icon (Marketing)
- `renderScreen()`: casos `'tiendas'` y `'marketing'`
- Lazy loading con React.lazy() + Suspense

---

## Fases excluidas por spec

| Fase | Motivo |
|------|--------|
| B11 — ScreenProveedor público | `ScreenProveedor` no existe todavía |
| B12 — Mobile | Absorbido en B8-B10 con diseño responsive |
| B13 — Tests | Manuales según checklist T1-T10 |

---

## Invariante mantenida

**PUBLICIDAD ≠ RANKING** — En ningún punto de esta integración existe código que modifique el orden de resultados en función de inversión publicitaria. Las promociones afectan únicamente al precio visible. El ranking se mantiene ordenado por stock_ok → precio_min → plazo_min.

---

## Archivos modificados / creados

| Archivo | Estado |
|---------|--------|
| `src/hooks/useMarketplaceLocation.ts` | Creado |
| `src/lib/api/marketplace-catalog.ts` | Modificado (`getActorIdsWithPickupLocations`) |
| `src/components/marketplace/MarketplaceProductCard.tsx` | Modificado (señal pickup) |
| `src/components/marketplace/MarketplaceGrid.tsx` | Modificado (prop `actorIdsWithPickup`) |
| `src/components/marketplace/MarketplaceProductSlideOver.tsx` | Reescrito (enrich + pickup + promo) |
| `src/components/marketplace/ScreenMarketplace.tsx` | Modificado (location context + banners) |
| `src/components/portal/PortalContext.tsx` | Modificado (tipos 'tiendas', 'marketing') |
| `src/components/portal/PortalProveedorView.tsx` | Modificado (lazy tabs + nav) |
| `src/components/portal/PortalTiendas.tsx` | Creado (B8 + B9) |
| `src/components/portal/PortalMarketing.tsx` | Creado (B10) |

---

## Tests T1-T10 (verificación manual)

| ID | Descripción | Componente |
|----|-------------|------------|
| T1 | Card sin location → sin señal pickup | MarketplaceProductCard |
| T2 | Card con location + actor con tienda → señal visible | MarketplaceProductCard |
| T3 | Banner aparece cuando hay location activa | ScreenMarketplace |
| T4 | Modal selector muestra 6 presets + input libre | LocationSelectorModal |
| T5 | Limpiar ubicación elimina banner y señales | ScreenMarketplace |
| T6 | SlideOver con location muestra precio local y pickup | MarketplaceProductSlideOver |
| T7 | SlideOver sin location muestra precio base sin pickup | MarketplaceProductSlideOver |
| T8 | Portal Tiendas CRUD completo (crear/editar/toggle) | PortalTiendas |
| T9 | Tab Stock local muestra referencias y guarda overrides | StockLocalTab |
| T10 | Portal Marketing crea/edita/filtra promociones | PortalMarketing |
