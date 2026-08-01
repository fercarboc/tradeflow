# MKT-FASE1-PILOT-002 — Análisis del Puente Motor IA → UP → Variante → Marketplace

**Versión:** 1.0  
**Fecha:** 2026-08-01  
**Tipo:** Documento de análisis — solo lectura, sin modificaciones en producción  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)

---

## Resumen ejecutivo

El puente estructural `trade_global_catalog → trade_marketplace_universal_products → variante → offering` existe en base de datos y está correctamente poblado por MKT-FASE1-PILOT-001.

**Sin embargo, el puente no se usa.** El Motor IA nunca escribe identificadores estructurados al guardar un presupuesto. Como consecuencia, `create_cart_from_quote` no puede traversar el enlace gc→UP aunque exista, y cae a un fallback ILIKE de 20 caracteres que además excluye explícitamente los UPs en estado `draft` — donde están todos los 16 UPs nuevos.

La cadena está rota en dos puntos, ambos en código de aplicación, sin cambios de esquema necesarios para el primero.

---

## FASE 1 — Flujo actual documentado

### 1.1 Diagrama completo

```
MOTOR IA (trade-voice-to-quote Edge Function)
│
│  enrichWithCatalogPrices()
│  ─────────────────────────
│  Carga toda la trade_global_catalog en memoria (JS array).
│  Extrae palabras clave del concepto de la partida.
│  Compara con gc.descripcion usando .includes(keyword).
│  ESCRIBE: partida.precio_unitario, partida.catalog_codigo (TEXT)
│  NO ESCRIBE: gc.id, universal_product_id, variant_id, offering_id
│
│  enrichWithSupplierProducts()
│  ─────────────────────────────
│  RPC search_supplier_products(material_text, p_org_id)  ← texto
│  ESCRIBE: supplier_key, supplier_name, supplier_product_id (UUID),
│           catalog_variant_id (UUID → trade_supplier_products)
│  NO ESCRIBE: universal_product_id, global_catalog_id
│
▼
trade_quote_items
  ├── descripcion        TEXT    ← texto libre del Motor IA
  ├── familia            TEXT    ← familia inferida
  ├── supplier_ref       TEXT    ← de enrichWithSupplierProducts
  ├── catalog_variant_id UUID    ← trade_supplier_products.id (si enrichWithSupplierProducts acertó)
  └── [NO HAY global_catalog_id, universal_product_id, variant_id]
           ↑
           RUPTURA 1: el gc.id encontrado en memoria se descarta aquí

▼
create_cart_from_quote(p_quote_id)
│
│  NIVEL 0 (no existe): lookupby gc.id → universal_product_id
│
│  NIVEL 1 — catalog_variant_id → trade_marketplace_supplier_offerings.id
│    Funciona SOLO SI:
│      (a) enrichWithSupplierProducts encontró un match, Y
│      (b) ese trade_supplier_products.id fue migrado a una offering
│          por migrate_supplier_products_to_offerings(), Y
│      (c) esa offering tiene match_state='matched'
│    Estado actual: 16 offerings matched, todas en UPs preexistentes (PZ-FON-001 a 006)
│
│  NIVEL 2 — supplier_ref TEXT → trade_marketplace_supplier_offerings.supplier_ref
│    Funciona si enrichWithSupplierProducts escribió supplier_ref Y
│    ese ref texto coincide con una offering activa.
│
│  NIVEL 3 — ILIKE (CAMINO COMÚN para items de enrichWithCatalogPrices)
│    WHERE up.validation_state = 'validated'
│      AND (up.nombre_canonico ILIKE '%' || LEFT(descripcion,20) || '%'
│           OR up.familia ILIKE '%' || familia || '%')
│    RUPTURA 2: los 16 UPs nuevos tienen validation_state='draft'
│               → son INVISIBLES para este fallback
│
▼
trade_marketplace_cart_items
  ├── universal_product_id  UUID | NULL  ← NULL para los 16 UPs nuevos
  ├── provider_alternatives JSONB []     ← vacío si no hay UP
  └── ...

▼
_mkt_resolve_provider_alternatives(p_up_id, p_org_id, p_cantidad)
  Query por offering.universal_product_id = p_up_id AND match_state='matched'
  → Funciona correctamente cuando p_up_id no es NULL y hay offerings matched

▼
trade_marketplace_supplier_offerings  (match_state='matched')
  Estado actual: 16 offerings (todas en UPs preexistentes PZ-FON-001 a 006)
                 197 offerings en pending_review (sin UP asignado o no confirmado)

▼
PROVEEDOR: OBRAMAT (único con offerings activas)
```

### 1.2 Tablas implicadas

| Tabla | Rol | Estado respecto al piloto |
|---|---|---|
| `trade_global_catalog` | Fuente de verdad del Motor IA | ✅ Poblada, 101 registros fontanería |
| `trade_marketplace_universal_products` | Catálogo canónico del Marketplace | ✅ 22 UPs (6 validados + 16 draft nuevos) |
| `trade_marketplace_universal_product_variants` | Variantes de UPs | ✅ 15 variantes, todas con global_catalog_id |
| `trade_marketplace_supplier_offerings` | Catálogo del proveedor + precio | ⚠️ 16 matched (UPs viejos) + 197 pending_review |
| `trade_quote_items` | Items del presupuesto | ❌ No persiste gc.id ni up.id |
| `trade_marketplace_cart_items` | Items del carrito | ❌ universal_product_id=NULL para UPs nuevos |
| `trade_marketplace_orders` | Pedidos confirmados | ✅ Funciona cuando llega un offering_id |

### 1.3 Funciones y componentes clave

| Componente | Tipo | Función |
|---|---|---|
| `trade-voice-to-quote/index.ts` | Edge Function | Motor IA — genera partidas |
| `enrichWithCatalogPrices()` | JS function | Match gc por texto en memoria |
| `enrichWithSupplierProducts()` | JS function | Match supplier por RPC texto |
| `create_cart_from_quote()` | SQL function | Convierte quote→cart, 3 niveles de match |
| `_mkt_resolve_provider_alternatives()` | SQL function | Scoring de offerings por UP |
| `search_marketplace_offerings()` | SQL RPC | Búsqueda catálogo (FTS+ILIKE) |
| `auto_select_providers()` | SQL function | Autoselección proveedor por estrategia |
| `checkout_cart()` | SQL function | Genera pedidos desde carrito |
| `MarketplaceComprarView.tsx` | React | Wizard checkout (StepRevisar → StepConfirmar) |
| `StepMateriales.tsx` | React | Muestra items del carrito con UP info |
| `StepComparar.tsx` | React | Selección de proveedor por alternatives |

---

## FASE 2 — Trazabilidad de los 5 casos reales

### Datos de trazabilidad observados en producción

| Producto | gc_id | gc_precio_ref | UP nombre | UP estado | Link tipo | Variant | Offering |
|---|---|---|---|---|---|---|---|
| Tubo cobre 15mm | 13e82e7b | 3.20 € | Tubo cobre | **draft** | via_variante | Tubo cobre 15mm ✅ | **NULL** |
| Válvula esférica 1/2" | b7174bde | 6.50 € | Válvula esférica latón | **draft** | via_variante | Válvula esférica latón 1/2 pulgada ✅ | **NULL** |
| Plato de ducha 80x80 | 6892b8f0 | 130.00 € | Plato de ducha resina | **draft** | via_variante | Plato de ducha resina 80x80cm ✅ | **NULL** |
| Grifo monomando cocina | 67fb8206 | 55.00 € | Grifo monomando cocina alto | **draft** | directo | — | **NULL** |
| Codo 90° cobre 15mm | 9b371075 | 1.80 € | Codo 90° cobre | **draft** | via_variante | Codo 90° cobre 15mm ✅ | **NULL** |

### Interpretación caso a caso

**Caso 1 — Tubo cobre (FON-CU-015)**
```
gc.id=13e82e7b → UP "Tubo cobre" (draft) → variante "Tubo cobre 15mm" (activa) → offering: NINGUNA
```
El puente gc→UP→variante está completo y es traversable. La variante existe y está activa. No hay offering asociada al UP "Tubo cobre" porque ningún proveedor ha cargado tubo de cobre en su catálogo del Marketplace.

**Caso 2 — Válvula esférica (FON-VAL-ESF15)**
```
gc.id=b7174bde → UP "Válvula esférica latón" (draft) → variante "1/2 pulgada" (activa) → offering: NINGUNA
```
Mismo patrón. Estructura correcta. Sin oferta de proveedor.

**Caso 3 — Plato de ducha resina 80x80 (FON-SAN-DUC-P)**
```
gc.id=6892b8f0 → UP "Plato de ducha resina" (draft) → variante "80x80cm" (activa) → offering: NINGUNA
```
Existe una offering matched para "Plato de ducha" (PZ-FON-003, `validated`), pero es un UP diferente del que generamos. El Marketplace tiene OBRAMAT ofertando 5 platos de ducha distintos, todos vinculados al UP preexistente genérico, no al nuevo UP específico de resina.

**Caso 4 — Grifo monomando cocina (FON-GRF-COC)**
```
gc.id=67fb8206 → UP "Grifo monomando cocina alto" (draft, gc_directo) → offering: NINGUNA
```
UP directo con global_catalog_id correcto. Sin offerings. OBRAMAT tiene grifo monomando lavabo pero no cocina.

**Caso 5 — Codo 90° cobre 15mm (FON-ACC-C15T)**
```
gc.id=9b371075 → UP "Codo 90° cobre" (draft) → variante "15mm" (activa) → offering: NINGUNA
```
Estructura correcta. Ningún proveedor activo oferta accesorios de cobre en el Marketplace.

### Observación sobre las 16 offerings matched

Las 16 offerings confirmadas están vinculadas a los UPs **preexistentes** (PZ-FON-001 a PZ-FON-006), todos con `validation_state='validated'`. Los 16 UPs nuevos (draft) tienen cero offerings. El Marketplace actual funciona exclusivamente sobre los 6 UPs validados del piloto cero.

| UP con offerings activas | validation_state | Offerings |
|---|---|---|
| Grifo monomando ducha (PZ-FON-004) | validated | 4 |
| Grifo monomando lavabo (PZ-FON-001) | validated | 2 |
| Mampara de ducha (PZ-FON-006) | validated | 4 |
| Plato de ducha (PZ-FON-003) | validated | 5 |
| Sifón y desagüe ducha (PZ-FON-005) | validated | 1 |
| **UPs nuevos (16)** | **draft** | **0** |

---

## FASE 3 — Dependencias heredadas

### 3.1 Inventario de dependencias de texto

| # | Archivo | Línea | Tipo | Descripción | Criticidad |
|---|---|---|---|---|---|
| 1 | `supabase/functions/trade-voice-to-quote/index.ts` | 237–260 | `.includes()` JS | Match en memoria: keywords del concepto contra gc.descripcion. Escribe solo `catalog_codigo` (TEXT), descarta `gc.id`. Sin retorno de ningún ID estructurado. | **CRÍTICA** |
| 2 | `supabase/migrations/20260724_04_marketplace_checkout_flow.sql` | 355–367 | ILIKE + filtro draft | `create_cart_from_quote` Level 3: `ILIKE '%'\|\|LEFT(descripcion,20)\|\|'%'` con `validation_state='validated'`. Los 16 UPs nuevos (draft) son **invisibles**. | **CRÍTICA** |
| 3 | `supabase/migrations/20260724_04_marketplace_checkout_flow.sql` | 449–453 | ILIKE único | `create_cart_from_quote` job path: solo ILIKE, sin nivel estructurado. Los UPs draft invisibles. | **CRÍTICA** |
| 4 | `supabase/migrations/20260724_04_marketplace_checkout_flow.sql` | 509–513 | ILIKE único | `create_cart_from_field_action`: solo ILIKE. Mismo problema. | **CRÍTICA** |
| 5 | `supabase/migrations/20260724_04_marketplace_checkout_flow.sql` | 569–573 | ILIKE único | `create_cart_from_maintenance_incident`: ILIKE sobre `titulo`. Sin nivel estructurado. | **CRÍTICA** |
| 6 | `supabase/functions/trade-voice-to-quote/index.ts` | 309 | RPC texto | `search_supplier_products(material_text, ...)` — input texto, output UUID de `trade_supplier_products`. El UUID se pierde si no hay offering matched. | **MEDIA** |
| 7 | `supabase/migrations/20260724_04_marketplace_checkout_flow.sql` | 860 | ILIKE 15 chars | `add_cart_item` manual: `ILIKE '%'\|\|LEFT(p_descripcion,15)\|\|'%'`. Aún más truncado. | **MEDIA** |
| 8 | `supabase/migrations/20260724_03_marketplace_portal_schema.sql` | 1333–1360 | ILIKE admin | `suggest_up_for_offering`: ILIKE en UI de admin para sugerir UPs. Solo afecta backoffice. | **BAJA** |
| 9 | `supabase/migrations/20260724_marketplace_universal_products.sql` | 694 | ILIKE fallback | `search_marketplace_offerings` fallback tras FTS. Aceptable como degradación. | **BAJA** |
| 10 | `supabase/migrations/20260724_03_marketplace_portal_schema.sql` | 688–690 | ILIKE portal | Búsqueda en portal proveedor: ref, descripcion, nombre_canonico. Solo UI interna. | **BAJA** |
| 11 | `src/lib/supabase.ts` | 2657 | `.ilike()` | `learnPriceToCatalog` dedup por nombre genérico. Sin impacto en flujo de pedido. | **BAJA** |

### 3.2 Clasificación por área de impacto

**Críticas — bloquean el flujo completo:**
- Ruptura 1 (línea 237–260 Edge Function): el gc.id se descarta. La partida del presupuesto llega a `trade_quote_items` sin ningún identificador estructurado del Marketplace.
- Ruptura 2 (línea 355–367 SQL): el filtro `validation_state='validated'` excluye los 16 nuevos UPs de cualquier matching por ILIKE. Aunque se corrigiera la Ruptura 1, este filtro haría invisible el resultado.

**Medias — reducen la calidad del matching pero no bloquean el path estructurado:**
- `search_supplier_products` devuelve UUIDs pero solo son útiles si existe una offering matched correspondiente.
- `add_cart_item` con 15 caracteres: muy propenso a falsos positivos.

**Bajas — solo afectan UI de backoffice o son fallbacks aceptables:**
- Las búsquedas ILIKE en el portal proveedor y admin son herramientas de gestión, no del flujo automatizado.

---

## FASE 4 — Punto de pivote estructural

### 4.1 Situación actual

```
Motor IA encuentra: gc.descripcion ≈ "Tubo cobre 15mm"
Motor IA guarda en partida: catalog_codigo = "FON-CU-015"  (TEXT)
Motor IA DESCARTA: gc.id = "13e82e7b-..."               (UUID disponible pero no escrito)

En trade_quote_items se guarda:
  descripcion = "Tubo cobre 15mm"
  catalog_codigo = "FON-CU-015"
  [sin global_catalog_id]
  [sin universal_product_id]

create_cart_from_quote recibe:
  Level 1: catalog_variant_id = NULL → SKIP
  Level 2: supplier_ref = NULL → SKIP
  Level 3: ILIKE('%Tubo cob%') WHERE validation_state='validated' → 0 resultados
  Resultado: universal_product_id = NULL, provider_alternatives = []
```

### 4.2 Estado requerido

```
Motor IA encuentra: gc.descripcion ≈ "Tubo cobre 15mm"
Motor IA escribe en partida: catalog_codigo = "FON-CU-015"
                              global_catalog_id = "13e82e7b-..."   ← NUEVO
                              universal_product_id = "e1b76491-..." ← NUEVO (lookup gc→UP)
                              variant_id = "393f236b-..."           ← NUEVO (si hay variante activa)

En trade_quote_items se guarda:
  descripcion = "Tubo cobre 15mm"
  global_catalog_id = "13e82e7b-..."
  universal_product_id = "e1b76491-..."

create_cart_from_quote recibe:
  Level 0 (NUEVO): WHERE o.universal_product_id = v_item.universal_product_id
                   AND o.match_state = 'matched' → offering directa (cuando exista)
  Level 1: catalog_variant_id → SKIP (o reutilizar para variante FK)
  Level 2: supplier_ref → SKIP
  Level 3 (fallback, expandido): ILIKE sin filtro 'validated' o con fallback a 'draft'
```

### 4.3 Cadena de IDs objetivo

```
trade_global_catalog.id   (gc_id)
        │
        │  FK: trade_marketplace_universal_products.global_catalog_id
        ▼
trade_marketplace_universal_products.id   (universal_product_id)
        │
        │  FK: trade_marketplace_universal_product_variants.universal_product_id
        ▼
trade_marketplace_universal_product_variants.id   (variant_id)
        │
        │  FK: trade_marketplace_supplier_offerings.universal_product_id
        ▼
trade_marketplace_supplier_offerings.id   (offering_id)
        │
        │  FK: trade_marketplace_orders.offering_id
        ▼
PEDIDO AL PROVEEDOR
```

Esta cadena ya existe en el esquema. El trabajo es **propagar los IDs de arriba hacia abajo** en el momento en que el Motor IA hace el match.

---

## Incidencias encontradas

### INC-001 — Motor IA descarta gc.id (CRÍTICA)

**Origen:** `supabase/functions/trade-voice-to-quote/index.ts`, función `enrichWithCatalogPrices()`.  
**Síntoma:** `trade_quote_items` no contiene `global_catalog_id` ni `universal_product_id`.  
**Impacto:** `create_cart_from_quote` no puede usar el enlace estructurado aunque exista en la BD.  
**Condición:** Afecta a todos los items priced via `enrichWithCatalogPrices` (la mayoría).

### INC-002 — create_cart_from_quote excluye UPs en draft (CRÍTICA)

**Origen:** `supabase/migrations/20260724_04_marketplace_checkout_flow.sql`, Level 3 fallback, línea ~360.  
**Síntoma:** `WHERE up.validation_state = 'validated'` excluye los 16 UPs nuevos.  
**Impacto:** Incluso si el nombre coincidiera por ILIKE, los UPs del piloto serían invisibles.  
**Condición:** Afecta a todos los UPs con validation_state diferente de 'validated'.

### INC-003 — trade_quote_items no tiene columna global_catalog_id (BLOQUEANTE)

**Origen:** Esquema de `trade_quote_items`.  
**Síntoma:** No existe columna donde persistir el gc.id aunque el Motor IA lo escribiera.  
**Impacto:** La Ruptura 1 (INC-001) no puede resolverse sin un DDL previo.  
**Condición:** Requiere migración DDL: `ALTER TABLE trade_quote_items ADD COLUMN global_catalog_id uuid REFERENCES trade_global_catalog(id)`.

### INC-004 — Los 16 nuevos UPs no tienen offerings (BLOQUEANTE FUNCIONAL)

**Origen:** Ningún proveedor activo ha cargado catálogo compatible con los 16 UPs.  
**Síntoma:** Aunque se corrijan INC-001, INC-002 e INC-003, el carrito mostraría UP sin opciones de compra.  
**Impacto:** El flujo completo no puede ejercerse hasta que existan offerings matched para al menos 1 de los 16 UPs.  
**Condición:** Requiere matching de las 197 offerings pending_review contra los UPs, o carga de nuevas offerings.

### INC-005 — ILIKE con 20 caracteres es frágil (MEDIA)

**Origen:** Level 3 en todas las funciones `create_cart_from_*`.  
**Síntoma:** "Tubo cobre 22mm" y "Tubo cobre 15mm" truncan a "Tubo cobre 22mm (po" — posible colisión.  
**Impacto:** Falsos positivos para productos con nombres similares en los primeros 20 caracteres.  
**Condición:** Afecta a todas las familias con múltiples variantes (Tubo cobre, Válvula esférica, Codo...).

### INC-006 — Las 4 funciones create_cart_from_* no tienen nivel estructurado (MEDIA)

**Origen:** `create_cart_from_job`, `create_cart_from_field_action`, `create_cart_from_maintenance_incident`, `add_cart_item`.  
**Síntoma:** Solo tienen el ILIKE fallback, sin Level 0-2.  
**Impacto:** No pueden beneficiarse de los identificadores estructurados aunque existan.  
**Condición:** Menor prioridad que INC-001 porque el volumen principal es `create_cart_from_quote`.

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Motor IA corregido pero UPs sin offerings → carrito vacío | ALTA | ALTO | Resolver INC-004 antes o en paralelo de INC-001 |
| UPs nuevos en draft invisibles al usuario del Marketplace | ALTA | ALTO | Resolver INC-002 con política clara sobre draft visibility |
| INC-003 DDL rompe Motor IA si columna no es nullable | BAJA | ALTO | ADD COLUMN ... DEFAULT NULL (siempre nullable) |
| ILIKE false-positive asigna UP incorrecto (ej. "Plato de ducha resina" vs "Plato de ducha") | MEDIA | MEDIO | INC-004 es mitigante: si el UP incorrecto no tiene offerings, el carrito queda vacío igualmente |
| Los 197 pending_review se asignan masivamente a UPs incorrectos | MEDIA | ALTO | Matching siempre con validación humana o reglas estrictas (protocolo MKT-ARCH-01 §5) |

---

## Propuesta de corrección

### CORRECCIÓN-001 — DDL: añadir global_catalog_id a trade_quote_items

**Prerrequisito de todo lo demás.**

```sql
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS global_catalog_id uuid
    REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_global_catalog_id
  ON public.trade_quote_items(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;
```

Necesita: `MKT_FASE1_PILOT_002_QUOTE_ITEMS_DDL.sql` con pre/post validaciones.

### CORRECCIÓN-002 — Motor IA: persistir gc.id y hacer lookup UP al encontrar match

En `enrichWithCatalogPrices`, cuando se encuentra un match de gc:

```typescript
// Tras el match en memoria:
partida.catalog_codigo = matchedGcItem.codigo;          // ya existe
partida.global_catalog_id = matchedGcItem.id;           // NUEVO — UUID del gc

// Lookup del UP correspondiente (1 query adicional, ejecutable en batch)
const { data: upRow } = await supabase
  .from('trade_marketplace_universal_products')
  .select('id')
  .eq('global_catalog_id', matchedGcItem.id)
  .maybeSingle();
if (upRow) partida.universal_product_id = upRow.id;     // NUEVO
```

Al guardar el quote item: incluir `global_catalog_id` y `universal_product_id` en el INSERT.

### CORRECCIÓN-003 — SQL: añadir Level 0 a create_cart_from_quote

Antes del Level 1 existente:

```sql
-- Level 0: match estructurado por universal_product_id (mayor confianza)
IF v_item.universal_product_id IS NOT NULL THEN
  SELECT up.id, 1.0, 'structured_id'
  INTO v_up_id, v_match_confidence, v_match_method
  FROM public.trade_marketplace_universal_products up
  WHERE up.id = v_item.universal_product_id;
END IF;
```

Nota: este nivel funciona aunque el UP esté en estado draft (intencionado — el UP está en el sistema, simplemente no `validated` para búsqueda pública aún).

### CORRECCIÓN-004 — SQL: ajustar filtro validation_state en Level 3

Ampliar el Level 3 para incluir UPs en draft cuando no hay resultado en validated:

```sql
-- Level 3a: validated (comportamiento actual)
SELECT up.id, 0.6, 'ilike_validated' ...
WHERE up.validation_state = 'validated' AND ...

-- Level 3b (si Level 3a devuelve NULL): draft también
SELECT up.id, 0.4, 'ilike_draft' ...
WHERE up.validation_state IN ('draft','validated') AND ...
```

O bien: cambiar `validation_state='validated'` a `validation_state IN ('draft','validated')` y diferenciar por confidence.

### CORRECCIÓN-005 — Proceso: matching offerings pending_review contra UPs nuevos

197 offerings en `pending_review` sin UP asignado. Proceso separado (ver MKT-ARCH-01 §5 — protocolo de matching). Requerido para que el flujo completo sea ejercitable en producción con datos reales.

---

## Plan de implantación

### Orden obligatorio

```
CORRECCIÓN-001  DDL trade_quote_items (sin esto, el resto no puede persistir)
      ↓
CORRECCIÓN-002  Motor IA: persistir gc.id + lookup UP (Edge Function)
      ↓
CORRECCIÓN-003  SQL Level 0 en create_cart_from_quote
      ↓
CORRECCIÓN-004  Ajuste filtro validation_state
      ↓
CORRECCIÓN-005  Matching offerings pending_review (proceso independiente, en paralelo o después)
```

### Impacto estimado

| Corrección | Tipo | Riesgo de regresión | Efecto |
|---|---|---|---|
| C-001 | DDL nullable | Muy bajo | Habilita C-002 |
| C-002 | Edge Function | Bajo (columna nueva, additive) | Motor IA escribe IDs estructurados |
| C-003 | SQL function | Bajo (Level 0 no afecta Levels 1-3) | create_cart usa ID directo cuando disponible |
| C-004 | SQL function | Medio (cambia comportamiento de fallback) | UPs draft visibles al cart |
| C-005 | Proceso humano/semi-auto | Bajo (solo actualiza match_state) | Offerings activas para UPs nuevos |

### Dependencias de producción

C-001 a C-004 son independientes de CORRECCIÓN-005. Se puede desplegar la cadena de código sin que los UPs nuevos tengan offerings, siempre que el sistema degrade con gracia (carrito con UP identificado pero sin alternativas de proveedor). El usuario vería el UP correcto pero sin precio — que es un estado válido y comunicable.

---

## Entregables de este análisis

- ✅ `docs/marketplace/MKT_FASE1_PILOT_002_ANALYSIS.md` — este documento
- ✅ Diagrama del flujo completo (§FASE 1.1)
- ✅ Trazabilidad de 5 casos reales con datos de producción (§FASE 2)
- ✅ Inventario de dependencias de texto clasificadas (§FASE 3)
- ✅ Punto de pivote estructural y cadena de IDs objetivo (§FASE 4)
- ✅ Incidencias catalogadas (INC-001 a INC-006)
- ✅ Riesgos con mitigación
- ✅ Propuesta de corrección (C-001 a C-005) con orden de ejecución

---

*Análisis realizado en modo lectura. Sin modificaciones en producción.*  
*Supabase: dqqjaujnulutinskmqsu · Commit de referencia: 703cfe9 · Fecha: 2026-08-01*
