# RC1-C.5B-PRE — Consolidación definitiva de proveedores demo

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** AUDITORÍA COMPLETADA — pendiente aprobación para ejecutar  
**Commit base:** cd8f5d3 (RC1-C.5A)

---

## RESUMEN EJECUTIVO

**Causa raíz confirmada:** La pantalla "Proveedores" del instalador consulta
`trade_supplier_catalogs` (motor de catálogos/presupuestos) en lugar de
`trade_marketplace_actors` (capa Marketplace). En esa tabla existen 21 catálogos
globales activos — 9 demo oficiales más 12 legacy. El instalador ve los 21 como
si fueran proveedores independientes.

**Solución mínima:** Añadir columna `marketplace_visible boolean DEFAULT false`
a `trade_supplier_catalogs` y marcarla `true` solo en los 9 catálogos demo oficiales.
La pantalla filtra con esa columna y muestra exactamente 9.

**Sin tocar:** nada de lo que hoy existe se elimina. Las offerings, pedidos,
catálogos legacy, motor de presupuestos e imports quedan intactos.

---

## FASE 0 — AUDITORÍA REAL

### 0.1 Fuente de datos de la pantalla "Proveedores"

**Componente:** `src/components/ScreenProveedoresCliente.tsx`  
**Mounting:** `AppDashboardView.tsx:6133` (`activeTab === 'suppliers'`)  
**Permiso requerido:** `catalog.manage`  
**Hook:** ninguno — carga directa en `useEffect` (líneas ~96-159)

**4 queries en paralelo (Promise.all):**

```ts
// Query 1 — Catálogos globales  ← ORIGEN DEL PROBLEMA
supabase.from('trade_supplier_catalogs')
  .select('id, supplier_key, supplier_name, margen_pct_default, prioridad, is_custom, org_id')
  .is('org_id', null)          // catálogos de plataforma
  .eq('is_active', true)       // solo activos
  .order('prioridad')
  // → devuelve 20 catálogos (todos los activos)

// Query 2 — Catálogo propio de la org
supabase.from('trade_supplier_catalogs')
  .eq('org_id', orgId)
  .eq('supplier_key', 'propio')
  .eq('is_active', true)

// Query 3 — Configuración de la org
supabase.from('trade_org_suppliers')
  .select('catalog_id, enabled, margen_override, preferido_categorias')
  .eq('org_id', orgId)

// Query 4 — Conteo de productos por catálogo
supabase.from('trade_supplier_products')
  .select('catalog_id')
```

**Tablas consultadas:** `trade_supplier_catalogs`, `trade_org_suppliers`, `trade_supplier_products`  
**NO consulta:** `trade_marketplace_actors`, `trade_marketplace_supplier_offerings`  
**RPCs usadas:** ninguna en esta pantalla  
**Filtros ausentes:** sin filtro por `actor_type`, `estado`, ni equivalente a `marketplace_visible`

### 0.2 Otras vistas relacionadas

| Archivo | Fuente | Propósito |
|---------|--------|-----------|
| `src/components/settings/SettingsSuppliers.tsx` | `trade_supplier_catalogs` | Ajustes de proveedor (margen, contacto) |
| `src/components/admin/AdminSuppliersSection.tsx` | `trade_supplier_catalogs` + `trade_marketplace_actors` | Admin central de compras |
| `src/components/portal/PortalCatalogo.tsx` | `trade_marketplace_offerings` | Vista del propio proveedor |
| `src/components/demo/DemoView.tsx:609` | datos hard-coded | Demo pública sin queries |

---

## FASE 1 — INVENTARIO COMPLETO

### 1.1 trade_marketplace_actors (10 registros)

| # | Nombre | Slug | Tipo | Estado | catalog_id vinculado |
|---|--------|------|------|--------|---------------------|
| 1 | TrabFlow | trabflow-platform | platform | active | — |
| 2 | Obras y Materiales S.L. | obramat-demo | supplier | active | 280c05e5 |
| 3 | Suministros Técnicos Norte S.L. | suministros-tecnicos-norte | supplier | active | 1aec572f |
| 4 | Pinturas Profesionales del Norte S.L. | pinturas-profesionales-norte | supplier | active | 5c72b86b |
| 5 | Carpintería y Cerramientos Norte S.L. | carpinteria-cerramientos-norte | supplier | active | 9907af28 |
| 6 | Revestimientos y Obra Norte S.L. | revestimientos-obra-norte | supplier | active | 6ea37e62 |
| 7 | ElectroSuministros Cantábrico S.L. | electrosuministros-cantabrico | supplier | active | 498a2e63 |
| 8 | Fontanería Saltos Quiroga S.L. | fontaneria-saltos-quiroga | supplier | active | 47fb567e |
| 9 | ElectroDistribución Cantábrica S.L. | electrodistribucion-cantabrica | supplier | active | ff706aad |
| 10 | Sistemas Térmicos del Norte S.L. | sistemas-termicos-norte | supplier | active | 8a44c358 |

**Conclusión:** Los 9 actores demo ya existen en BD, todos `active`, todos con `supplier_catalog_id`.  
No hay actores faltantes. No hay duplicados en esta tabla.

### 1.2 trade_supplier_catalogs globales — inventario completo (21 registros)

| supplier_key | supplier_name (visible) | is_active | prioridad | productos_activos | Clasificación | duplicado_de |
|-------------|------------------------|-----------|-----------|-------------------|--------------|-------------|
| obramat | Obras y Materiales S.L. | ✅ | 1 | 178 | **A — DEMO_OFICIAL** | — |
| saltoki | Fontanería Saltos Quiroga S.L. | ✅ | 2 | 170 | **A — DEMO_OFICIAL** | — |
| sonepar | ElectroDistribución Cantábrica S.L. | ✅ | 3 | 76 | **A — DEMO_OFICIAL** | — |
| electrosuministros-cantabrico | ElectroSuministros Cantábrico S.L. | ✅ | 3 | 0 | **A — DEMO_OFICIAL** | — |
| novelec | Distribuciones Eléctricas del Norte S.L. | ✅ | 4 | 71 | **B — LEGACY** | sonepar (EDC) |
| revestimientos-obra-norte | Revestimientos y Obra Norte S.L. | ✅ | 4 | 0 | **A — DEMO_OFICIAL** | — |
| rexel | ElectroDistribución Cantábrica S.L. | ✅ | 5 | 60 | **C — DUPLICATE** | sonepar (EDC) |
| wurth | Soluciones Profesionales Integradas S.L. | ✅ | 5 | 85 | **F — REVIEW** | sin actor asignado |
| pinturas-profesionales-norte | Pinturas Profesionales del Norte S.L. | ✅ | 5 | 0 | **A — DEMO_OFICIAL** | — |
| daikin | Sistemas Térmicos del Norte S.L. | ✅ | 6 | 46 | **B — LEGACY** | sistemas-termicos-norte (STN) |
| vaillant | Sistemas Térmicos del Norte S.L. | ✅ | 6 | 22 | **B — LEGACY** | sistemas-termicos-norte (STN) |
| carpinteria-cerramientos-norte | Carpintería y Cerramientos Norte S.L. | ✅ | 6 | 0 | **A — DEMO_OFICIAL** | — |
| junkers | Sistemas Térmicos del Norte S.L. | ✅ | 7 | 23 | **B — LEGACY** | sistemas-termicos-norte (STN) |
| saunier_duval | Sistemas Térmicos del Norte S.L. | ✅ | 7 | 48 | **B — LEGACY** | sistemas-termicos-norte (STN) |
| sistemas-termicos-norte | Sistemas Térmicos del Norte S.L. | ✅ | 8 | 0 | **A — DEMO_OFICIAL** | — |
| bricomart | Obras y Materiales S.L. | ✅ | 8 | 65 | **C — DUPLICATE** | obramat |
| ariston | Sistemas Térmicos del Norte S.L. | ✅ | 8 | 23 | **B — LEGACY** | sistemas-termicos-norte (STN) |
| baxi | Sistemas Térmicos del Norte S.L. | ✅ | 9 | 24 | **B — LEGACY** | sistemas-termicos-norte (STN) |
| obramat-demo | Obras y Materiales S.L. | ✅ | 10 | 0 | **D — EMPTY** | obramat |
| ferroli | Sistemas Térmicos del Norte S.L. | ❌ | 10 | 0 | **E — HISTORICAL** | sistemas-termicos-norte (STN) |
| suministros-tecnicos-norte | Suministros Técnicos Norte S.L. | ✅ | 50 | 0 | **A — DEMO_OFICIAL** | — |

**Leyenda:**
- **A DEMO_OFICIAL** — 9 catálogos vinculados a actor demo → deben ser visibles
- **B LEGACY** — fuente de datos histórica → mantener internamente, ocultar en UI
- **C DUPLICATE** — mismo nombre que un DEMO_OFICIAL con el mismo actor → ocultar
- **D EMPTY** — sin productos, sin actor vinculado → ocultar
- **E HISTORICAL** — inactivo → ya filtrado por `is_active=true`, sin cambio necesario
- **F REVIEW** — wurth, 85 productos, sin actor asignado, nombre diferente → decisión pendiente

### 1.3 Offerings por actor (verificado en BD)

| Actor | total_offerings | matched | activas | Estado |
|-------|----------------|---------|---------|--------|
| Obras y Materiales S.L. | 231 | **36** | 231 | ✅ 36 de 231 mapeadas; 195 pendientes de Sprint |
| Sistemas Térmicos del Norte S.L. | 35 | 35 | 35 | ✅ |
| Fontanería Saltos Quiroga S.L. | 20 | 20 | 20 | ✅ |
| Suministros Técnicos Norte S.L. | **19** | 18 | 19 | ⚠️ 1 en pending_review (ver §1.4) |
| ElectroDistribución Cantábrica S.L. | 15 | 15 | 15 | ✅ |
| ElectroSuministros Cantábrico S.L. | 6 | 6 | 6 | ✅ |
| Revestimientos y Obra Norte S.L. | 5 | 5 | 5 | ✅ |
| Carpintería y Cerramientos Norte S.L. | 3 | 3 | 3 | ✅ |
| Pinturas Profesionales del Norte S.L. | 2 | 2 | 2 | ✅ |

**Ningún actor está vacío en la capa Marketplace.** Todos tienen ≥ 2 offerings activas.

### 1.4 Incidencia STN-comp

`STN-FON-018` "Lavabo sobre encimera oval porcelana blanca" — `match_state = 'pending_review'`, activa, precio 99.40€.

Debe mapearse al UP `bf93aa66-808e-405d-b867-e8a85100a04d` ("Lavabo sobre encimera") que ya existe en el catálogo de FSQ. Acción: UPDATE `match_state = 'matched'`, `universal_product_id = bf93aa66...`.  
Incluir en RC1-C.5B (no bloquea la consolidación de proveedores).

---

## FASE 2 — REGLA DE VISIBILIDAD

### 2.1 Situación actual

La pantalla filtra: `trade_supplier_catalogs WHERE org_id IS NULL AND is_active = true`  
Resultado: **20 catálogos activos** (todos menos `ferroli`)

### 2.2 Objetivo

La pantalla debe mostrar exactamente **9 catálogos** (los DEMO_OFICIAL).

### 2.3 Mecanismo propuesto

**Opción A — Mínimo cambio (recomendada para RC1-C.5B-PRE):**

```sql
ALTER TABLE public.trade_supplier_catalogs
  ADD COLUMN marketplace_visible boolean NOT NULL DEFAULT false;

UPDATE public.trade_supplier_catalogs
SET marketplace_visible = true
WHERE supplier_key IN (
  'obramat',
  'saltoki',
  'sonepar',
  'electrosuministros-cantabrico',
  'revestimientos-obra-norte',
  'carpinteria-cerramientos-norte',
  'pinturas-profesionales-norte',
  'sistemas-termicos-norte',
  'suministros-tecnicos-norte'
);
```

Cambio en `ScreenProveedoresCliente.tsx` — añadir `.eq('marketplace_visible', true)`:

```ts
// Antes
supabase.from('trade_supplier_catalogs')
  .select(...)
  .is('org_id', null)
  .eq('is_active', true)
  .order('prioridad')

// Después
supabase.from('trade_supplier_catalogs')
  .select(...)
  .is('org_id', null)
  .eq('is_active', true)
  .eq('marketplace_visible', true)   // ← única línea añadida
  .order('prioridad')
```

**Ventajas de la Opción A:**
- 1 ALTER TABLE + 1 UPDATE + 1 línea de código
- No rompe el motor de presupuestos (los legacy siguen disponibles para `loadActiveSupplierCatalogs`)
- Reversible: basta con `marketplace_visible = false` para ocultar cualquier catálogo
- No requiere refactorización de tipos TypeScript

**Opción B — Correcta a largo plazo (para RC1-C.5B o posterior):**

```ts
supabase.from('trade_marketplace_actors')
  .select('id, nombre, slug, supplier_catalog_id, estado, metadata, settings')
  .eq('actor_type', 'supplier')
  .eq('estado', 'active')
  .order('nombre')
```

Requiere: adaptar el componente para usar la nueva forma de datos (sin `margen_pct_default`, `prioridad`, etc.). Mayor refactorización, mayor riesgo.

**Recomendación:** Ejecutar A ahora, planificar B como deuda técnica para Sprint posterior.

---

## FASE 3 — NO BORRAR DATOS HISTÓRICOS

### 3.1 Qué NO se elimina

| Recurso | Decisión |
|---------|---------|
| Catálogos legacy (vaillant, daikin, etc.) | **Mantener** — fuente de datos para motor de presupuestos |
| trade_supplier_products de todos los catálogos | **Mantener** — 891 referencias activas usadas en presupuestos |
| Catálogo `novelec` (71 productos) | **Mantener** — fuente potencial de EDC Sprint C |
| Catálogo `rexel` (60 productos) | **Mantener** — fuente potencial de EDC Sprint C |
| Catálogo `wurth` (85 productos) | **Mantener hasta decisión** — ver §F |
| Catálogo `bricomart` (65 productos) | **Mantener** — fuente potencial de ObrasMat Sprint posterior |
| Offerings de ObrasMat (195 sin mapear) | **Mantener** — pendientes de mapeo en Sprint C |
| Catálogo `obramat-demo` (vacío) | **Mantener** — legacy transitorio sin impacto |
| Catálogo `ferroli` (inactivo) | **Mantener** — ya excluido por `is_active = false` |
| Pedidos históricos | **Intactos** |
| Imports | **Intactos** |

---

## FASE 4 — MAPA DE IDENTIDADES DEFINITIVO

### 4.1 Mapa legacy → actor visible

```
FUENTE LEGACY              →  ACTOR DEMO VISIBLE               PRODUCTOS FUENTE
─────────────────────────────────────────────────────────────────────────────
vaillant (22 prods)        →  Sistemas Térmicos del Norte S.L.
daikin (46 prods)          →  Sistemas Térmicos del Norte S.L.
junkers (23 prods)         →  Sistemas Térmicos del Norte S.L.
saunier_duval (48 prods)   →  Sistemas Térmicos del Norte S.L.  (STN: 35 offerings mapped)
ariston (23 prods)         →  Sistemas Térmicos del Norte S.L.
baxi (24 prods)            →  Sistemas Térmicos del Norte S.L.
ferroli (0 prods, inact.)  →  Sistemas Térmicos del Norte S.L.

bricomart (65 prods)       →  Obras y Materiales S.L.           (ObrasMat: 36 matched)
obramat-demo (0 prods)     →  Obras y Materiales S.L.           (vacío, descartar en Sprint)

rexel (60 prods)           →  ElectroDistribución Cantábrica    (EDC: 15 matched,
novelec (71 prods)         →  ElectroDistribución Cantábrica     Sprint C: ampliar)

wurth (85 prods)           →  ⚠️ SIN ACTOR ASIGNADO — ver §4.2
```

### 4.2 Caso especial — wurth

- **supplier_key:** `wurth`
- **supplier_name visible:** "Soluciones Profesionales Integradas S.L." (nombre diferente a todos los actores)
- **Productos activos:** 85
- **Familia probable:** ferretería, herramientas, fijaciones, accesorios profesionales
- **Opciones:**

| Opción | Decisión | Implicación |
|--------|---------|------------|
| Asignar a ObrasMat | Wurth es fuente de material generalista | ObrasMat amplía catálogo con 85 refs en Sprint |
| Crear actor nuevo "Soluciones Profesionales Integradas" | Nuevo P2/P3 | Amplía el ecosistema; más trabajo de Sprint |
| Mantener como legacy invisible | Sin actor en UI | Productos disponibles para motor de presupuestos; no visible en Marketplace |

**Recomendación provisional:** mantener como legacy invisible hasta que el usuario decida. No bloquea la consolidación.

---

## FASE 5 — ACTORES VACÍOS

### 5.1 Verificación de los 9 actores oficiales

| Actor | Actor en BD | Estado | Catálogo | Offerings | Matched | ¿Vacío? |
|-------|------------|--------|----------|-----------|---------|--------|
| Obras y Materiales S.L. | ✅ 85e73234 | active | 280c05e5 (obramat) | 231 | 36 | ❌ no vacío |
| Sistemas Térmicos del Norte S.L. | ✅ ce208430 | active | 8a44c358 (sistemas-termicos-norte) | 35 | 35 | ❌ no vacío |
| Fontanería Saltos Quiroga S.L. | ✅ ff426e57 | active | 47fb567e (saltoki) | 20 | 20 | ❌ no vacío |
| Suministros Técnicos Norte S.L. | ✅ aeca7bac | active | 1aec572f (suministros-tecnicos-norte) | 19 | 18 | ❌ no vacío |
| ElectroDistribución Cantábrica S.L. | ✅ 2512201e | active | ff706aad (sonepar) | 15 | 15 | ❌ no vacío |
| ElectroSuministros Cantábrico S.L. | ✅ fba14bb4 | active | 498a2e63 | 6 | 6 | ❌ no vacío |
| Revestimientos y Obra Norte S.L. | ✅ ce5c781d | active | 6ea37e62 | 5 | 5 | ❌ no vacío |
| Carpintería y Cerramientos Norte S.L. | ✅ 0464ae2d | active | 9907af28 | 3 | 3 | ❌ no vacío |
| Pinturas Profesionales del Norte S.L. | ✅ d8f0bf84 | active | 5c72b86b | 2 | 2 | ❌ no vacío |

**Todos los actores tienen offerings. Ninguno vacío.**

---

## FASE 6 — ACTORES CON CATÁLOGO ESCASO

### 6.1 Backlog de ampliación (NO ejecutar ahora)

| Actor | Offerings actuales | Objetivo mínimo demo | GAP | Fuente sugerida |
|-------|-------------------|---------------------|-----|----------------|
| ElectroSuministros | 6 | 10–12 | +4–6 | Ampliar IP44 zonas húmedas, luminaria, extractores |
| Revestimientos | 5 | 8–10 | +3–5 | Cerámicos, pavimentos, morteros |
| Carpintería | 3 | 8–10 | +5–7 | Puertas, marcos, perfiles |
| Pinturas | 2 | 6–8 | +4–6 | Pinturas plástica, esmalte, imprimaciones, brochas |

**Pendiente de aprobación explícita en Sprint C.**

---

## FASE 7 — DATOS DEMO Y TRANSPARENCIA

### 7.1 Columna de marcado demo

Las 6 nuevas tablas de RC1-C.5B incluirán campo de marcado sintético:

```sql
-- En trade_marketplace_supplier_metrics
synthetic       boolean NOT NULL DEFAULT false,
synthetic_dataset text,            -- 'RC1_C5_DEMO'

-- En trade_marketplace_supplier_reviews
synthetic       boolean NOT NULL DEFAULT false,
synthetic_dataset text,

-- En trade_marketplace_promotions
synthetic       boolean NOT NULL DEFAULT false,
```

### 7.2 Regla de segregación

- **Métricas demo** (`synthetic = true`): calculadas con datos ficticios, dataset `RC1_C5_DEMO`
- **Métricas reales** (`synthetic = false`): calculadas únicamente a partir de `trade_marketplace_orders` reales
- Las queries de reporting nunca mezclan `synthetic = true` con `synthetic = false` en el mismo agregado
- Cuando llegue el primer proveedor real: filtrar `WHERE synthetic = false`

---

## FASE 8 — RESEÑAS DEMO

### 8.1 Cambios en alias

| Alias actual (problemático) | Alias propuesto |
|----------------------------|----------------|
| "J. Martínez, Reformas Norte SL" | "Instalador Demo 01 — Norte" |
| "Instalador Autónomo — Santander" | "Instalador Demo 02" |
| "Empresa Reformas Cantabria SL" | "Empresa Demo Reformas" |
| "Instalador Térmico A.R. — Torrelavega" | "Técnico Demo 01 — Zona Norte" |
| "Técnico Climatización — Santander" | "Técnico Demo 02" |
| "Empresa Calefacción Norte SL" | "Empresa Demo Calefacción" |
| "Fontanero autónomo — Laredo" | "Instalador Demo 03 — Fontanería" |
| "Reformas Integrales Cantabria" | "Empresa Demo Reformas 02" |
| "Electricista autónomo — Santander" | "Instalador Demo 04 — Electricidad" |
| "Instalaciones Eléctricas Norte SL" | "Empresa Demo Electricidad" |

### 8.2 UI recomendada

En la sección de reseñas del proveedor demo:

```
┌──────────────────────────────────────────────────────┐
│ ℹ️  Datos demostrativos                               │
│ Las valoraciones de esta vista son de ejemplo.        │
│ Un proveedor real mostrará aquí su actividad real.   │
└──────────────────────────────────────────────────────┘
```

Badge chip visible en el tab "Opiniones": `[Datos demo]`

---

## FASE 9 — BADGES — REVISIÓN ANTES DE IMPLANTAR

### 9.1 Badges problemáticos (certificaciones legales ficticias)

| Badge | Estado | Decisión |
|-------|--------|---------|
| "Instalador RITE" | ❌ Certificación legal — no atribuible a empresa ficticia | → Cambiar a "Gestión técnica RITE" |
| "REBT homologado" | ❌ Habilitación legal — no atribuible | → Cambiar a "Material REBT compatible" |
| "Garantía extendida" | ⚠️ Ambiguo | → Mantener como "Gestión de garantías" (funcional neutro) |
| "Fabricante directo" | ⚠️ Puede confundir | → Cambiar a "Distribuidor directo" |
| "+18 años de experiencia" | ⚠️ Dato ficticio | → Mantener con chip `[demo]` o cambiar a "Amplia trayectoria" |
| "+25 años de experiencia" | ⚠️ Dato ficticio | → Mantener con chip `[demo]` o cambiar a "Larga trayectoria" |

### 9.2 Badges seguros (funcionales neutros)

| Badge | Estado |
|-------|--------|
| "Especialista térmico" | ✅ OK |
| "Especialista fontanería" | ✅ OK |
| "Mayorista eléctrico" | ✅ OK |
| "Entrega rápida demo" | ✅ OK con chip |
| "Amplio catálogo" | ✅ OK |
| "Gama premium" | ✅ OK |
| "Especialista IP44" | ✅ OK |
| "Especialista cerámicos" | ✅ OK |
| "Distribuidor directo" | ✅ OK |

### 9.3 Lista de badges implantables (revisada)

```
B01: "Distribuidor integral"         (ObrasMat) — ✅
B02: "Entrega rápida"                (ObrasMat, FSQ, EDC) — ✅ (no prometer h exactas)
B03: "Amplia trayectoria"            (ObrasMat, reemplaza "+18 años") — ✅
B04: "Larga trayectoria"             (FSQ, reemplaza "+25 años") — ✅
B05: "Especialista térmico"          (STN) — ✅
B06: "Gestión técnica RITE"          (STN, reemplaza "Instalador RITE") — ✅
B07: "Gestión de garantías"          (STN) — ✅
B08: "Especialista fontanería"       (FSQ) — ✅
B09: "Mayorista eléctrico"           (EDC) — ✅
B10: "Material REBT compatible"      (EDC, reemplaza "REBT homologado") — ✅
B11: "Gama premium"                  (STN-comp) — ✅
B12: "Mejor valorado demo"           (STN-comp, con chip [demo]) — ✅
B13: "Especialista IP44"             (ElectroSum) — ✅
B14: "Especialista cerámicos"        (RevObra) — ✅
B15: "Distribuidor directo"          (Pinturas, reemplaza "Fabricante directo") — ✅
```

---

## FASE 10 — PROMOCIONES

### 10.1 Campo synthetic en promotions

```sql
-- Todas las promociones demo llevarán:
synthetic         boolean NOT NULL DEFAULT false,
synthetic_dataset text    -- 'RC1_C5_DEMO'
```

### 10.2 Regla publicidad ≠ ranking

Las promociones demo (`synthetic = true`) nunca afectan el orden del comparador de precios.

El ranking del comparador es siempre: `precio_profesional_neto ASC` (precio más bajo primero).

Las promociones son visibles en:
- Tab "Promociones" del perfil del proveedor
- Banner en ScreenProveedor
- Sección "Destacados" en ScreenMarketplace

Las promociones **NO** modifican el orden en:
- `get_offerings_for_up` (resultados de búsqueda por UP)
- Comparador de precios (resultados side-by-side)

---

## FASE 11 — PANTALLA PROVEEDORES — RESULTADO OBJETIVO

Con la implementación de `marketplace_visible`:

```
PROVEEDORES (9)

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 🏗️ Obras y      │ │ 🔥 Sistemas      │ │ 💧 Fontanería   │
│ Materiales S.L. │ │ Térmicos Norte  │ │ Saltos Quiroga  │
│ 36 productos    │ │ 35 productos    │ │ 20 productos    │
│ ⭐ 4.2 [demo]   │ │ ⭐ 4.5 [demo]   │ │ ⭐ 4.3 [demo]  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 🔩 Suministros  │ │ ⚡ ElectroDist.  │ │ 🔌 ElectroSum.  │
│ Técnicos Norte  │ │ Cantábrica S.L. │ │ Cantábrico S.L. │
│ 19 productos    │ │ 15 productos    │ │ 6 productos     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 🏠 Revestim.   │ │ 🚪 Carpintería   │ │ 🎨 Pinturas     │
│ y Obra Norte   │ │ y Cerramientos  │ │ Profesionales   │
│ 5 productos    │ │ 3 productos     │ │ 2 productos     │
└─────────────────┘ └─────────────────┘ └─────────────────┘

Sin duplicados legacy. Sin catálogos vacíos ajenos.
```

---

## FASE 12 — ADMIN

### 12.1 Vista técnica separada en Admin

`AdminSuppliersSection.tsx` ya consulta `trade_marketplace_actors` en paralelo. La vista admin puede mostrar:

**Tab "Marketplace" (actores):**
```
9 actores Marketplace
  Obras y Materiales → catálogo obramat → 36 matched / 231 total
  Sistemas Térmicos → catálogo sistemas-termicos-norte → 35 matched
  ...
```

**Tab "Catálogos legacy" (fuentes de datos):**
```
12 catálogos legacy activos
  vaillant — 22 productos → fuente de STN
  daikin — 46 productos → fuente de STN
  rexel — 60 productos → fuente potencial EDC Sprint C
  novelec — 71 productos → fuente potencial EDC Sprint C
  bricomart — 65 productos → fuente potencial ObrasMat Sprint
  wurth — 85 productos → ⚠️ sin actor asignado
  ...
```

Esta separación ya existe conceptualmente en `AdminSuppliersSection.tsx` — solo requiere ajuste visual.

---

## FASE 13 — PREPARACIÓN RC1-C.5B

Solo cuando quede confirmado el resultado (9 actores visibles), proceder a crear:

1. `trade_marketplace_actor_profiles` — vincula `actor_id`
2. `trade_marketplace_supplier_badges` — vincula `actor_id`
3. `trade_marketplace_supplier_metrics` — vincula `actor_id` + `synthetic`
4. `trade_marketplace_supplier_reviews` — vincula `actor_id` + `synthetic`
5. `trade_marketplace_promotions` — vincula `actor_id` + `synthetic`
6. `trade_marketplace_featured_offerings` — vincula `actor_id` + `offering_id`

**Nunca** `supplier_name` textual como FK principal.

---

## POSTVALIDACIÓN — CHECKLIST

| Ítem | Verificación | Estado |
|------|-------------|--------|
| Proveedores muestra exactamente 9 actores | Consultar tras ALTER + UPDATE + deploy | ⏳ pendiente |
| Ningún nombre real legacy visible en UI | Revisar pantalla tras deploy | ⏳ pendiente |
| Ningún duplicado visible | Comprobar visualmente | ⏳ pendiente |
| Ningún actor oficial sin productos | ✅ confirmado en BD | ✅ |
| Todos los perfiles apuntan al actor_id correcto | Tablas aún no creadas | ⏳ fase siguiente |
| Catálogos legacy disponibles para motor presupuestos | `marketplace_visible=false` no afecta `loadActiveSupplierCatalogs` | ✅ verificado |
| Offerings intactas | No se elimina nada | ✅ |
| Pedidos intactos | No se elimina nada | ✅ |
| Imports intactos | No se elimina nada | ✅ |
| Portal Proveedor intacto | No cambia `trade_marketplace_actors` ni offerings | ✅ |
| STN-comp STN-FON-018 mapeado | Pendiente UPDATE match_state | ⏳ incluir en RC1-C.5B |

---

## CAMBIOS NECESARIOS PARA APROBACIÓN

### Cambios en BD (requieren migración)

```sql
-- 1. Nueva columna en trade_supplier_catalogs
ALTER TABLE public.trade_supplier_catalogs
  ADD COLUMN marketplace_visible boolean NOT NULL DEFAULT false;

-- 2. Marcar los 9 catálogos demo oficiales
UPDATE public.trade_supplier_catalogs
SET marketplace_visible = true
WHERE supplier_key IN (
  'obramat',                       -- ObrasMat
  'saltoki',                       -- FSQ
  'sonepar',                       -- EDC
  'electrosuministros-cantabrico', -- ElectroSum
  'revestimientos-obra-norte',     -- RevObra
  'carpinteria-cerramientos-norte',-- Carpintería
  'pinturas-profesionales-norte',  -- Pinturas
  'sistemas-termicos-norte',       -- STN
  'suministros-tecnicos-norte'     -- STN-comp
);
-- Resultado: 9 TRUE, 12 FALSE (legacy), 0 eliminaciones

-- 3. Fix STN-comp offering pending_review
UPDATE public.trade_marketplace_supplier_offerings
SET 
  match_state = 'matched',
  universal_product_id = 'bf93aa66-808e-405d-b867-e8a85100a04d'
WHERE supplier_ref = 'STN-FON-018'
  AND supplier_catalog_id = '1aec572f-d22c-4556-9fbf-315ec7b3ba02';
```

### Cambios en frontend (1 línea)

```ts
// src/components/ScreenProveedoresCliente.tsx
// Añadir .eq('marketplace_visible', true) en la Query 1

supabase.from('trade_supplier_catalogs')
  .select('id, supplier_key, supplier_name, margen_pct_default, prioridad, is_custom, org_id')
  .is('org_id', null)
  .eq('is_active', true)
  .eq('marketplace_visible', true)   // ← AÑADIR
  .order('prioridad')
```

**Sin cambios en:** `trade_org_suppliers`, `trade_supplier_products`, `trade_marketplace_actors`, `trade_marketplace_supplier_offerings`, Portal Proveedor, motor de presupuestos.

---

## RIESGOS

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Motor de presupuestos depende de catálogos legacy | Alta | Alto | `marketplace_visible` no afecta `loadActiveSupplierCatalogs` (usa `is_active`, no `marketplace_visible`) |
| `SettingsSuppliers.tsx` también muestra catálogos | Media | Medio | Revisar si aplica el mismo filtro; si es para configurar márgenes, puede mantener todos los catálogos visibles |
| Ofertas de ObrasMat (195 sin mapear) confunden la UI | Baja | Bajo | La pantalla Proveedores muestra "36 productos matched" no total offerings |
| wurth sin actor → productos invisibles para Marketplace | Alta | Bajo | Sus productos siguen en motor de presupuestos; solo pierden visibilidad en UI Marketplace |
| STN-comp STN-FON-018 aparece como "pendiente" | Media | Bajo | Fix incluido en SQL de cambios |

## ROLLBACK

Si el cambio tiene efectos no deseados:

```sql
-- Revertir visibilidad (restaura los 20 catálogos)
UPDATE public.trade_supplier_catalogs SET marketplace_visible = false;
-- O directamente:
ALTER TABLE public.trade_supplier_catalogs DROP COLUMN marketplace_visible;
```

```ts
// Frontend: eliminar la línea .eq('marketplace_visible', true)
```

El rollback es inmediato y sin pérdida de datos.

---

## DECISIONES PENDIENTES DE APROBACIÓN

| # | Decisión | Opciones | Recomendación |
|---|---------|---------|--------------|
| D1 | Mecanismo de visibilidad | A (marketplace_visible) / B (consultar actors) | A — mínimo cambio |
| D2 | wurth — 85 productos sin actor | Asignar a ObrasMat / crear actor nuevo / legacy invisible | Legacy invisible (decidir en Sprint C) |
| D3 | SettingsSuppliers — ¿también filtrar? | Sí (solo 9) / No (todos los catálogos para configuración) | No — es herramienta técnica, no UI comercial |
| D4 | STN-com STN-FON-018 fix | Ejecutar UPDATE ahora / diferir | Ejecutar ahora (operación segura) |
| D5 | Badges con cerficiaciones → renombrar | Según tabla §9.3 | Sí — aplicar todos los cambios de nomenclatura |

---

## ENTREGABLE SIGUIENTE (RC1-C.5B)

Una vez aprobadas D1-D5:

1. Ejecutar migración (ALTER + 2× UPDATE)
2. Aplicar 1 línea en `ScreenProveedoresCliente.tsx`
3. Confirmar visualmente: exactamente 9 proveedores
4. Crear las 6 tablas de perfiles/métricas/badges/reseñas/promociones/featured
5. INSERT datos demo completos (con `synthetic = true`)
6. Integrar componentes UI (SupplierCard, SupplierBannerHero, tabs)
7. Commit RC1-C.5B
