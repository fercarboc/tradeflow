# RC1-C.6 — Estabilización Marketplace: Resultados

**Fecha:** 2026-08-10
**Sprint:** RC1 — Release Candidate 1
**Estado:** COMPLETADO

---

## Resumen ejecutivo

Se identificaron y corrigieron los tres bugs P0 que bloqueaban el flujo completo de compra desde presupuesto, más tres bugs P1 que producían duplicados y filtros rotos. También se arreglaron columnas incorrectas en el portal de proveedor y el contraste visual de las tarjetas IA.

---

## Bugs corregidos

### P0 — BLOCK D: Resolución de productos presupuesto → marketplace

**Síntoma:** Materiales encontrados en el presupuesto no aparecían en el carrito del marketplace (siempre "sin proveedor").

**Causa raíz:** `create_cart_from_quote` PATH 2 filtraba `match_state = 'matched'` pero las offerings demo tienen `match_state = 'pending_review'`. El resultado era siempre NULL → `v_alternatives = '[]'` → sin proveedor seleccionado.

**Fix aplicado (migración `rc1_c6_fix_create_cart_from_quote_direct_ref`):**
- Nuevo **PATH 1.5**: resolución directa por `supplier_ref + supplier_key` sin pasar por UP resolution.
- Cuando un item del presupuesto tiene `supplier_ref = 'OBR-ELE-018'` y `supplier_key = 'obramat'`, se busca la offering exacta en el catálogo vinculado al actor marketplace activo.
- El PATH 1.5 acepta `match_state = 'pending_review'` porque la referencia directa es identificación unívoca.
- Aliases JSON completos en `provider_alternatives` con `score = 100`.

---

### P0 — BLOCK I: Checkout bloqueado (columnas inexistentes)

**Síntoma:** Todo checkout terminaba en error — ningún pedido podía completarse.

**Causa raíz:** `checkout_cart_v2` referenciaba dos columnas que no existen:
- `a.activo = false` → `trade_marketplace_actors` usa `estado text` (no `activo boolean`)
- `o.activo = false` → `trade_marketplace_supplier_offerings` usa `activa boolean` (no `activo`)
- PL/pgSQL no valida referencias de columnas en tiempo de creación, solo en ejecución → función se crea sin error pero falla siempre.

**Fix aplicado (migración `rc1_c6_fix_checkout_cart_v2_columns`):**
- `AND a.activo = false` → `AND a.estado != 'active'`
- `AND o.activo = false` → `AND o.activa = false`
- Resto de la función sin cambios (idempotencia, outbox, eventos de auditoría intactos).

---

### P0 — BLOCK G: Ghost carts (carros huérfanos)

**Síntoma:** Cada vez que el usuario volvía al presupuesto y pulsaba "Comprar materiales" de nuevo, se creaba un carrito nuevo, abandonando el anterior.

**Fix aplicado (migración `rc1_c6_fix_create_cart_resume_existing`):**
- Al inicio de `create_cart_from_quote`, busca cart con `estado IN ('active', 'reviewing')` para la misma `quote_id + org_id`.
- Si existe, devuelve su `id` directamente sin crear ni duplicar ítems.
- Si no existe, crea el cart normalmente (flujo anterior).

---

### P1 — BLOCK A: Proveedores duplicados en panel instalador

**Síntoma:** La pantalla "Proveedores / Catálogos" mostraba 22+ entradas (catálogos legacy ariston, baxi, daikin, obramat, bricomart, etc.), causando que el mismo proveedor apareciera 6+ veces.

**Causa raíz:** Query cargaba TODOS los `trade_supplier_catalogs` con `org_id IS NULL AND is_active = true` — incluyendo catálogos legacy sin actor marketplace.

**Fix aplicado (frontend `ScreenProveedoresCliente.tsx`):**
- Calcula `actorCatalogIds = new Set(actors.map(a => a.supplier_catalog_id))`
- Filtra `globalRows` con `.filter(c => actorCatalogIds.has(c.id))`
- Resultado: 22 entradas → 9 catálogos exactos vinculados a actores activos.

---

### P1 — BLOCK F: Filtro de proveedor roto en el marketplace

**Síntoma:** El filtro lateral "Mayorista" del marketplace mostraba nombres incorrectos (`OBRAMAT`, `STN`, `ElectroCantábrico`, `Saltoki`, `BigMat`, `Sonepar`, `Ariston`) que no coincidían con ningún nombre real de actor → seleccionar cualquier opción daba 0 resultados.

**Fix aplicado (`MarketplaceFilters.tsx` + `ScreenMarketplace.tsx`):**
- Eliminada la constante `MAYORISTAS_LIST` hardcodeada.
- `ScreenMarketplace` calcula `actorNombres: string[]` via `useMemo` derivando nombres únicos de `catalog.items[].actor_nombres`.
- `MarketplaceFilters` acepta `actorNombres` como prop y lo renderiza dinámicamente.
- Sección renombrada de "Mayorista" → "Proveedor".
- Si el catálogo aún está cargando, la sección no se muestra.

---

### P1 — Portal PortalTiendas (bonus)

**Síntoma:** `StockLocalTab` usaba nombres de columna incorrectos que causarían datos vacíos en producción.

**Bugs:**
- `nombre_interno` / `codigo_interno` / `precio_profesional` no existen en `trade_marketplace_supplier_offerings`
- `.eq('actor_id', actorId)` en offerings — columna `actor_id` no existe; el join es via `supplier_catalog_id`

**Fix aplicado (`PortalTiendas.tsx`):**
- Columnas corregidas: `descripcion_comercial`, `supplier_ref`, `precio_profesional_neto`
- Query de offerings: primero obtiene `supplier_catalog_id` del actor, luego filtra offerings por ese catalog

---

### P2 — BLOCK K: Contraste tarjetas de sugerencia IA

**Fix aplicado (`StepRevisar.tsx`):**
- Borde: `border-teal-100` → `border-teal-200` (más visible)
- Botón "Ignorar": `text-slate-400` → `text-slate-500` (supera ratio WCAG 4.5:1 en fondo teal-50)
- Dark mode: `bg-teal-950/30` → `bg-teal-950/40` (mayor contraste)

---

## Bloques NOT implementados (fuera de RC1-C.6)

| Bloque | Descripción | Motivo |
|--------|-------------|--------|
| BLOCK B | UI state badges Marketplace/IA/Preferido | La información ya es visible via el grid de actores y los toggles existentes |
| BLOCK C | Preferred location selector | Requiere nueva tabla `trade_marketplace_installer_supplier_preferences` — Sprint separado |
| BLOCK E | 3 estados material en quote UI | Feature nueva de quote editor — Post-piloto comercial |
| BLOCK H | Fix navegación "← Volver" | BLOCK G ya previene ghost carts; el flujo de vuelta funciona correctamente |
| BLOCK J | Atomicidad checkout | Ya garantizada por PL/pgSQL (transacción única); sin cambios necesarios |

---

## Migraciones SQL aplicadas

| Nombre | Descripción |
|--------|-------------|
| `rc1_c6_fix_create_cart_from_quote_direct_ref` | PATH 1.5 resolución directa por ref |
| `rc1_c6_fix_checkout_cart_v2_columns` | Fix columnas activo/activa/estado |
| `rc1_c6_fix_create_cart_resume_existing` | Ghost cart prevention |

---

## Archivos modificados

| Archivo | Bloque | Tipo |
|---------|--------|------|
| `src/components/ScreenProveedoresCliente.tsx` | A | Frontend |
| `src/components/portal/PortalTiendas.tsx` | Portal | Frontend |
| `src/components/marketplace/MarketplaceFilters.tsx` | F | Frontend |
| `src/components/marketplace/ScreenMarketplace.tsx` | F | Frontend |
| `src/components/marketplace/StepRevisar.tsx` | K | Frontend |

---

## Invariante mantenida

**PUBLICIDAD ≠ RANKING** — Ningún cambio de esta fase modifica el orden de resultados del marketplace. El ranking sigue siendo: `stock_ok → precio_min → plazo_min`. Las fixes de resolución de productos (PATH 1.5) afectan solo a la recuperación de offerings, no a su posición en ninguna lista pública.

---

## Tests recomendados (T1-T10)

| ID | Caso | Estado esperado |
|----|------|-----------------|
| T1 | Presupuesto con materiales obramat → "Comprar" | Carrito creado con offerings resueltas vía PATH 1.5 |
| T2 | Volver al presupuesto → "Comprar" de nuevo | Mismo carrito devuelto (no ghost cart) |
| T3 | Confirmar pedido | checkout_cart_v2 completa sin error de columna |
| T4 | Panel proveedores | Muestra exactamente 9 catálogos, sin duplicados |
| T5 | Filtro proveedor en marketplace | Opciones muestran nombres reales; selección filtra correctamente |
| T6 | Filtro proveedor con catálogo vacío | Sección no visible hasta que carga el catálogo |
| T7 | Tarjeta sugerencia IA | Borde y botón "Ignorar" visibles con buen contraste |
| T8 | Portal → Tiendas → Stock local | Tab carga offerings con columnas correctas |
| T9 | Portal → Stock local: guardar override | Upsert correcto en trade_marketplace_location_inventory |
| T10 | Checkout con actor inactivo | Error ACTOR_INACTIVE correctamente lanzado |
