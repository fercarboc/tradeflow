# RC1-C.1.b · Navigation Consolidation — Resultados

**Estado:** COMPLETADO  
**Fecha ejecución:** 2026-08-07  
**Commit:** pendiente  
**Referencia spec:** PRE-2026-089  

---

## 1. RESUMEN EJECUTIVO

RC1-C.1.b consolida la navegación del Marketplace eliminando los puntos de entrada duplicados y legado, estableciendo un flujo único y coherente desde el presupuesto hasta "Mis pedidos".

**Resultado: 6 archivos modificados · 1 archivo eliminado · 0 errores TypeScript nuevos**

---

## 2. FLUJO OBJETIVO (POST RC1-C.1.b)

```
Presupuesto (ficha o listado)
  └─ CTA único "Comprar materiales"
       ├─ createCartFromQuote(quoteId)
       ├─ savePurchaseContext({ source:'quote', cartId, quoteRef, customerName, projectName, ... })
       ├─ sessionStorage.setItem('mkt_cart_id', cartId)
       └─ navigate → ActivePage.Marketplace (/app/marketplace)
            └─ ScreenMarketplace monta
                 ├─ loadPurchaseContext() → muestra PurchaseContextBanner
                 ├─ setMobileCartOpen(true) → carrito lateral abierto en móvil
                 ├─ CartSidebarDesktop visible con ítems precargados
                 └─ CartSidebar.onCheckout = () => navigate(ActivePage.MarketplaceComprar)
                      └─ MarketplaceComprarView (/marketplace/comprar)
                           ├─ Wizard: Revisar → Entrega → Confirmar → Éxito
                           ├─ Botón "← Catálogo" en paso Revisar → vuelve a Marketplace
                           └─ Éxito → "Ver seguimiento" o "Volver al presupuesto"
```

---

## 3. CAMBIOS APLICADOS

### 3.1 `AppDashboardView.tsx`

| Línea original | Cambio | Motivo |
|---|---|---|
| 3748 | `MarketplaceComprar` → `Marketplace` | CTA desde PostConfirmModal debía ir al catálogo |
| 5878 | `'Pedidos'` → `'Mis pedidos'` | Nombre definitivo del header de sección |
| 5961 | `MarketplaceComprar` → `Marketplace` | CTA desde PreviewPresupuesto debía ir al catálogo |

### 3.2 `ScreenMarketplace.tsx`

- **Import:** `loadPurchaseContext`, `clearPurchaseContext`, `MarketplacePurchaseContext` desde purchase-context
- **Estado:** `purchaseCtx: MarketplacePurchaseContext | null` — cargado en mount
- **useEffect mount:** lee `loadPurchaseContext()` → si existe, guarda estado y llama `setMobileCartOpen(true)` para auto-abrir carrito en móvil
- **Función `handleClearCtx`:** `clearPurchaseContext()` + `setPurchaseCtx(null)`
- **Componente `PurchaseContextBanner`:** banner azul contextual definido FUERA del componente principal (evita re-mount). Muestra: quoteRef, customerName (icono User), projectName (icono MapPin), lineCount (icono Package)
- **`handleCheckout`:** reemplaza `handleGuestCheckout`; para modo profesional navega a `ActivePage.MarketplaceComprar`; para modo público redirige a login
- **CartSidebarDesktop / CartSidebar:** `onCheckout={handleCheckout}` (ya no es `undefined` en modo profesional)

### 3.3 `CartSidebar.tsx`

- Botón habilitado (cuando `onCheckout` definido): texto cambiado de "Identificarte para continuar" a **"Ir al checkout"**; eliminado icono Lock del botón activo
- Botón deshabilitado: mantiene icono Lock y texto "Ir al checkout"
- Eliminada nota "Checkout disponible próximamente"

### 3.4 `MarketplaceComprarView.tsx`

- **`backLabel('revisar')`:** `'Presupuesto'` → `'Catálogo'`
- **`volverAlCatalogo`:** nueva función → `setCurrentPage(ActivePage.Marketplace)`
- **ContextBanner `onVolver`:** usa `volverAlCatalogo` (antes `volverAlPresupuesto`)
- **Botón atrás paso Revisar:** usa `volverAlCatalogo` (antes `volverAlPresupuesto`)
- **`volverAlPresupuesto`:** se conserva para el botón de la pantalla de éxito

### 3.5 `src/components/ScreenPedidosMaterial.tsx` — ELIMINADO

Archivo legacy con pantalla "Nuevo pedido de material" / "Desde presupuestos". No estaba importado en `AppDashboardView` desde RC1-C.1.a. Eliminado del disco.

### 3.6 `src/lib/supabase.ts`

Eliminada línea: `export * from './api/pedidos';`  
`pedidos.ts` mantiene su anotación `// @deprecated RC1-C.1.a` pero ya no se re-exporta.

---

## 4. COMPONENTE `PurchaseContextBanner` — SPEC

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🛍  PRE-2026-089 · Juan García · C/ Mayor 5  · 12 líneas de material │  [Limpiar contexto]
└─────────────────────────────────────────────────────────────────────┘
```

- Fondo `bg-blue-50`, borde inferior `border-blue-100`
- Visible solo cuando `purchaseCtx !== null`
- "Limpiar contexto": llama `clearPurchaseContext()` y oculta el banner

---

## 5. E2E TEST PRE-2026-089 — 14 PASOS

| # | Acción | Resultado esperado |
|---|---|---|
| T1 | Abrir presupuesto con líneas de material | Ficha de presupuesto visible |
| T2 | Hacer clic en "Comprar materiales" | Spinner de carga breve |
| T3 | Marketplace se carga | URL: `/app/marketplace` |
| T4 | Banner contextual visible | Muestra ref presupuesto + cliente |
| T5 | CartSidebarDesktop muestra ítems precargados | Ítems del presupuesto en el carrito |
| T6 | En móvil, drawer carrito abierto automáticamente | `mobileCartOpen = true` en mount |
| T7 | Usuario añade/elimina productos del catálogo | Cart se actualiza en tiempo real |
| T8 | Clic en "Ir al checkout" en CartSidebar | Navega a `/marketplace/comprar` |
| T9 | MarketplaceComprarView carga con ítems | Step "Revisar" con cart completo |
| T10 | ContextBanner muestra ref presupuesto | Banner azul en la cabecera del wizard |
| T11 | Clic en "← Catálogo" | Vuelve a `/app/marketplace` con contexto |
| T12 | Completar wizard (entrega + confirmar) | Pedidos creados en BD |
| T13 | Pantalla Éxito → "Ver seguimiento" | Navega a SeguimientoMaterial |
| T14 | "Mis pedidos" en sidebar muestra el header correcto | Header: "Mis pedidos" |

---

## 6. CÓDIGO LEGACY ELIMINADO / INUTILIZADO

| Símbolo | Estado |
|---|---|
| `ScreenPedidosMaterial` | Archivo eliminado |
| `setPedirMaterialQuote` | No existe en codebase (ya limpiado en RC1-C.1.a) |
| `pedirMaterialQuote` | No existe en codebase (ya limpiado en RC1-C.1.a) |
| `export * from './api/pedidos'` | Eliminado de supabase.ts |
| `handleGuestCheckout` (undefined para profesional) | Reemplazado por `handleCheckout` |
| Overlay legacy "Pedir material" | Eliminado en RC1-C.1.a |

---

## 7. PENDIENTE

- Sprint Guest-2 continúa BLOQUEADO hasta cierre de Consolidación UX
- `src/lib/api/pedidos.ts` mantiene su anotación `@deprecated RC1-C.1.a`; pendiente decisión de eliminar archivo o mantener como histórico

---

## 8. ROLLBACK

Si es necesario revertir:

```bash
git revert HEAD  # revertir el commit de RC1-C.1.b
```

O manualmente:
1. Restaurar `ScreenPedidosMaterial.tsx` desde git: `git show HEAD~1:src/components/ScreenPedidosMaterial.tsx > src/components/ScreenPedidosMaterial.tsx`
2. Revertir líneas en `AppDashboardView.tsx` (3748, 5878, 5961)
3. Revertir `ScreenMarketplace.tsx` al commit anterior
4. Revertir `CartSidebar.tsx`
5. Revertir `MarketplaceComprarView.tsx`
6. Añadir de nuevo `export * from './api/pedidos';` en `supabase.ts`
