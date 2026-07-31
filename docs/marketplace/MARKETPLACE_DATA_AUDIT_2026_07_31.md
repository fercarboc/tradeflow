# TrabFlow Marketplace — Auditoría de Datos

**Tipo:** Auditoría de solo lectura · SELECT puros, sin modificaciones  
**Fecha:** 2026-07-31  
**Método:** Consultas directas a la BD de producción (proyecto `dqqjaujnulutinskmqsu`)  
**Objetivo:** Determinar si el bloqueante del Marketplace es la ausencia de productos o la ausencia de relaciones entre ellos

---

## Mapa de tablas analizadas

```
trade_global_catalog              ← BASE MAESTRA del Motor IA (921 productos)
trade_marketplace_universal_products  ← Productos Universales del Marketplace (6 productos)
trade_marketplace_supplier_offerings  ← Ofertas de proveedores (213 ofertas)
trade_marketplace_categories      ← Árbol de categorías (25 categorías)
trade_supplier_catalogs           ← Catálogos ERP / Central de Compras (16 catálogos)
trade_supplier_products           ← Productos cargados en catálogos ERP (891 productos)
trade_marketplace_actors          ← Actores del Marketplace (2 actores)
trade_catalog_imports             ← Historial de imports del proveedor (12 imports)
trade_marketplace_carts/orders    ← Actividad transaccional (10 carritos, 3 pedidos)
trade_ai_usage / ai_versions      ← Telemetría del Motor IA
```

---

## A. Base Maestra — `trade_global_catalog`

### Estructura de columnas relevantes

```
id, oficio, familia, codigo, descripcion, unidad, precio_referencia,
marca_sugerida, activo, search_vector, created_at, updated_at
```

No tiene FK hacia el Marketplace. No tiene `universal_product_id`. Es un catálogo de referencia plano.

### Conteo real

| Métrica | Valor |
|---------|-------|
| Total registros | **921** |
| Activos | 921 (100%) |
| Inactivos | 0 |
| Oficios distintos | 22 |
| Familias distintas | 130 |
| Vinculados a un UP | **0** |

### Distribución por oficio (top 10)

| Oficio | Registros |
|--------|-----------|
| Fontanería | 101 |
| Electricidad | 90 |
| Energía Solar | 62 |
| Climatización / HVAC | 47 |
| Carpintería / Ventanas | 46 |
| Pintura | 42 |
| Calefacción | 42 |
| Albañilería | 42 |
| Cerrajería | 40 |
| Vehículo Eléctrico | 38 |
| *(+12 oficios más)* | 371 |

### Relación con el Motor IA

El Motor IA usa esta tabla como **catálogo de referencia para generar presupuestos**:

- 193 llamadas registradas en `trade_ai_usage`
- 10 versiones del motor en producción (`trade_ai_versions`)
- 28 feedbacks de usuario registrados
- 664 líneas de presupuesto en `trade_quote_items`
- `trade_quote_items` apunta a `catalog_product_id` → `trade_catalog_products` (no a UPs)

**El Motor IA opera completamente separado del Marketplace.** No hay ningún FK entre presupuestos y productos universales. La conexión es implícita por texto cuando el instalador pulsa "Comprar en Marketplace".

---

## B. Productos Universales — `trade_marketplace_universal_products`

### Estructura de columnas

```
id, nombre_canonico, descripcion, category_id, oficio, familia, subfamilia,
unidad, marca, modelo, ean, gtin, mpn, manufacturer_ref, manufacturer_id,
especificaciones (jsonb), es_generico, validation_state, merged_into_id,
origen, normalization_version, global_catalog_id, search_vector,
created_at, updated_at, image_url
```

Tiene `global_catalog_id` (FK hacia `trade_global_catalog`) y `category_id` (FK hacia categorías).  
Ambas columnas están **vacías en los 6 registros existentes**.

### Conteo real

| Métrica | Valor |
|---------|-------|
| Total UPs | **6** |
| validation_state = 'validated' | 6 (100%) |
| validation_state = 'pending' | 0 |
| validation_state = 'archived' | 0 |
| Oficio único | fontaneria (100%) |
| Con image_url | 6 (100%) |
| Con EAN | 6 (EANs ficticios: PZ-FON-001…006) |
| Con marca (texto) | 0 |
| Con category_id | **0** |
| Con global_catalog_id | **0** |
| Genericos | 6 (100%) |

### Los 6 productos existentes

| nombre_canonico | ean | Offerings vinculados |
|----------------|-----|---------------------|
| Grifo monomando lavabo | PZ-FON-001 | 2 |
| Tubo y sifón desagüe PVC | PZ-FON-002 | **0** |
| Plato de ducha | PZ-FON-003 | 5 |
| Grifo monomando ducha | PZ-FON-004 | 4 |
| Sifón y desagüe ducha | PZ-FON-005 | 2 |
| Mampara de ducha | PZ-FON-006 | 4 |

Estos 6 productos fueron creados **manualmente para el piloto PZ-001A** (29/07/2026). Son datos de prueba con EANs ficticios y sin vinculación al catálogo real.

---

## C. Ofertas de Proveedores — `trade_marketplace_supplier_offerings`

### Conteo real

| Métrica | Valor |
|---------|-------|
| Total offerings | **213** |
| Activas (activa=true) | 213 (100%) |
| Inactivas | 0 |
| Sin imagen | **173 (81%)** |
| Con universal_product_id | **17 (8%)** |
| Sin universal_product_id | **196 (92%)** — huérfanas |
| Distinct supplier_catalog | **1** — solo OBRAMAT Demo |
| Con match_state = 'matched' | 16 |
| Con match_state = 'pending_review' | 197 |

### Por proveedor (actor del Marketplace)

| Proveedor | Offerings | Matched | Pending Review |
|-----------|-----------|---------|----------------|
| OBRAMAT Demo | 213 | 16 | 197 |
| TrabFlow (plataforma) | 0 | — | — |
| Todos los demás | **0** | — | — |

**Solo existe un proveedor activo en el Marketplace.** Los demás (Saltoki, Würth, Sonepar, etc.) no son actores del Marketplace.

---

## D. Matching — Estado Real

> **Nota importante:** El estado documentado anteriormente era incorrecto.  
> El código documentaba: `pending / matched / unmatched / manual / rejected`  
> La BD usa realmente: `matched / pending_review`  
> `pending_review` ≠ `pending` — incompatibilidad entre documentación y BD.

| match_state | Registros | % del total |
|-------------|-----------|-------------|
| `matched` | 16 | 7.5% |
| `pending_review` | 197 | 92.5% |
| `unmatched` | 0 | 0% |
| `manual` | 0 | 0% |
| `rejected` | 0 | 0% |
| **Total** | **213** | 100% |

| Estadística de confidence | Valor |
|--------------------------|-------|
| Media | 0.9000 |
| Máxima | 0.900 |
| Mínima | 0.900 |

**La confidence de 0.90 es idéntica en todos los 16 registros matched** — fue asignada manualmente durante PZ-001A, no calculada por el motor. No hay varianza real de matching.

---

## E. Motor IA — Relación con el Marketplace

```
FLUJO ACTUAL (lo que existe hoy)
═══════════════════════════════

trade_global_catalog (921)
        │
        ▼ Motor IA lee precios de referencia
trade_quote_items (664)  ──── catalog_product_id ──▶  trade_catalog_products
        │
        │  (conexión implícita por texto — NO hay FK)
        ▼
trade_marketplace_cart_items  ──▶  trade_marketplace_universal_products (6)
                                              │
                                              ▼
                              trade_marketplace_supplier_offerings (213)
                                              │
                                              ▼  (solo 16 de 213)
                                      Proveedor: OBRAMAT Demo

─────────────────────────────────────────────────────────

FLUJO IDEAL (lo que debería existir)
════════════════════════════════════

trade_global_catalog (921)
        │ global_catalog_id (FK directa)
        ▼
trade_marketplace_universal_products (debería tener 921+)
        │ universal_product_id
        ▼
trade_marketplace_supplier_offerings (con match_state='matched')
        │
        ▼
Múltiples actores del Marketplace (OBRAMAT, Saltoki, Würth...)
```

**Brecha actual:** El flujo ideal requiere dos puentes que hoy no existen:
1. `global_catalog_id` en cada UP (los 6 actuales tienen NULL)
2. Actores del marketplace para los proveedores ERP existentes

---

## F. Desconexiones Detectadas

### F.1 — Base maestra → Productos Universales: DESCONEXIÓN TOTAL

- **921** productos en `trade_global_catalog`
- **0** de esos 921 tienen un UP en el marketplace
- El campo `global_catalog_id` en `trade_marketplace_universal_products` existe pero está vacío en los 6 registros
- Los 6 UPs actuales son artículos de fontanería de baño creados manualmente, sin relación con el catálogo

### F.2 — Productos Universales → Categorías: DESCONEXIÓN TOTAL

- **25 categorías** creadas (8 raíz + 17 subcategorías, 7 oficios)
- **0 UPs** tienen `category_id` asignado
- Todas las categorías tienen `ups_vinculados = 0`
- El árbol de categorías existe pero está completamente vacío y no sirve para ninguna búsqueda

```
CATEGORÍAS VACÍAS (muestra):
─────────────────────────────
Fontanería / Calefacción:           0 UPs
Fontanería / Desagüe y Saneamiento: 0 UPs   ← "Tubo y sifón" debería estar aquí
Fontanería / Griferías:             0 UPs   ← "Grifo monomando" debería estar aquí
Fontanería / Sanitarios:            0 UPs   ← "Plato de ducha" debería estar aquí
Electricidad:                       0 UPs
Albañilería:                        0 UPs
... (25/25 categorías con 0 UPs)
```

### F.3 — Offerings → UPs: 92% HUÉRFANAS

- 196 de 213 offerings están en `pending_review` sin UP asignado
- Aguardan un motor de matching que asigne un UP — ese motor no existe en producción
- Las 9 cargas en estado `matching_pendiente` (132 filas procesadas correctamente) llevan bloqueadas desde el 29/07/2026 sin resolver

### F.4 — Catálogos ERP → Actores Marketplace: DESCONEXIÓN TOTAL

`trade_supplier_catalogs` (Central de Compras ERP) tiene 16 catálogos con productos reales:

| Proveedor ERP | Productos en BD | Actor Marketplace |
|--------------|----------------|-------------------|
| OBRAMAT | 178 | ❌ No (≠ "OBRAMAT Demo") |
| Saltoki | 170 | ❌ No |
| Würth | 85 | ❌ No |
| Sonepar | 76 | ❌ No |
| Novelec | 71 | ❌ No |
| Bricomart Pro | 65 | ❌ No |
| Rexel | 60 | ❌ No |
| Saunier Duval | 48 | ❌ No |
| Daikin | 46 | ❌ No |
| Baxi | 24 | ❌ No |
| Junkers / Bosch | 23 | ❌ No |
| Ariston | 23 | ❌ No |
| Vaillant | 22 | ❌ No |
| OBRAMAT Demo | 0 (en ERP) | ✅ Sí (213 offerings) |
| **Total** | **891** | **0 de 891 accesibles en Marketplace** |

Los 891 productos del ERP están en `trade_supplier_products` (Central de Compras), **no en `trade_marketplace_supplier_offerings`**. No son la misma tabla ni el mismo sistema.

### F.5 — Imports estancados en `matching_pendiente`

```
Estado actual de los 12 imports de OBRAMAT Demo:
──────────────────────────────────────────────────
cancelado          → 1 import,  6 filas (PZ-001A fallido)
matching_pendiente → 9 imports, 132 filas correctamente cargadas ← BLOQUEADAS
pendiente_fin      → 2 imports,  8 filas (5 ok, 3 error)
```

**132 filas de producto están bien cargadas en la BD pero el estado del import nunca avanzó de `matching_pendiente` a `completado`** porque no hay motor de matching que resuelva el pending_review → matched.

### F.6 — `trade_budget_catalog_lines`: TABLA VACÍA

- 0 registros
- Es una tabla nueva que debería vincular presupuesto ↔ catálogo
- No está integrada en ningún flujo todavía

### F.7 — EANs ficticios en los 6 UPs

Los 6 UPs tienen EAN = `PZ-FON-001` a `PZ-FON-006` — identificadores de prueba del piloto PZ-001A, no EANs de producto real (13 dígitos GS1). Un matcher por EAN no encontraría ningún producto real con estas claves.

### F.8 — 1 UP sin ninguna oferta vinculada

`Tubo y sifón desagüe PVC` (PZ-FON-002) tiene `offerings_vinculados = 0`. Si el instalador añade este producto al carrito, el marketplace no puede sugerir ningún proveedor.

### F.9 — match_state 'pending_review' no documentado

La documentación de la API y el código describían: `pending / matched / unmatched / manual / rejected`. La BD usa `pending_review` como segundo estado. Cualquier lógica que filtre por `match_state = 'pending'` no devolverá los 197 registros reales.

---

## Resumen consolidado de desconexiones

| # | Desconexión | Afecta | Gravedad |
|---|------------|--------|----------|
| F.1 | global_catalog → UPs: 0/921 vinculados | Motor IA no alimenta el Marketplace | 🔴 Crítica |
| F.2 | UPs → Categorías: 25 vacías, 0 UPs con category_id | Navegación por categoría imposible | 🔴 Crítica |
| F.3 | 196/213 offerings sin UP (pending_review eterno) | Proveedor sin matching visible | 🔴 Crítica |
| F.4 | 891 productos ERP sin actor Marketplace | Saltoki, Würth, etc. inexistentes para el comprador | 🔴 Crítica |
| F.5 | 9 imports en matching_pendiente desde 29/07 | 132 filas cargadas y bloqueadas | 🟡 Alta |
| F.6 | trade_budget_catalog_lines vacío | Tabla nueva sin integrar | 🟡 Media |
| F.7 | EANs ficticios (PZ-FON-xxx) | Matching por EAN imposible | 🟡 Media |
| F.8 | 1 UP sin ofertas | Comprador no puede comprar ese producto | 🟡 Media |
| F.9 | match_state 'pending_review' ≠ código | Bug potencial en filtros de código | 🟡 Media |

---

---

## ESTADO REAL DEL MARKETPLACE

```
────────────────────────────────────────────────────────

BASE MAESTRA

Registros:  921 productos en trade_global_catalog
Tabla:      trade_global_catalog (oficio, familia, codigo, descripcion, precio_referencia)
Cobertura:  22 oficios, 130 familias — bien poblada
            Alimenta el Motor IA de presupuestos
            DESCONECTADA del Marketplace (0/921 vinculados a un UP)

────────────────────────────────────────────────────────

PRODUCTOS UNIVERSALES

Registros:  6 (no 50, no 100 — solo 6)
Validados:  6 (100% — todos son PZ-001A fontanería baño)
Pendientes: 0
Cobertura:  1 oficio de 22 (fontaneria)
            0/6 con category_id → árbol de categorías completamente desconectado
            0/6 con global_catalog_id → base maestra completamente desconectada
            EANs ficticios (PZ-FON-001…006), no EANs reales

────────────────────────────────────────────────────────

OFERTAS DE PROVEEDORES

Registros:  213 (todos de OBRAMAT Demo)
Proveedores: 1 actor activo en el Marketplace
             13 proveedores ERP (891 productos) SIN representación como actor
Cobertura:  7.5% matched (16/213)
            92.5% pending_review (197/213) — bloqueadas sin motor de matching
            81% sin imagen (173/213)

────────────────────────────────────────────────────────

MATCHING

Matched:        16 registros (confidence fija: 0.90 — asignada manualmente)
Pending:        197 registros (estado real: 'pending_review', no 'pending')
Rejected:       0
Confianza media: 0.90 (sin varianza — no es matching real del motor IA)

────────────────────────────────────────────────────────

CONCLUSIÓN

El cuello de botella es la AUSENCIA DE RELACIONES, no la ausencia de productos.

Hay datos suficientes:
  · 921 productos en la base maestra (Motor IA)
  · 891 productos en catálogos ERP de 13 proveedores
  · 213 offerings de OBRAMAT Demo ya cargadas

El problema es que esos tres universos de datos no se hablan entre sí:

  1. La base maestra (921 productos) no tiene ningún UP en el Marketplace.
     El campo global_catalog_id existe pero está vacío.
     Cada producto del Motor IA que aparece en un presupuesto
     no tiene ningún UP al que vincularse en el momento de la compra.

  2. Los 891 productos ERP (Saltoki, Würth, Sonepar, etc.) no son actores
     del Marketplace. Están en trade_supplier_products (Central de Compras ERP)
     y no tienen representación en trade_marketplace_supplier_offerings.

  3. Los 197 offerings en pending_review llevan bloqueados desde el 29/07/2026
     esperando un motor de matching que aún no existe en producción.

  4. El árbol de categorías (25 categorías) está vacío — 0 UPs vinculados.

La acción no es cargar más productos.
La acción es crear las relaciones entre los datos que ya existen.

────────────────────────────────────────────────────────

SIGUIENTE PASO ÚNICO

Crear Productos Universales a partir de la base maestra existente.

Acción concreta:
  Para cada oficio prioritario (fontanería + electricidad = 191 registros
  en global_catalog), crear un UP en trade_marketplace_universal_products con:
    · global_catalog_id = gc.id          (vincula Motor IA ↔ Marketplace)
    · category_id = categoría correcta   (vincula árbol ↔ UP)
    · nombre_canonico = gc.descripcion
    · oficio/familia desde gc
    · validation_state = 'validated'
  Después, vincular los 197 offerings en pending_review a sus UPs correspondientes
  (match_state → 'matched', universal_product_id → UP.id).

  Esto no requiere código nuevo. Requiere una migración de datos
  que puede ejecutarse como script SQL de solo INSERT/UPDATE,
  usando los datos que ya están en la BD.

  Resultado esperado:
    · 191 UPs nuevos (fontanería + electricidad)        ← de 6 a 197
    · 197 offerings resueltos (pending_review → matched) ← de 7.5% a ~100%
    · El Motor IA empezará a conectar presupuestos al Marketplace
    · La demo de 15 minutos funcionará con materiales reales

────────────────────────────────────────────────────────
```

---

*Auditoría generada 2026-07-31 · Solo lectura · Sin modificaciones de datos*  
*Todas las cifras son conteos directos de producción — sin estimaciones*
