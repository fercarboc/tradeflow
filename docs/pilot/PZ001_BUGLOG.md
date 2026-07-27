# PZ-001 — Bug Log

**Piloto Zero · TrabFlow Marketplace**
**Formato:** ID · Fecha · Paso · Usuario · Descripción · Severidad · Estado · Solución · Commit

---

## Severidades

- **BLOQUEANTE** — Impide continuar el flujo. Debe corregirse antes de seguir.
- **ALTA** — Afecta significativamente la UX o el flujo pero hay workaround.
- **MEDIA** — Problema visible pero el flujo puede completarse.
- **BAJA** — Cosmético o menor.

## Estados

- `ABIERTO` — Detectado, sin solución.
- `EN CURSO` — En desarrollo.
- `RESUELTO` — Corregido y desplegado.
- `DESCARTADO` — No es un bug (comportamiento esperado).

---

## Bugs Activos

### BUG-001

**Fecha:** 2026-07-26
**Paso:** Paso 11 (Cerrar sesión Portal Proveedor)
**Usuario:** contacto@inmostay.com
**Descripción:** El botón "Salir del portal" navegaba a AppDashboard en lugar de cerrar sesión. Para usuarios supplier-only (sin org instaladora), AppDashboard redirigía de vuelta al Portal creando un bucle infinito.
**Reproducción:**
1. Login contacto@inmostay.com → Portal Proveedor
2. Clic "Salir del portal"
3. Flash de AppDashboard
4. Vuelta automática al Portal
5. Bucle infinito, imposible salir

**Captura:** (ver screenshot en conversación PZ-001)
**Severidad:** ALTA
**Estado:** RESUELTO
**Solución:** Reemplazar "Salir del portal" por "Cerrar sesión" (signOut) para supplier-only y "Cambiar de espacio" + "Cerrar sesión" para usuarios duales. SIGNED_OUT navega a /login.
**Commit:** aeee83c

---

### BUG-002

**Fecha:** 2026-07-26
**Paso:** Paso 9 (Login proveedor)
**Usuario:** contacto@inmostay.com
**Descripción:** Org fantasma "contacto" creada automáticamente al acceder desde navegador con caché del service worker del código antiguo. El código ejecutaba `getOrCreateOrg()` antes de comprobar si el usuario tenía membresía marketplace.
**Reproducción:** Solo reproducible con caché de service worker de versión anterior a e8a9d58.
**Captura:** (ver conversación — org id b751e0f8)
**Severidad:** ALTA
**Estado:** RESUELTO
**Solución:** (1) Defensa en AppDashboardView: comprobar membresía marketplace antes de llamar getOrCreateOrg(). (2) Mover creación de org al Paso 1 del wizard. (3) Org fantasma eliminada de DB.
**Commit:** 65ba6b3

---

### BUG-003

**Fecha:** 2026-07-26
**Paso:** Paso 9 (Login proveedor)
**Usuario:** contacto@inmostay.com
**Descripción:** Routing fallaba porque workspaceResolver usaba un segundo cliente Supabase (lib/client.ts) que no compartía sesión con el cliente principal (lib/supabase.ts). La RPC get_my_marketplace_memberships devolvía vacío aunque el usuario estaba autenticado.
**Severidad:** BLOQUEANTE
**Estado:** RESUELTO
**Solución:** workspaceResolver.ts migrado a usar lib/supabase.ts directamente.
**Commit:** e8a9d58

---

## Bugs Encontrados Durante PZ-001

*Registrar aquí los bugs encontrados durante la ejecución del piloto.*

### BUG-004

**Fecha:** 2026-07-26
**Paso:** Paso 4 (Acceder Marketplace desde presupuesto PRE-2026-081)
**Usuario:** legal@inmostay.com
**Descripción:** Al pulsar MARKETPLACE en PRE-2026-081 aparecía "Error al preparar el carrito" en lugar del mensaje correcto "Todo el material de este presupuesto ya fue pedido". La causa real era que todos los items tenían `material_order_placed = true` (pedidos previamente por PEDIR MATERIAL), pero el check de `NO_MATERIALS` en el catch fallaba porque `rpcError()` llamaba `String(error)` sobre un PostgrestError, devolviendo `[object Object]` en lugar del mensaje de error.
**Reproducción:**
1. Crear un pedido de material en un presupuesto con PEDIR MATERIAL
2. Intentar abrir ese mismo presupuesto con MARKETPLACE
3. La RPC `create_cart_from_quote` devuelve error `NO_MATERIALS`
4. La UI muestra "Error al preparar el carrito" en lugar del mensaje descriptivo

**Captura:** screenshot compartido en sesión PZ-001 (2026-07-26)
**Severidad:** ALTA
**Estado:** RESUELTO
**Solución:** (1) Fix `rpcError()` en `marketplace-checkout.ts` para extraer `.message` de objetos PostgrestError. (2) Reset de `material_order_placed = false` en los items de PRE-2026-081 para permitir continuar el piloto.
**Commit:** 1ab947b

---

### BUG-005

**Fecha:** 2026-07-26
**Paso:** Paso 5 (Seleccionar proveedor en Marketplace)
**Usuario:** legal@inmostay.com
**Descripción:** Al entrar en el flujo Marketplace con un presupuesto de reforma de baño, el carrito se cargaba con los items pero no mostraba alternativas de proveedor para ninguno. Los botones de filtro (Balance / Precio / Velocidad / Consolidar) estaban deshabilitados y el botón "Revisar pedido →" también. La causa era que `trade_marketplace_universal_products` estaba vacía y ninguna de las 178 ofertas de OBRAMAT Demo tenía `match_state = 'matched'`.
**Reproducción:**
1. Abrir presupuesto de reforma baño
2. Pulsar MARKETPLACE
3. El carrito muestra los items pero sin proveedor disponible
4. Filtros y botón "Revisar pedido" permanecen deshabilitados

**Captura:** screenshot compartido en sesión PZ-001 (2026-07-26) — carrito con items sin alternativas
**Severidad:** BLOQUEANTE
**Estado:** RESUELTO
**Solución:** (1) Creados 6 Productos Universales piloto (PZ-FON-001 a PZ-FON-006) en `trade_marketplace_universal_products`. (2) 16 ofertas de OBRAMAT Demo vinculadas con `match_state='matched'`, `match_method='admin'`, `match_confidence=0.90`. (3) Corregida dirección del match semántico en `create_cart_from_quote` (bidireccional: item⊇UP o UP⊂item).
**Commit:** DB-only (migraciones aplicadas en Supabase: `fix_universal_products_unique_constraints`, `fix_create_cart_semantic_match_v2`)

---

### BUG-006

**Fecha:** 2026-07-27
**Paso:** Paso 11 (Portal Proveedor → pestaña Pedidos)
**Usuario:** contacto@inmostay.com
**Descripción:** Al hacer click en la pestaña "Pedidos" del Portal Proveedor, la lista mostraba en rojo "Error al cargar pedidos" aunque los pedidos existían en BD y el dashboard del portal funcionaba correctamente.
**Reproducción:**
1. Login contacto@inmostay.com → Portal Proveedor (dashboard OK)
2. Hacer click en "Pedidos"
3. La lista muestra "Error al cargar pedidos"

**Causa raíz:** `marketplace-portal.ts` importaba desde `lib/client.ts` (segundo cliente Supabase). Al igual que BUG-003 con `workspaceResolver.ts`, el segundo cliente puede no tener la sesión en memoria en el momento del primer render aunque el usuario esté autenticado. La llamada RPC `get_supplier_orders_unified` se ejecutaba sin auth → PERMISSION_DENIED. El catch block mostraba el string hardcodeado en lugar del error real porque `PostgrestError` no es `instanceof Error`.
**Severidad:** BLOQUEANTE
**Estado:** RESUELTO
**Solución:** (1) `marketplace-portal.ts` migrado de `lib/client.ts` a `lib/supabase.ts` (cliente principal compartido por todo el portal). (2) Catch block de `PortalPedidos.tsx` mejorado para extraer `.message` de PostgrestError en lugar del string hardcodeado.
**Commit:** d2774de

---
