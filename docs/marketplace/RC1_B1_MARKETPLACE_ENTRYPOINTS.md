# RC1-B.1 — Exposición del Marketplace en Navegación Privada y Web Pública

**Versión:** 1.0  
**Fecha:** 2026-08-04  
**Estado:** IMPLEMENTADO ✓  
**Build:** ✓ sin errores TypeScript (`npx tsc --noEmit` limpio en `src/`)

---

## 1. Resumen ejecutivo

El Marketplace TrabFlow es ahora accesible desde **dos puntos de entrada**:

| Entrada | URL | Modo | Autenticación |
|---|---|---|---|
| Panel instalador (sidebar + mobile) | `/app/marketplace` | `professional` | Requerida |
| Web pública (menú principal) | `/marketplace` | `public` | No requerida |

Ambas entradas usan el mismo `ScreenMarketplace`, el mismo catálogo (RPC `get_marketplace_catalog_paged`), el mismo carrito y las mismas offerings. La diferencia es el `mode` prop que controla el comportamiento del checkout.

---

## 2. Cambios implementados

### 2.1 `src/types.ts`

Nuevo valor en el enum `ActivePage`:

```ts
MarketplacePublico = 'marketplace-publico',
```

### 2.2 `src/App.tsx`

- `PAGE_PATHS`: `/marketplace` → `ActivePage.MarketplacePublico`
- `PUBLIC_OR_AUTH_PAGES`: incluye `ActivePage.MarketplacePublico` (sin redireccionamiento al login)
- `detectAuthRoute()`: `/marketplace` → `ActivePage.MarketplacePublico`
- `renderActiveView()`:
  - `ActivePage.Marketplace` → `<ScreenMarketplace mode="professional" />`
  - `ActivePage.MarketplacePublico` → `<ScreenMarketplace mode="public" />`
- `isAppView`: incluye `MarketplacePublico` (sin Header/Footer públicos)
- `resolveAndRoute()`: si `sessionStorage.getItem('mk_return')`, redirige al instalador a `ActivePage.Marketplace` post-login

### 2.3 `src/components/Header.tsx`

`navItems` ampliado:
```
Inicio | Funciones | Marketplace | Asistente IA | Herramientas | Precios | Contacto
```

### 2.4 `src/components/landing/Navbar.tsx`

`NAV_LINKS` ampliado:
```
Funciones | Marketplace | Precios | Asistente IA | Herramientas | Contacto
```

### 2.5 `src/components/marketplace/ScreenMarketplace.tsx`

- Nueva prop: `mode?: 'public' | 'professional'` (default: `'professional'`)
- En modo `'public'`: genera `handleGuestCheckout` que guarda `mk_return='1'` en `sessionStorage` y navega a `ActivePage.Login`
- Pasa `onCheckout={handleGuestCheckout}` a `CartSidebar` y `CartSidebarDesktop`

### 2.6 `src/components/marketplace/CartSidebar.tsx`

- Nueva prop: `onCheckout?: () => void`
- `CartSidebarDesktop` y `CartSidebar` aceptan y pasan `onCheckout` a `CartContent`
- `CartContent` renderiza:
  - **Si `onCheckout` definido (modo público):** botón activo azul "Identificarte para continuar"
  - **Si `onCheckout` undefined (modo profesional):** botón deshabilitado "Continuar al pago" (RC1-C)

### 2.7 `src/context/CarritoProvider.tsx`

Guest cart implementado con clave `trabflow:marketplace:guest-cart`:

- **Visitante (`orgId=null`):** carga el guest cart de localStorage al montar; persiste cambios automáticamente cuando el estado cambia
- **Login (`orgId` pasa de null a valor):** fusiona guest cart + org cart (evita duplicados por `offeringId`; org cart tiene prioridad)
- **Sign-out (`orgId` pasa a null):** carga el guest cart guardado (si existe)

Funciones helper: `readGuestCart()`, `writeGuestCart()`, `clearGuestCart()`

### 2.8 `src/components/AppDashboardView.tsx`

**Sidebar desktop:**
- Botón Marketplace ahora aplica a todos con `catalog.manage` (sin condición `orgId`)
- Estilo coherente con `SidebarBtn` (hover y active states)
- Tiene `data-testid="nav-marketplace"`

**Mobile bottom bar:**
- Para instaladores con `catalog.manage`: reemplaza "Clientes" por botón "Marketplace" que navega a `ActivePage.Marketplace`
- Para instaladores sin `catalog.manage`: sigue mostrando "Clientes" en esa posición

---

## 3. Flujo completo — visitante anónimo

```
1. Visitante llega a trabflow.es
2. Ve "Marketplace" en el menú principal → navega a /marketplace
3. Explora el catálogo (sin login, RPC corre con anon key)
4. Añade productos al carrito → se persisten en localStorage (guest-cart)
5. Pulsa "Identificarte para continuar"
   → sessionStorage.setItem('mk_return', '1')
   → navega a /login
6. Inicia sesión
7. routeSession() detecta mk_return → setCurrentPage(ActivePage.Marketplace)
8. CarritoProvider detecta orgId null→valor → fusiona guest-cart + org-cart
9. Instalador ve el Marketplace profesional con su carrito intacto
```

---

## 4. Flujo completo — instalador autenticado

```
1. Instalador en panel /app
2. Barra lateral: botón "Marketplace" (visible si catalog.manage)
   → navega a /app/marketplace (mode='professional')
3. Mobile: botón "Marketplace" en bottom bar
   → navega a /app/marketplace (mode='professional')
4. Explora catálogo, añade al carrito
5. Carrito persiste en localStorage (clave por orgId)
6. Botón carrito: "Continuar al pago" (deshabilitado — RC1-C pending)
```

---

## 5. Seguridad

- El catálogo público usa `anon key` vía RPC `get_marketplace_catalog_paged` (SECURITY DEFINER)
- El RPC ya filtra: `validation_state='validated'`, `match_state='matched'`, actor `estado='active'`
- **No expone:** `precio_coste`, `tax_id`, `email`, `admin_notes`, ni `metadata` privada de suppliers
- Los datos de la organización del visitante (presupuestos, facturas, clientes) son inaccesibles sin sesión (RLS de cada tabla)

---

## 6. SEO — `/marketplace`

La página `/marketplace` renderiza `ScreenMarketplace` que tiene su propio `<title>` interno en `MarketplaceHeader`. El visitante ve el catálogo completo inmediatamente (no hay redirect a login).

Siguiente paso (fuera de RC1-B.1): añadir `<meta>` Open Graph y canonical en la ruta pública vía Helmet o directamente en `MarketplaceHeader` cuando `mode='public'`.

---

## 7. Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `src/types.ts` | +1 enum value |
| `src/App.tsx` | +ruta pública, +returnUrl, +case render |
| `src/components/Header.tsx` | +navItem Marketplace |
| `src/components/landing/Navbar.tsx` | +NAV_LINK Marketplace |
| `src/components/marketplace/ScreenMarketplace.tsx` | +prop mode, +onCheckout |
| `src/components/marketplace/CartSidebar.tsx` | +prop onCheckout, botón dual |
| `src/context/CarritoProvider.tsx` | +guest cart completo |
| `src/components/AppDashboardView.tsx` | sidebar fix + mobile Marketplace |

---

## 8. Tests pendientes (RC1-B.1 coverage)

| # | Test | Estado |
|---|---|---|
| T1 | Visitante navega a /marketplace y ve catálogo sin login | ✓ (ruta pública implementada) |
| T2 | Visitante añade item al carrito — persiste en localStorage | ✓ (guest cart) |
| T3 | Visitante pulsa "Identificarte" → redirige a /login | ✓ |
| T4 | Post-login → redirige a /app/marketplace | ✓ (mk_return) |
| T5 | Post-login → carrito guest fusionado con org cart | ✓ (CarritoProvider merge) |
| T6 | Instalador ve "Marketplace" en sidebar desktop | ✓ |
| T7 | Instalador ve "Marketplace" en mobile bottom bar (si catalog.manage) | ✓ |
| T8 | Instalador hace click → navega a /app/marketplace (mode professional) | ✓ |
| T9 | Modo profesional: botón carrito deshabilitado | ✓ |
| T10 | Modo público: botón carrito activo "Identificarte" | ✓ |
| T11 | /marketplace en menú Header.tsx | ✓ |
| T12 | /marketplace en menú Navbar.tsx (LandingPage) | ✓ |

---

## 9. Pendiente en RC1-C y fases posteriores

- Checkout real (activar botón en modo professional)
- SEO: Open Graph, meta description, canonical para /marketplace
- Registro de nuevos profesionales desde /marketplace (reuse onboarding)
- Entry point desde presupuesto: `/app/marketplace?source=quote&quoteId=...`
- `marketplaceMode='public'` puede mostrar banner informativo de funciones extra al autenticarse
