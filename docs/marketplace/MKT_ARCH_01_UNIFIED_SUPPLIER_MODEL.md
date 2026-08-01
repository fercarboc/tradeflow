# MKT-ARCH-01 — Modelo Unificado de Proveedores, Catálogos y Marketplace

**Versión:** 1.0  
**Fecha:** 2026-08-01  
**Tipo:** Documento de arquitectura · Solo análisis · Sin código ni migraciones  
**Referencia:** Auditoría `MARKETPLACE_DATA_AUDIT_2026_07_31.md`

---

## 1. Arquitectura Actual — Estado Real

### 1.1 Dos sistemas que coexisten sin sincronización

```
╔══════════════════════════════════════════════════════════════════╗
║  SISTEMA LEGACY — Central de Compras                            ║
║  (módulo ERP del instalador)                                    ║
║                                                                  ║
║  trade_supplier_catalogs (16)                                   ║
║    ├── trade_supplier_products (891) ← OBRAMAT·Saltoki·Würth... ║
║    ├── trade_compras                                             ║
║    ├── trade_supplier_choices                                    ║
║    ├── trade_supplier_orders                                     ║
║    └── trade_org_suppliers                                       ║
║                                                                  ║
║  trade_global_catalog (921)                                      ║
║    ↓ Motor IA                                                    ║
║  trade_catalog_products (136, por org)                          ║
║    ↓                                                             ║
║  trade_catalog_variants (268, por org)                          ║
║    ↓                                                             ║
║  trade_quote_items (664 líneas de presupuesto)                  ║
╚══════════════════════════════════════════════════════════════════╝

              ↕  UN SOLO PUENTE — trade_marketplace_actors.supplier_catalog_id
              ↕  (solo OBRAMAT Demo lo usa hoy)

╔══════════════════════════════════════════════════════════════════╗
║  SISTEMA NUEVO — Marketplace                                    ║
║                                                                  ║
║  trade_marketplace_actors (2: OBRAMAT Demo + TrabFlow)          ║
║    ├── supplier_catalog_id ──────────────────────┐              ║
║    ├── trade_marketplace_actor_members           │              ║
║    ├── trade_marketplace_roles                   │              ║
║    ├── trade_catalog_imports                     │              ║
║    ├── trade_marketplace_orders                  │  FK          ║
║    ├── trade_supplier_api_credentials            │  al          ║
║    └── (15 tablas dependientes)                  │  legacy      ║
║                                                  ↓              ║
║  trade_marketplace_supplier_offerings (213)      │              ║
║    └── supplier_catalog_id ──────────────────────┘              ║
║    └── universal_product_id ──────────────┐                     ║
║                                           ↓                     ║
║  trade_marketplace_universal_products (6) │                     ║
║    └── global_catalog_id (NULL en los 6) ─┘                     ║
║    └── category_id (NULL en los 6)                              ║
║                                                                  ║
║  trade_marketplace_categories (25, todas vacías)                ║
╚══════════════════════════════════════════════════════════════════╝
```

### 1.2 Tabla de dependencias reales (FKs confirmadas en BD)

| Tabla | Apunta a | Registros |
|-------|---------|-----------|
| `trade_supplier_products` | `trade_supplier_catalogs` | 891 |
| `trade_compras` | `trade_supplier_catalogs` | — |
| `trade_org_suppliers` | `trade_supplier_catalogs` | — |
| `trade_supplier_choices` | `trade_supplier_catalogs` | — |
| `trade_supplier_orders` | `trade_supplier_catalogs` | — |
| `trade_budget_catalog_lines` | `trade_supplier_catalogs` | 0 (vacía) |
| **`trade_marketplace_actors`** | **`trade_supplier_catalogs`** | **2** |
| **`trade_marketplace_supplier_offerings`** | **`trade_supplier_catalogs`** | **213** |
| `trade_catalog_imports` | `trade_marketplace_actors` | 12 |
| `trade_marketplace_orders` | `trade_marketplace_actors` | 3 |
| `trade_marketplace_cart_items` | `trade_marketplace_actors` | 60 |
| `trade_supplier_api_credentials` | `trade_marketplace_actors` | — |
| *(+7 tablas marketplace)* | `trade_marketplace_actors` | — |

### 1.3 El puente ya existe — pero está infrautilizado

```sql
trade_marketplace_actors.supplier_catalog_id → trade_supplier_catalogs.id
```

- OBRAMAT Demo: `supplier_catalog_id = '280c05e5-...'` → OBRAMAT (supplier_key='obramat')
- TrabFlow: `supplier_catalog_id = NULL`

Este FK es el punto de unión entre ambos mundos. El modelo unificado se construye sobre él — no requiere rediseño estructural.

### 1.4 Mapa de actores actuales

| Nombre | Sistema | Tipo | Productos | Estado |
|--------|---------|------|-----------|--------|
| OBRAMAT | Legacy ERP | trade_supplier_catalogs | 178 ERP | Sin actor Marketplace |
| Saltoki | Legacy ERP | trade_supplier_catalogs | 170 ERP | Sin actor Marketplace |
| Würth | Legacy ERP | trade_supplier_catalogs | 85 ERP | Sin actor Marketplace |
| Sonepar | Legacy ERP | trade_supplier_catalogs | 76 ERP | Sin actor Marketplace |
| *(+9 más)* | Legacy ERP | trade_supplier_catalogs | 382 ERP | Sin actor Marketplace |
| **OBRAMAT Demo** | **Marketplace** | trade_marketplace_actors | 213 offerings | Actor completo ✅ |
| TrabFlow | Marketplace | trade_marketplace_actors | 0 | Plataforma |

---

## 2. Problemas que resuelve esta arquitectura

| # | Problema | Origen |
|---|---------|--------|
| P1 | 891 productos ERP sin representación en el Marketplace | Sin actor para los proveedores ERP |
| P2 | 921 productos del Motor IA sin UP vinculado | `global_catalog_id` vacío en todos los UPs |
| P3 | 197 offerings bloqueadas en `pending_review` desde 29/07 | Motor de matching inexistente |
| P4 | 25 categorías vacías | Ningún UP tiene `category_id` asignado |
| P5 | OBRAMAT aparece dos veces (legacy + Demo) | Sin política de identidad unificada |
| P6 | Central de Compras no sabe si un proveedor tiene actor Marketplace | Sin vista unificada |
| P7 | Admin no puede ver los dos catálogos en una sola pantalla | Sin modelo consolidado |

---

## 3. Principios de la Arquitectura Objetivo

1. **`trade_supplier_catalogs` es la identidad del proveedor** — conserva nombre, contacto, logo, acuerdo comercial. Es el registro maestro que existe tanto en el ERP como en el Marketplace.

2. **`trade_marketplace_actors` es la habilitación del proveedor en el Marketplace** — un proveedor no participa en pedidos hasta que tiene un actor. Actores son un subconjunto de catálogos.

3. **`trade_marketplace_supplier_offerings` es la fuente de verdad de productos ofertados** — no `trade_supplier_products`. Los ERP products son staging; las offerings son el canon.

4. **`trade_marketplace_universal_products` es la fuente de verdad del catálogo universal** — vinculada a `trade_global_catalog` vía `global_catalog_id`.

5. **`trade_supplier_products` (ERP) no desaparece** — se convierte en staging: los productos se cargan ahí y se promueven a offerings. Es el origen, no el destino.

6. **No existen dos catálogos paralelos** — un proveedor tiene un único `supplier_catalog_id`. Sus productos ERP y sus offerings comparten ese anchor.

---

## 4. Arquitectura Objetivo

### 4.1 Diagrama completo

```
ADMIN (supervisa y habilita)
  │
  ├── Crea/edita proveedor en trade_supplier_catalogs
  │     (nombre, logo, contacto, acuerdo_estado, prioridad)
  │
  └── Crea actor Marketplace vinculando supplier_catalog_id
        trade_marketplace_actors.supplier_catalog_id = trade_supplier_catalogs.id
        (habilita al proveedor para recibir pedidos)

                          │
                          ▼
              trade_marketplace_actors
              (identidad Marketplace del proveedor)
                          │
              ┌───────────┼────────────────────────────┐
              ▼           ▼                            ▼
  Portal Proveedor   Supplier API v1           Admin Billing
  (gestión self)     (sync ERP→offerings)      (reporting)
              │           │
              └─────┬─────┘
                    ▼
        trade_marketplace_supplier_offerings
        (fuente de verdad de productos ofertados)
                    │
                    │  matching (motor)
                    ▼
        trade_marketplace_universal_products
        (fuente de verdad del catálogo universal)
                    │
                    │  global_catalog_id (FK directa)
                    ▼
        trade_global_catalog
        (base maestra del Motor IA)
                    │
                    │  Motor IA
                    ▼
        trade_quote_items → trade_marketplace_cart_items
        (presupuesto → carrito → pedido)


STAGING (ERP / Central de Compras):
  trade_supplier_catalogs
    └── trade_supplier_products (staging)
          └── → promueve a → trade_marketplace_supplier_offerings
                              (cuando el proveedor tiene actor Marketplace)
```

### 4.2 Fuente de verdad por entidad

| Entidad | Fuente de verdad | Tabla auxiliar |
|---------|-----------------|----------------|
| Identidad del proveedor | `trade_supplier_catalogs` | — |
| Habilitación Marketplace | `trade_marketplace_actors` | — |
| Equipo del proveedor | `trade_marketplace_actor_members` | — |
| Productos ofertados | `trade_marketplace_supplier_offerings` | `trade_supplier_products` (staging) |
| Catálogo universal | `trade_marketplace_universal_products` | `trade_global_catalog` (origen) |
| Categorías | `trade_marketplace_categories` | — |
| Pedidos | `trade_marketplace_orders` | — |
| API credentials | `trade_supplier_api_credentials` | — |
| Presupuestos | `trade_quote_items` | `trade_catalog_products` (por org) |

### 4.3 Rol de Central de Compras en el modelo unificado

Central de Compras (legacy) **no desaparece**. Pasa a ser:

1. **El registro de identidad** de todos los proveedores (`trade_supplier_catalogs`)  
2. **El staging de productos ERP** (`trade_supplier_products`) — origen de datos que se promueven al Marketplace  
3. **El módulo de compras directas** del instalador que no usa el Marketplace (órdenes de compra manuales, pedidos directos a proveedor sin flujo de marketplace)

Lo que deja de ser:
- La fuente de verdad de productos ofertados (ese papel lo tiene `supplier_offerings`)
- El catálogo visible para el comprador en el Marketplace (ese papel lo tiene `universal_products`)

---

## 5. Conversión de los 3 proveedores de prueba

### Objetivo: convertir OBRAMAT, Saltoki, Sonepar en actores Marketplace completos

#### Situación actual de cada uno

| Proveedor | trade_supplier_catalogs | trade_supplier_products | trade_marketplace_actors | Offerings |
|-----------|------------------------|------------------------|-------------------------|-----------|
| OBRAMAT | ✅ `obramat` (178 ERP) | 178 productos | ✅ "OBRAMAT Demo" (supplier_catalog→obramat) | 213 |
| Saltoki | ✅ `saltoki` (170 ERP) | 170 productos | ❌ No existe | 0 |
| Sonepar | ✅ `sonepar` (76 ERP) | 76 productos | ❌ No existe | 0 |

#### OBRAMAT — Problema de identidad dual

Existe como `OBRAMAT` (ERP, 178 productos) y como `OBRAMAT Demo` (actor Marketplace, 213 offerings).

**Decisión:** No son el mismo catálogo. "OBRAMAT Demo" se renombrará a "OBRAMAT" y se reasignará su `supplier_catalog_id` a la entrada ERP de OBRAMAT (`obramat`). Las 213 offerings existentes se conservan. Los 178 productos ERP se migran como offerings adicionales (con deduplicación por `supplier_ref`).

**Resultado final:** 1 actor "OBRAMAT" con 1 `supplier_catalog_id` → `obramat`, y las offerings de ambas fuentes consolidadas.

#### Saltoki — Proveedor limpio, sin actor

**Decisión:** Crear actor Marketplace con `supplier_catalog_id → saltoki`. Promover sus 170 productos ERP a offerings con `match_state = 'pending_review'`.

#### Sonepar — Proveedor limpio, sin actor

**Decisión:** Crear actor Marketplace con `supplier_catalog_id → sonepar`. Promover sus 76 productos ERP a offerings con `match_state = 'pending_review'`.

#### Cómo evitar duplicados

La clave de deduplicación es `(supplier_catalog_id, supplier_ref)`. Ya existe `UNIQUE` implícito en el modelo (ON CONFLICT en `api_sync_catalog_offerings`). Al promover ERP products → offerings, la `ref_proveedor` de `trade_supplier_products` se mapea a `supplier_ref` de `trade_marketplace_supplier_offerings`.

---

## 6. Conexión Motor IA → Marketplace

### Flujo actual (roto)

```
trade_global_catalog (921)
       ↓ Motor IA
trade_quote_items (sin FK a UPs)
       ↓ (texto libre, sin FK)
trade_marketplace_cart_items (busca UPs por nombre)
       ↓ (solo funciona si hay UPs con ese nombre)
FALLA: no hay UPs para 915 de 921 productos del Motor IA
```

### Flujo objetivo (con puente)

```
trade_global_catalog (921)
       │ global_catalog_id (FK directa)
       ▼
trade_marketplace_universal_products (UP por cada gc)
       │ universal_product_id
       ▼
trade_marketplace_supplier_offerings (offering por cada UP)
       │ selected_offering_id
       ▼
trade_marketplace_cart_items → trade_marketplace_orders
```

### Lo que hace posible el puente

`trade_marketplace_universal_products.global_catalog_id` ya existe como columna FK. Está vacío en los 6 UPs actuales. Al crear UPs a partir de `trade_global_catalog`, se rellena ese campo y el Motor IA puede navegar hasta las offerings del proveedor.

### Cómo conecta el presupuesto con el carrito (hoy)

El código de `MarketplaceComprarView` toma las líneas del presupuesto y busca UPs por descripción textual (fuzzy search). Si no hay UPs, no hay resultados. El FK directo (`global_catalog_id`) permitiría una búsqueda determinista en lugar de fuzzy.

---

## 7. Impacto por módulo

### 7.1 Admin Panel

| Cambio | Impacto |
|--------|---------|
| Admin ve una tabla unificada de proveedores | Nueva vista que cruza `trade_supplier_catalogs` + `trade_marketplace_actors` |
| Admin puede habilitar/deshabilitar un proveedor en Marketplace | Toggle que crea/desactiva el actor Marketplace |
| Admin ve si un proveedor tiene catálogo ERP y si tiene actor Marketplace | Nueva columna `actor_id` (nullable) en la vista de proveedores |
| Admin puede lanzar la migración ERP → offerings para un proveedor | Nueva acción en AdminSuppliersSection |

**Sin cambios en la estructura de datos de Admin.** Solo cambios de presentación y una nueva acción.

### 7.2 Portal Proveedor

| Cambio | Impacto |
|--------|---------|
| El portal sigue usando `trade_marketplace_actors` como identity | Sin cambio |
| El portal puede mostrar los productos ERP importados pendientes de revisión | Nueva pestaña "Staging" o integración en Catálogo |
| CSV/API siguen cargando a `trade_marketplace_supplier_offerings` | Sin cambio |
| El proveedor puede ver cuántos de sus productos tienen UP vinculado | Nueva métrica en Dashboard |

**Sin cambios en la lógica del Portal Proveedor.** Solo nuevas métricas de matching visible.

### 7.3 Motor IA

| Cambio | Impacto |
|--------|---------|
| El Motor IA sigue usando `trade_global_catalog` para generar presupuestos | Sin cambio |
| Los quote_items mantienen su FK a `trade_catalog_products` | Sin cambio |
| Al crear UPs con `global_catalog_id`, el carrito encontrará UPs por FK directa | Mejora de precisión en la compra |
| Las sugerencias de compra serán deterministas en lugar de fuzzy | Menos fallos en el carrito |

**Sin cambios en el Motor IA.** La mejora es que el carrito encuentra más productos porque hay más UPs.

### 7.4 Marketplace — compra

| Cambio | Impacto |
|--------|---------|
| El instalador ve más proveedores cuando compra materiales | Saltoki y Sonepar aparecen como opciones |
| Los materiales de más oficios tendrán proveedor disponible | De 1 oficio (fontanería) a múltiples |
| La estrategia auto_select_providers tiene más opciones para comparar | Mejora de precios/velocidad/consolidación |

**Sin cambios en el código de compra.** Solo más datos que rellenan el mismo flujo.

---

## 8. Plan de Transición

### Orden exacto de implementación

> **Regla:** cada fase es independiente y reversible. No empezar la siguiente hasta que la anterior esté verificada.

---

#### FASE T1 — Crear UPs desde trade_global_catalog (datos, sin código nuevo)

**Qué:** Insertar en `trade_marketplace_universal_products` un registro por cada entrada de `trade_global_catalog`, rellenando `global_catalog_id`, `category_id`, `oficio`, `familia`, `nombre_canonico`, `unidad`, `validation_state = 'validated'`.

**Prioridad por oficio:**
1. Fontanería (101 gc → 101 UPs)
2. Electricidad (90 gc → 90 UPs)
3. Calefacción (42 gc → 42 UPs)

**Total fase T1:** 233 UPs nuevos, todos con `global_catalog_id` relleno.

**Cómo:** Script SQL con `INSERT INTO trade_marketplace_universal_products SELECT ... FROM trade_global_catalog WHERE oficio IN (...)`. Ejecutar via `apply_migration` en Supabase.

**Verificación:** `SELECT count(*) FROM trade_marketplace_universal_products WHERE global_catalog_id IS NOT NULL` debe devolver 233.

**Impacto:** El carrito encontrará UPs para los materiales más habituales de presupuesto.

---

#### FASE T2 — Asignar category_id a los UPs (datos, sin código nuevo)

**Qué:** Para cada UP creado en T1, asignar `category_id` según oficio y familia.

**Mapa de categorías existentes:**

| oficio gc | familia gc | category slug |
|-----------|-----------|---------------|
| Fontanería | Grifería | font-griferias |
| Fontanería | Saneamiento/Desagüe | font-desague |
| Fontanería | Sanitarios | font-sanitarios |
| Fontanería | Tuberías | font-tuberias |
| Fontanería | Calefacción | font-calefaccion |
| Fontanería | Herramientas | font-herramientas |
| Electricidad | Cables | elec-cables |
| Electricidad | Cuadros | elec-cuadros |
| Electricidad | Mecanismos | elec-mecanismos |
| Electricidad | Iluminación | elec-iluminacion |
| *(resto)* | *(mapeo por familia)* | *(categoría más cercana)* |

**Cómo:** Script SQL con UPDATE usando un CASE WHEN sobre oficio/familia.

**Verificación:** Todas las 25 categorías deben tener al menos 1 UP. `SELECT count(*) FROM trade_marketplace_universal_products WHERE category_id IS NULL` debe ser 0 para los UPs de T1.

---

#### FASE T3 — Resolver offerings pending_review (datos, sin código nuevo)

**Qué:** De las 197 offerings en `pending_review`, vincular las que correspondan a los 233 UPs de T1 asignando `universal_product_id` y cambiando `match_state` a `'matched'`.

**Método:** Matching por texto entre `offerings.descripcion_comercial` y `UP.nombre_canonico` usando similaridad (pg_trgm). Umbral mínimo 0.6. Las que no superen el umbral quedan en `pending_review` para revisión manual.

**Verificación:** `SELECT count(*) FROM trade_marketplace_supplier_offerings WHERE match_state = 'pending_review'` debe reducirse significativamente.

---

#### FASE T4 — Crear actores Marketplace para Saltoki y Sonepar (datos, sin código nuevo)

**Qué:** `INSERT INTO trade_marketplace_actors` para Saltoki y Sonepar con:
- `supplier_catalog_id` → su entrada en `trade_supplier_catalogs`
- `actor_type = 'supplier'`
- `estado = 'active'`
- `verificado = false` (pendiente de verificación admin)

**Impacto:** Aparecen en el Portal Proveedor como actores disponibles.

---

#### FASE T5 — Promover productos ERP a offerings para Saltoki y Sonepar (datos, sin código nuevo)

**Qué:** Para cada producto en `trade_supplier_products` de Saltoki (170) y Sonepar (76), insertar en `trade_marketplace_supplier_offerings` con:
- `supplier_catalog_id` = el de su catálogo ERP
- `supplier_product_id` = el id del ERP product
- `supplier_ref` = `ref_proveedor`
- `descripcion_comercial` = `descripcion`
- `precio_coste` = `precio_coste`
- `unidad` = `unidad`
- `activa = true`
- `match_state = 'pending_review'`

**Total:** 246 nuevas offerings.

**Verificación:** Después de T3+T5, el sistema tiene ~460 offerings de 3 proveedores con cobertura real.

---

#### FASE T6 — Resolver identidad dual de OBRAMAT (datos, cuidado con FKs)

**Qué:**
1. Renombrar "OBRAMAT Demo" → "OBRAMAT" en `trade_marketplace_actors.nombre`
2. Reasignar `supplier_catalog_id` al catalog ERP de OBRAMAT (`obramat`)
3. Promover los 178 ERP products de OBRAMAT a offerings (con deduplicación por `supplier_ref`)
4. El catalog "OBRAMAT Demo" en `trade_supplier_catalogs` queda como alias (no se elimina: hay FKs históricas)

**Verificación:** `SELECT count(*) FROM trade_marketplace_actors WHERE nombre = 'OBRAMAT Demo'` = 0.

---

#### FASE T7 — Admin: vista unificada de proveedores (código, Sprint 2)

**Qué:** `AdminSuppliersSection` muestra columna adicional "Actor Marketplace" con estado (habilitado/pendiente/sin actor) cruzando `trade_supplier_catalogs` con `trade_marketplace_actors` via `supplier_catalog_id`.

---

#### FASE T8 — Motor de matching automático (código, Sprint 2)

**Qué:** Edge Function o cron que procesa offerings en `pending_review`, busca UP candidato por pg_trgm + EAN, actualiza `match_state` y `match_confidence`.

---

### Cronograma simplificado

| Fase | Tipo | Sprint | Prerequisito |
|------|------|--------|-------------|
| T1 — UPs desde global_catalog | Datos | RC1-Beta | — |
| T2 — category_id en UPs | Datos | RC1-Beta | T1 |
| T3 — Resolver pending_review existentes | Datos | RC1-Beta | T1 |
| T4 — Actores Saltoki y Sonepar | Datos | RC1-Beta | — |
| T5 — Offerings desde ERP Saltoki+Sonepar | Datos | RC1-Beta | T4 |
| T6 — Fusión OBRAMAT | Datos | RC1-Beta | T1, T3 |
| T7 — Vista unificada Admin | Código | Sprint 2 | T4, T5 |
| T8 — Motor de matching | Código | Sprint 2 | T1, T2 |

---

## 9. Qué datos pueden migrarse sin inventar relaciones

La regla es: **solo migrar cuando el FK existe en la BD y la relación es verificable**.

| Migración | ¿FK existe? | ¿Relación verificable? | Segura |
|-----------|------------|----------------------|--------|
| `trade_global_catalog` → UPs via `global_catalog_id` | ✅ columna existe | ✅ 1:1 directo | ✅ Sí |
| `trade_supplier_products` → offerings via `supplier_product_id` | ✅ FK existe | ✅ 1:1 por `ref_proveedor` | ✅ Sí |
| UPs → categorías via `category_id` | ✅ FK existe | ⚠️ Mapa manual por oficio/familia | ⚠️ Con revisión |
| offerings → UPs via `universal_product_id` (pg_trgm) | ✅ FK existe | ⚠️ Matching aproximado | ⚠️ Umbral 0.6 |
| `trade_catalog_products` → UPs | ❌ Sin FK | ❌ Por org, no universal | ❌ No migrar aún |
| `trade_quote_items` → UPs | ❌ Sin FK | ❌ Solo por texto libre | ❌ No migrar aún |

---

## 10. Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| R1 | Matching automático (T3/T5) crea vínculos incorrectos | Media | Alto | Umbral pg_trgm ≥ 0.6 + revisión admin antes de activar en producción |
| R2 | Renombrar OBRAMAT Demo rompe RLS o referencias históricas | Baja | Alto | Actualizar solo `nombre` en el actor; no tocar IDs ni FKs históricas |
| R3 | Crear UPs desde gc genera duplicados si se ejecuta dos veces | Alta | Medio | ON CONFLICT en `global_catalog_id` para idempotencia |
| R4 | Central de Compras instalador deja de funcionar | Muy baja | Muy alto | `trade_supplier_catalogs` y `trade_supplier_products` no se modifican en T1-T6 |
| R5 | UPs de gc sin `category_id` correcto | Media | Medio | El mapa familia→categoría debe revisarse antes de T2 |
| R6 | Offerings de Saltoki/Sonepar sin precio_venta (NULL) | Alta | Bajo | `precio_venta` es nullable en offerings; el comprador solo ve `precio_coste` |
| R7 | trade_catalog_products (136, por org) entra en conflicto con UPs | Baja | Bajo | Son dos sistemas separados por diseño; el ERP sigue usando catalog_products |

---

## 11. Rollback

Cada fase es reversible independientemente:

| Fase | Rollback |
|------|---------|
| T1 — UPs desde gc | `DELETE FROM trade_marketplace_universal_products WHERE global_catalog_id IS NOT NULL AND origen = 'global_catalog'` |
| T2 — category_id | `UPDATE trade_marketplace_universal_products SET category_id = NULL WHERE origen = 'global_catalog'` |
| T3 — Resolve pending_review | `UPDATE trade_marketplace_supplier_offerings SET universal_product_id = NULL, match_state = 'pending_review' WHERE matched_by IS NULL AND matched_at > '2026-08-01'` |
| T4 — Actores Saltoki/Sonepar | `DELETE FROM trade_marketplace_actors WHERE nombre IN ('Saltoki','Sonepar') AND created_at > '2026-08-01'` |
| T5 — Offerings ERP | `DELETE FROM trade_marketplace_supplier_offerings WHERE supplier_product_id IS NOT NULL AND created_at > '2026-08-01'` |
| T6 — OBRAMAT rename | `UPDATE trade_marketplace_actors SET nombre = 'OBRAMAT Demo' WHERE nombre = 'OBRAMAT'` |

**El rollback de T1 no afecta a los 6 UPs manuales de PZ-001A** (su `origen` es diferente y `global_catalog_id` es NULL).

---

## 12. Decisiones de arquitectura explícitas

| Decisión | Alternativas descartadas | Razón |
|----------|------------------------|-------|
| **`trade_supplier_catalogs` se conserva como identidad** | Migrar todo a `trade_marketplace_actors` | 8 tablas con FK; el riesgo de migración supera el beneficio |
| **`trade_supplier_products` es staging, no fuente de verdad** | Usar ERP products directamente en el Marketplace | Las offerings tienen campos que ERP no tiene (match_state, image_url, plazo) |
| **El matching se hace a nivel de offerings → UPs** | Matching a nivel de ERP products → global_catalog | Las offerings son el nivel correcto: un proveedor puede ofrecer el mismo UP con precio diferente |
| **`trade_catalog_products` (por org) no se migra a UPs** | Convertirlos en UPs | Son per-org, tienen lógica de margen específica; mezclarlos con UPs universales sería incorrecto |
| **`global_catalog_id` como puente Motor IA → UPs** | Buscar UPs por texto libre siempre | El FK directo es determinista; el fuzzy es frágil para materiales con nombres similares |
| **No se crea nueva tabla de proveedores** | Nueva tabla `trade_providers` unificada | El puente `supplier_catalog_id` ya resuelve la unificación sin migraciones disruptivas |

---

## Resumen ejecutivo

**El problema no requiere rediseñar la arquitectura.** El puente ya está en la BD:

```
trade_marketplace_actors.supplier_catalog_id → trade_supplier_catalogs.id
```

Lo que falta es explotar ese puente de forma sistemática:

1. **Datos T1-T3:** Crear 233 UPs desde `trade_global_catalog` y resolver los 197 offerings bloqueados. El Marketplace pasa de 6 a 239 productos con proveedor disponible. Esto es trabajo de datos, no de código.

2. **Datos T4-T6:** Crear actores para Saltoki y Sonepar y promover sus 246 productos ERP a offerings. El Marketplace pasa a tener 3 proveedores reales con ~485 offerings.

3. **Código Sprint 2:** Vista unificada en Admin + motor de matching automático. Esto cierra el ciclo de forma indefinida: cualquier nuevo proveedor que cargue CSV tendrá sus offerings resueltas automáticamente.

**Al final de T1-T6 (datos puros, sin código):**
- UPs: de 6 → 239
- Proveedores Marketplace: de 1 → 3
- Offerings con matching: de 16 → estimado ~300 (de 485)
- Categorías vacías: de 25 → ~0

---

*Documento creado 2026-08-01 · Solo análisis · Sin modificaciones de datos ni código*  
*Siguiente acción: aprobar plan → ejecutar T1 como migración SQL*
