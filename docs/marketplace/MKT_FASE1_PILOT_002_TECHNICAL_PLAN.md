# MKT-FASE1-PILOT-002 — Plan Técnico de Corrección del Puente Estructurado

**Versión:** 2.0 (aprobado con correcciones 2026-08-01)  
**Fecha:** 2026-08-01  
**Estado:** APROBADO — pendiente ejecución paso a paso  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)

> Análisis base: `MKT_FASE1_PILOT_002_ANALYSIS.md`  
> NO ejecutar bloques sin validaciones intermedias. Cada paso requiere confirmación.

---

## 1. Orden de ejecución (obligatorio)

```
1.  C-001  DDL — trade_quote_items: añadir 3 columnas
2.  Regenerar tipos Supabase (supabase gen types typescript)
3.  C-002  Motor IA — persistir IDs estructurados (batch, sin N+1)
4.  Tests unitarios del enriquecimiento estructurado
5.  C-003  SQL — Level 0 en create_cart_from_quote (migración)
6.  C-004  Dry run de los 16 UPs
7.  C-004  Promoción draft → validated
8.  Deploy Edge Function + aplicación
9.  C-005  Crear 5 offerings OBRAMAT Demo (Portal/API)
10. Revisar y aprobar vínculos offering → UP
11. Tests 1–11
12. Documentar resultados
```

No ejecutar pasos 3-5 sin paso 1 aplicado. No ejecutar paso 9 sin paso 7 aplicado.

---

## 2. C-001 — DDL: columnas en trade_quote_items

### Estado actual de la tabla (columnas relevantes)

| Columna | Tipo | Estado |
|---|---|---|
| `supplier_key` | text | ✅ Existe |
| `supplier_name` | text | ✅ Existe |
| `supplier_ref` | text | ✅ Existe |
| `catalog_variant_id` | uuid | ✅ Existe (FK lógica a trade_supplier_products) |
| `material_order_placed` | boolean | ✅ Existe |
| `familia` | text | ✅ Existe |
| `global_catalog_id` | uuid | ❌ A añadir |
| `universal_product_id` | uuid | ❌ A añadir |
| `universal_variant_id` | uuid | ❌ A añadir |

### DDL

```sql
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS global_catalog_id   uuid
    REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS universal_product_id uuid
    REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS universal_variant_id uuid
    REFERENCES public.trade_marketplace_universal_product_variants(id) ON DELETE SET NULL;
```

**Script completo:** `docs/marketplace/sql/MKT_FASE1_PILOT_002_QUOTE_ITEMS_DDL.sql`  
(5 pre-validaciones, 3 ADD COLUMN, 3 índices parciales, 4 post-validaciones, rollback comentado)

### Coherencia de IDs (validación en código, no en CHECK)

Regla: cuando `universal_variant_id IS NOT NULL`, el `universal_product_id` debe ser el UP padre de esa variante. PostgreSQL no puede validar esta regla con un CHECK simple sin función. Se valida en:
1. **C-002** (Motor IA): el lookup resuelve coherentemente UP y variante del mismo gc.
2. **C-003** (create_cart): Level 0-A detecta incoherencia → `structured_id_invalid`.

### Rollback

`DROP COLUMN IF EXISTS` en las tres columnas + DROP INDEX. Seguro solo mientras todas sean NULL.

---

## 3. C-002 — Motor IA: resolución por lotes

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `supabase/functions/trade-voice-to-quote/index.ts` | Select gc incluye `id`; función auxiliar `resolveMarketplaceIds`; batch lookup en `enrichWithCatalogPrices` |
| `src/lib/supabase.ts` | Interface `TradeQuoteItem` (línea 79) + `saveQuote` Pick type (línea 590) |

### Diseño batch (2 queries máximo por llamada, sin N+1)

```typescript
// Función auxiliar — fuera de enrichWithCatalogPrices
async function resolveMarketplaceIds(
  supabase: ReturnType<typeof createClient>,
  gcIds: string[],
): Promise<Map<string, {
  universal_product_id: string;
  universal_variant_id: string | null;
  method: 'structured_direct_product' | 'structured_variant';
}>> {
  const result = new Map();
  if (gcIds.length === 0) return result;

  // Query 1: UPs con global_catalog_id directo
  const { data: directUPs } = await supabase
    .from('trade_marketplace_universal_products')
    .select('id, global_catalog_id')
    .in('global_catalog_id', gcIds);

  const resolvedIds = new Set<string>();
  for (const up of directUPs ?? []) {
    if (up.global_catalog_id) {
      result.set(up.global_catalog_id, {
        universal_product_id: up.id,
        universal_variant_id: null,
        method: 'structured_direct_product',
      });
      resolvedIds.add(up.global_catalog_id);
    }
  }

  // Query 2: variantes activas para gc_ids restantes
  const remaining = gcIds.filter(id => !resolvedIds.has(id));
  if (remaining.length > 0) {
    const { data: variants } = await supabase
      .from('trade_marketplace_universal_product_variants')
      .select('id, global_catalog_id, universal_product_id')
      .in('global_catalog_id', remaining)
      .eq('activa', true);

    for (const v of variants ?? []) {
      if (v.global_catalog_id && !result.has(v.global_catalog_id)) {
        result.set(v.global_catalog_id, {
          universal_product_id: v.universal_product_id,
          universal_variant_id: v.id,
          method: 'structured_variant',
        });
      }
    }
  }

  return result;
}
```

### Cambios en enrichWithCatalogPrices

**1. Select gc añade `id`:**
```typescript
supabase.from('trade_global_catalog')
  .select('id, descripcion, precio_referencia, unidad, codigo, oficio')  // añadir id
```

**2. Al encontrar globalMatch, guardar gc.id en la partida:**
```typescript
if (match && match.precio > 0) {
  partida.precio_unitario = match.precio;
  partida.total = (partida.cantidad ?? 1) * match.precio;
  partida.precio_origen = match.fuente;
  partida.catalog_codigo = match.codigo;
  if (globalMatch?.id) {
    partida.global_catalog_id = String(globalMatch.id);  // NUEVO
  }
  recalculated = true;
}
```

**3. Después del loop de partidas, resolución batch:**
```typescript
// Recoger gc_ids únicos de partidas con match de global_catalog
const gcIds = [...new Set(
  (partidas as Partida[])
    .filter(p => p.global_catalog_id)
    .map(p => p.global_catalog_id as string)
)];

if (gcIds.length > 0) {
  const gcMap = await resolveMarketplaceIds(supabase, gcIds);

  for (const partida of partidas as Partida[]) {
    if (!partida.global_catalog_id) {
      // Match de tarifa_instalador o sin match — sin IDs Marketplace
      if (partida.catalog_codigo) {
        console.log(`[structured][catalog_text_match_only] codigo=${partida.catalog_codigo}`);
      }
      continue;
    }

    const resolved = gcMap.get(partida.global_catalog_id);
    if (resolved) {
      partida.universal_product_id = resolved.universal_product_id;
      partida.universal_variant_id = resolved.universal_variant_id ?? undefined;
      console.log(
        `[structured][${resolved.method}] gc=${partida.global_catalog_id.slice(0,8)} up=${resolved.universal_product_id.slice(0,8)}`
      );
    } else {
      console.log(
        `[structured][global_catalog_without_marketplace_mapping] gc=${partida.global_catalog_id.slice(0,8)}`
      );
    }
  }
}
```

### Cambios en src/lib/supabase.ts

**Interface TradeQuoteItem (línea 79):**
```typescript
export interface TradeQuoteItem {
  // ... campos existentes ...
  global_catalog_id?: string | null;       // NUEVO
  universal_product_id?: string | null;    // NUEVO
  universal_variant_id?: string | null;    // NUEVO
  created_at: string;
}
```

**saveQuote Pick type (línea 590):**
```typescript
items: Pick<TradeQuoteItem,
  'descripcion' | 'tipo' | 'cantidad' | 'precio_unitario' | 'precio_material' |
  'supplier_key' | 'supplier_name' | 'supplier_ref' | 'catalog_variant_id' | 'familia' |
  'global_catalog_id' | 'universal_product_id' | 'universal_variant_id'  // NUEVOS
>[]
```

El INSERT en línea 611 usa spread `{ ...item }` — los 3 nuevos campos se propagan automáticamente.

### Logs estructurados (sin PII)

| Método | Cuándo |
|---|---|
| `structured_direct_product` | gc → UP directo (UP.global_catalog_id = gc.id) |
| `structured_variant` | gc → variante → UP (variant.global_catalog_id = gc.id) |
| `global_catalog_without_marketplace_mapping` | gc existe pero sin UP ni variante en Marketplace |
| `catalog_text_match_only` | match por tarifa_instalador (no gc) → sin IDs Marketplace |

---

## 4. C-003 — Level 0 en create_cart_from_quote

**Script completo:** `supabase/migrations/20260801_03_marketplace_structured_cart.sql`

### Niveles de matching (con prioridades)

| Level | ID usado | Condición adicional | Método registrado | Confianza |
|---|---|---|---|---|
| 0-A | `universal_variant_id` | var.activa=true + UP.validation_state='validated' + coherencia UP_padre | `structured_variant` | 1.0 |
| 0-B | `universal_product_id` | UP.validation_state='validated' | `structured_product` | 1.0 |
| 0-C-1 | `global_catalog_id` → UP directo | UP.validation_state='validated' | `structured_global_catalog` | 1.0 |
| 0-C-2 | `global_catalog_id` → variante | var.activa=true + UP.validation_state='validated' | `structured_global_catalog_variant` | 1.0 |
| 1 | `catalog_variant_id` → offering | match_state='matched' | (del offering) | (del offering) |
| 2 | `supplier_ref` → offering | match_state='matched' | (del offering) | (del offering) |
| 3 | ILIKE 20 chars | UP.validation_state='validated' | `fuzzy_fallback` | 0.6 |

### Métodos especiales (v_up_id = NULL)

| Método | Causa |
|---|---|
| `product_not_validated` | ID estructurado correcto pero UP en draft |
| `structured_id_invalid` | universal_variant_id y universal_product_id incoherentes (UPs distintos) |
| `no_match` | Ningún nivel resolvió |

### Regla crítica (corrección vs. borrador)

**Level 0 SIEMPRE filtra `validation_state = 'validated'`.** Un UP en draft no es comprable aunque el Motor IA lo haya identificado. La compra solo es posible cuando el UP esté validado (C-004 lo habilita).

Si el UP está draft: `product_not_validated`, flujo continúa por Levels 1-3 (fuzzy fallback aún puede encontrar otro UP validated).

### Rollback de C-003

```sql
-- Restaurar la función anterior (antes de aplicar C-003)
-- Requiere backup del texto de la función o restaurar desde git:
-- git show HEAD~1:supabase/migrations/20260724_04_marketplace_checkout_flow.sql | grep -A 130 "create_cart_from_quote"
-- Aplicar como CREATE OR REPLACE con el cuerpo anterior
```

---

## 5. C-004 — Promoción draft → validated

**Script completo:** `docs/marketplace/sql/MKT_FASE1_PILOT_002_VALIDATE_BATCH_UPS.sql` (v2)

### Pre-validaciones (11 secciones §DR)

| §DR | Comprobación | Resultado esperado |
|---|---|---|
| §DR-1 | Candidatos con 4 condiciones | n=16 |
| §DR-2 | Lista individual + categoría | OK en todos |
| §DR-3 | 0 UPs del lote ya en validated | n=0 |
| §DR-4 | 6 UPs preexistentes validated intactos | n=6 |
| §DR-5 | 0 UPs sin category_id | n=0 |
| §DR-6 | 0 variantes sin global_catalog_id | n=0 |
| §DR-7 | **15 variantes activas** | n=15 |
| §DR-8 | **0 variantes huérfanas** | n=0 |
| §DR-9 | **0 global_catalog_id duplicados en variantes** | n=0 |
| §DR-10 | **0 UPs con nombre_canonico duplicado** | n=0 |
| §DR-11a–g | **Integridad del lote 7/7** | OK en todos |

### Post-validaciones (4 checks V-1 a V-4)

V-1: 16 UPs validated · V-2: 0 draft del lote · V-3: 6 preexistentes intactos · V-4: 15 variantes activas

---

## 6. C-005 — Offerings OBRAMAT Demo

**Especificación completa:** `docs/marketplace/MKT_FASE1_PILOT_002_OFFERINGS_FIXTURE.md`

### Las 5 offerings a crear

| supplier_ref | descripcion_comercial | UP destino | Variante destino |
|---|---|---|---|
| DEMO-FON-COC-001 | Grifo monomando cocina caño alto giratorio cromado | Grifo monomando cocina alto | — (UP directo) |
| DEMO-FON-CU15-001 | Tubo cobre rígido 15mm barra 3m | Tubo cobre | Tubo cobre 15mm |
| DEMO-FON-VSEG-001 | Válvula de seguridad 3/4" 3 bar latón | Válvula de seguridad | variante 3/4" 3 bar |
| DEMO-FON-PDR-001 | Plato de ducha resina 80x80cm blanco mate | Plato de ducha resina | Plato 80x80cm |
| DEMO-FON-C15-001 | Codo 90° cobre soldadura capilar 15mm | Codo 90° cobre | Codo 90° 15mm |

**Proceso:** Portal Proveedor o Supplier API v1 → `match_state='pending_review'` → PARAR para revisión humana → No cambiar a 'matched' sin aprobación.

---

## 7. Plan de pruebas — Tests 1–11

### TEST 1 — UP directo (Grifo cocina)

**Objetivo:** Motor IA persiste gc.id de UP directo; create_cart usa Level 0-B o 0-C.

```
Trigger: "Instalar grifo monomando de cocina caño alto"
gc: FON-GRF-COC (id: 67fb8206-...)
```

| Verificación | Esperado |
|---|---|
| quote_item.global_catalog_id | `67fb8206-30b4-4269-a9d4-07f4ff88e809` |
| quote_item.universal_product_id | `145d1eaa-a01b-47f3-b500-53dde3434367` |
| quote_item.universal_variant_id | NULL |
| cart_item.up_match_method | `structured_product` o `structured_global_catalog` |
| cart_item.up_match_confidence | 1.0 |
| cart_item.provider_alternatives | `≠ []` si DEMO-FON-COC-001 está linked y matched |

---

### TEST 2 — Variante (Tubo cobre 15mm)

**Objetivo:** Motor IA resuelve variante via batch lookup; create_cart usa Level 0-A.

```
Trigger: "Necesito 5 metros de tubo de cobre de 15 milímetros"
gc: FON-CU-015 (id: 13e82e7b-...)
```

| Verificación | Esperado |
|---|---|
| quote_item.global_catalog_id | `13e82e7b-6692-48e9-a9c6-41839df30dfd` |
| quote_item.universal_product_id | `e1b76491-1261-41dd-af99-03b0f2a834e1` |
| quote_item.universal_variant_id | `393f236b-a055-4908-8972-939acfd1fe68` |
| cart_item.up_match_method | `structured_variant` |
| cart_item.up_match_confidence | 1.0 |

---

### TEST 3 — Variante técnica (Válvula de seguridad 3/4, 3 bar)

**Objetivo:** Flujo completo hasta "sin proveedor" sin crash.

```
Trigger: "Poner válvula de seguridad de tres cuartos de pulgada a tres bares"
UP esperado: 6056ea3d (Válvula de seguridad)
```

| Verificación | Esperado |
|---|---|
| quote_item.universal_product_id | `6056ea3d-...` |
| cart_item.up_match_method | `structured_variant` o `structured_product` |
| cart_item.provider_alternatives | `[]` si DEMO-FON-VSEG-001 no está matched todavía |
| Sin error | ✅ cart_item creado correctamente |

---

### TEST 4 — Producto sin offering

**Objetivo:** Degradación elegante — UP identificado pero sin proveedor disponible.

```
Trigger: material que resuelve a UP del piloto sin offering linked
Ejemplo: "Codo de cobre de 15mm para conexión"
```

| Verificación | Esperado |
|---|---|
| cart_item.universal_product_id | `74d6d138-...` (no null) |
| cart_item.provider_alternatives | `[]` |
| cart_item.selected_offering_id | NULL |
| cart_item.precio_unitario_final | precio_material del quote_item (fallback) |
| UI | "Sin proveedor disponible" — sin crash |

---

### TEST 5 — Fallback textual (regresión ILIKE)

**Objetivo:** Items sin IDs estructurados siguen funcionando con Level 3.

**Setup:** quote_item con `global_catalog_id = NULL`, `universal_product_id = NULL`.

| Verificación | Esperado |
|---|---|
| Level 0-A/B/C | Skip (todos los IDs son NULL) |
| Level 3 | ILIKE encuentra UP validated preexistente si el texto coincide |
| cart_item.up_match_method | `fuzzy_fallback` o Level 1/2 si hay supplier_ref/catalog_variant_id |
| Sin error | ✅ |

---

### TEST 6 — No comercial

**Objetivo:** Partidas de mano de obra no generan cart_items.

```
Trigger: "Dos horas de instalación de fontanería"
tipo esperado: 'mano_de_obra'
```

| Verificación | Esperado |
|---|---|
| create_cart WHERE tipo='material' | Excluye la partida |
| trade_marketplace_cart_items | 0 items de esa partida |

---

### TEST 7 — Regresión (pedidos PZ-001A)

**Objetivo:** MKT-000001 y MKT-000002 siguen funcionando.

| Verificación | Esperado |
|---|---|
| 6 UPs validated preexistentes | ✅ Sin cambio tras C-004 |
| 16 offerings matched (PZ-FON-001 a 006) | ✅ Sin cambio |
| create_cart para "Grifo monomando ducha" | Level 3 o Level 0 (si tiene IDs) → alternatives ≠ [] |
| Scores de proveedor | Iguales o mejores que antes |

---

### TEST 8 — UP draft (regla validation_state)

**Objetivo:** Level 0 NO usa un UP en draft aunque los IDs sean correctos.

**Setup:** quote_item con IDs que apuntan a un UP en `validation_state='draft'` (no disponible aún en prod tras C-004; usar en entorno de test o esperar hasta antes de C-004).

| Verificación | Esperado |
|---|---|
| Level 0-A (si variant_id) | `product_not_validated` |
| Level 0-B (si product_id) | `product_not_validated` |
| Level 0-C (si global_catalog_id) | `product_not_validated` |
| Level 3 ILIKE | No encuentra el UP (también filtra validated) |
| cart_item.universal_product_id | NULL |
| cart_item.up_match_method | `product_not_validated` o `no_match` |
| Sin excepción | ✅ |

---

### TEST 9 — Incoherencia de IDs (structured_id_invalid)

**Objetivo:** universal_variant_id de UP-A + universal_product_id de UP-B → rechazo limpio.

**Setup:** Construir un quote_item con `universal_variant_id` de la variante "Tubo cobre 15mm" (UP e1b76491) y `universal_product_id` de "Válvula esférica" (UP 1b817393). Los dos UPs no están relacionados.

| Verificación | Esperado |
|---|---|
| Level 0-A coherence check | Detecta UP padre ≠ universal_product_id |
| v_up_method | `structured_id_invalid` |
| v_up_id | NULL |
| Level 0-B/C | Skipped (structured_id_invalid bloquea el resto del Level 0) |
| Levels 1-3 | Ejecutan normalmente como fallback |
| Sin excepción | ✅ |
| cart_item creado | ✅ (con el resultado de Level 1-3 o no_match) |

---

### TEST 10 — global_catalog_id sin UP en Marketplace

**Objetivo:** gc existe pero sin UP ni variante → conservar gc_id, usar fallback, no inventar.

**Setup:** quote_item con `global_catalog_id` de un gc que NO tiene UP ni variante (gc non-commerciales, o gc de otra categoría no migrada aún).

| Verificación | Esperado |
|---|---|
| resolveMarketplaceIds | gc_id ausente del gcMap |
| quote_item.global_catalog_id | persiste (el gc existe) |
| quote_item.universal_product_id | NULL |
| quote_item.universal_variant_id | NULL |
| Log | `[structured][global_catalog_without_marketplace_mapping]` |
| Level 0-C en create_cart | No encuentra UP (global_catalog_id no linkea a UP validated) |
| Level 3 | Intenta ILIKE → puede o no encontrar UP validated |
| Sin inventar relaciones | ✅ |

---

### TEST 11 — Presupuesto con 20 líneas (batch efficiency)

**Objetivo:** resolveMarketplaceIds usa exactamente 2 queries para cualquier número de líneas.

**Setup:** Generar un presupuesto con 20 partidas, donde ~15 tienen match en global_catalog.

| Verificación | Esperado |
|---|---|
| Queries a trade_marketplace_universal_products | 1 (IN con todos los gc_ids) |
| Queries a trade_marketplace_universal_product_variants | 1 (IN con gc_ids restantes) |
| Queries totales de resolución estructurada | ≤ 2 |
| Tiempo de enrichWithCatalogPrices | No se degrada linealmente con el número de partidas |
| Logs | Una línea `[structured][...]` por partida con gc_id |

---

## 8. Rollback por bloque

| Bloque | Archivo de rollback | Condición de seguridad |
|---|---|---|
| C-001 (DDL) | DROP COLUMN × 3 + DROP INDEX × 3 (en el script DDL, sección rollback) | Todas las columnas deben ser NULL |
| C-002 (Motor IA) | `git revert` del commit de la Edge Function | Sin deploy activo del nuevo código |
| C-003 (SQL) | `git revert` de la migración + `CREATE OR REPLACE` con función anterior | Función anterior disponible en git |
| C-004 (DML) | Rollback condicional en `MKT_FASE1_PILOT_002_VALIDATE_BATCH_UPS.sql` | 0 offerings matched en los 16 UPs |
| C-005 (offerings) | DELETE offerings con supplier_ref IN ('DEMO-FON-...') mientras match_state='pending_review' | No haber aprobado match_state='matched' |

---

## 9. Scripts y archivos de referencia

| Archivo | Descripción |
|---|---|
| `docs/marketplace/sql/MKT_FASE1_PILOT_002_QUOTE_ITEMS_DDL.sql` | C-001: DDL completo con validaciones |
| `supabase/migrations/20260801_03_marketplace_structured_cart.sql` | C-003: migración create_cart_from_quote con Level 0 |
| `docs/marketplace/sql/MKT_FASE1_PILOT_002_VALIDATE_BATCH_UPS.sql` | C-004 v2: dry run 11 secciones + DML + rollback |
| `docs/marketplace/MKT_FASE1_PILOT_002_OFFERINGS_FIXTURE.md` | C-005: especificación de las 5 offerings |
| `docs/marketplace/MKT_FASE1_PILOT_002_ANALYSIS.md` | Análisis base con trazabilidad de 5 casos y detección de rupturas |

---

*Plan v2.0 — Correcciones aplicadas: batch resolution C-002, validation_state='validated' obligatorio en Level 0, DRY RUN ampliado a 11 secciones, Opción A via Portal/API.*  
*Supabase: dqqjaujnulutinskmqsu · Fecha: 2026-08-01*
