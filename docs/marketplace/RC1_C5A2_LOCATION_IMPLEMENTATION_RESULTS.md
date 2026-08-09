# RC1-C.5A.2 — Resultados de implantación: Locations, Stock Local y Promociones

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** COMPLETADO ✓  
**Sprint:** RC1 — Consolidación UX para pilotos comerciales  
**Siguiente fase:** RC1-C.5B (pendiente aprobación separada)

---

## 1. Resumen ejecutivo

La implantación RC1-C.5A.2 extiende el Marketplace con:

- **Red de tiendas/almacenes** (`trade_marketplace_supplier_locations`) — 17 locations demo georreferenciadas para 9 actores
- **Stock local** (`trade_marketplace_location_inventory`) — 26 entradas de stock por tienda, con resolución local→nacional
- **Promociones** (`trade_marketplace_promotions`) — 12 promociones demo con scope nacional/regional/local y resolución de precio por capas
- **4 funciones SQL** — Haversine, resolución de precio efectivo, locations por actor, stock local
- **Integración técnica checkout** — RPC `get_supplier_checkout_config` actualizada, `StepEntrega.tsx` migrado, tipos TypeScript

**CORRECCIONES DE ARQUITECTURA aplicadas:**
1. Inventario no es pricing — `trade_marketplace_location_inventory` es exclusivamente stock, sin campos de precio
2. Ranking sin manipulación — `resolve_effective_offering_price` es la única fuente de precio; no hay `ORDER BY precio ASC` hardcodeado como algoritmo final del comparador

---

## 2. Migraciones ejecutadas

| ID   | Nombre | Contenido |
|------|--------|-----------|
| M001 | `rc1_c5a2_supplier_locations` | Tabla `trade_marketplace_supplier_locations`, ENUM `location_tipo`, índices. Deprecación de `trade_marketplace_supplier_pickup_points` (campo `deprecated_at`). |
| M002 | `rc1_c5a2_location_inventory` | Tabla `trade_marketplace_location_inventory`, ENUM `stock_local_status`, UNIQUE(location_id, offering_id), trigger `trg_inventory_actor_check`. |
| M003 | `rc1_c5a2_promotions` | Tabla `trade_marketplace_promotions`, ENUMs `promo_tipo`/`promo_scope`, CHECK constraints de scope, trigger `trg_promotion_actor_check`. |
| M004 | `rc1_c5a2_functions` | Funciones: `haversine_km`, `resolve_effective_offering_price`, `get_locations_for_actor`, `get_local_stock`. Implementación Haversine en SQL puro (sin PostGIS). |
| M005 | `rc1_c5a2_demo_locations` | 17 locations sintéticas (synthetic=true, synthetic_dataset='RC1_C5A2_DEMO') |
| M006 | `rc1_c5a2_demo_inventory` | 26 entradas de inventario local (sintéticas) |
| M007 | `rc1_c5a2_demo_promotions` | 12 promociones demo (sintéticas) |
| M008 | `rc1_c5a2_update_checkout_config_rpc_drop_create` | DROP + CREATE `get_supplier_checkout_config` con campo `supplier_locations` |

---

## 3. Tablas creadas

### 3.1 `trade_marketplace_supplier_locations`

```sql
CREATE TABLE public.trade_marketplace_supplier_locations (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id              uuid NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  codigo_interno        text,          -- referencia interna del actor (LOC-OBR-001, etc.)
  nombre                text NOT NULL,
  tipo                  public.location_tipo NOT NULL DEFAULT 'tienda',
  direccion_linea1      text,
  codigo_postal         text,
  localidad             text NOT NULL,
  provincia             text NOT NULL,
  comunidad_autonoma    text,
  pais                  char(2) NOT NULL DEFAULT 'ES',
  latitud               numeric(9,6),
  longitud              numeric(9,6),
  telefono              text,
  email                 text,
  horario               jsonb,         -- { "lunes": "9:00-18:00", ... }
  permite_recogida      bool NOT NULL DEFAULT true,
  permite_entrega_local bool NOT NULL DEFAULT false,
  radio_servicio_km     int,
  activa                bool NOT NULL DEFAULT true,
  orden                 int NOT NULL DEFAULT 0,
  synthetic             bool NOT NULL DEFAULT false,
  synthetic_dataset     text,
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
```

**Dataset demo: 17 locations**

| Actor | Locations |
|-------|-----------|
| ObrasMat | 4 (Santander C.V., Torrelavega, Laredo, Madrid Vallecas) |
| STN | 3 (Santander, Bilbao, Gijón) |
| FSQ | 3 (Santander Centro, Torrelavega, Bilbao) |
| EDC | 2 (Maliaño, Basauri) |
| ElectroSum | 1 (Santander) |
| RevObra | 1 (Santander) |
| Carpintería | 1 (Santander) |
| Pinturas | 1 (Santander) |
| STN-comp | 1 (Santander) |
| **Total** | **17** |

### 3.2 `trade_marketplace_location_inventory`

```sql
CREATE TABLE public.trade_marketplace_location_inventory (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id    uuid NOT NULL REFERENCES trade_marketplace_supplier_locations(id) ON DELETE CASCADE,
  offering_id    uuid NOT NULL REFERENCES trade_marketplace_supplier_offerings(id) ON DELETE CASCADE,
  stock_status   public.stock_local_status NOT NULL DEFAULT 'disponible',
  stock_cantidad int,
  reservado      int NOT NULL DEFAULT 0,
  plazo_local_dias int,
  updated_at     timestamptz DEFAULT now(),
  updated_by     text,
  source         text,
  synthetic      bool NOT NULL DEFAULT false,
  synthetic_dataset text,
  UNIQUE (location_id, offering_id)
);
```

**Dataset demo: 26 entradas**

Nota: sin campos de precio. El precio resulta exclusivamente de `trade_marketplace_promotions` vía `resolve_effective_offering_price()`.

### 3.3 `trade_marketplace_promotions`

```sql
CREATE TABLE public.trade_marketplace_promotions (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id              uuid NOT NULL REFERENCES public.trade_marketplace_actors(id),
  tipo                  public.promo_tipo NOT NULL,
  scope                 public.promo_scope NOT NULL DEFAULT 'national',
  location_id           uuid REFERENCES public.trade_marketplace_supplier_locations(id),
  comunidad_autonoma    text,
  titulo                text NOT NULL,
  descripcion           text,
  cta_label             text,
  fecha_inicio          date NOT NULL,
  fecha_fin             date,
  activa                bool NOT NULL DEFAULT true,
  mostrar_en_home       bool NOT NULL DEFAULT false,
  mostrar_en_perfil     bool NOT NULL DEFAULT true,
  mostrar_chip_comparador bool NOT NULL DEFAULT false,
  config                jsonb NOT NULL DEFAULT '{}',
  synthetic             bool NOT NULL DEFAULT false,
  synthetic_dataset     text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
```

**CHECK constraints de scope:**
- `location_id IS NOT NULL` requerido cuando `scope = 'local'`
- `comunidad_autonoma IS NOT NULL` requerido cuando `scope = 'regional'`
- `location_id IS NULL` cuando `scope != 'local'`

**Dataset demo: 12 promociones**

| Actor | Tipo | Scope |
|-------|------|-------|
| ObrasMat | pack_ahorro | national |
| ObrasMat | clearance | local (Torrelavega) |
| ObrasMat | envio_gratis | national |
| STN | pack_ahorro | national |
| STN | excess_stock | local (Santander) |
| FSQ | pack_ahorro | national |
| FSQ | descuento_porcentaje | regional (Cantabria) — P08 |
| FSQ | clearance | local (Santander) |
| EDC | pack_ahorro | national |
| EDC | recogida_gratis | local (Maliaño) |
| STN-comp | descuento_porcentaje | national |
| ObrasMat | destacado_home | national |

---

## 4. Funciones SQL

### `haversine_km(lat1, lon1, lat2, lon2)`
Distancia en km usando fórmula Haversine en SQL puro (sin PostGIS, sin `cube/earthdistance`). IMMUTABLE.

### `resolve_effective_offering_price(p_offering_id, p_org_id, p_location_id, p_comunidad_auto, p_cantidad)`
Resolución por capas (mejor precio gana):
1. precio base `precio_profesional` de la offering
2. promo nacional activa (menor descuento → mayor ahorro)
3. promo regional activa (por `comunidad_autonoma`)
4. promo local activa (por `location_id`)

Devuelve: `net_amount`, `tax_rate`, `gross_amount`, `price_source`, `promotion_id`, `location_id`, `valid_until`, `resolution_version='RC1-C.5A.2-v1'`

### `get_locations_for_actor(p_actor_id, p_permite_recogida, p_obra_lat, p_obra_lon)`
Devuelve locations activas del actor ordenadas por distancia Haversine a la obra (si coordenadas disponibles).

### `get_local_stock(p_offering_id, p_location_id)`
Stock local: si hay entrada en `location_inventory` usa esa; si no, devuelve `disponible` como fallback nacional.

---

## 5. Integración checkout — cambios de código

### 5.1 BD — `get_supplier_checkout_config` (DROP + CREATE)

Añade columna `supplier_locations jsonb` al RETURNS TABLE. La columna `pickup_points` se mantiene retornando `'[]'::jsonb` siempre (deprecated). `permite_recogida` ahora se deriva automáticamente si el actor tiene locations activas con `permite_recogida=true`.

### 5.2 TypeScript — `src/lib/api/marketplace-checkout.ts`

Nuevos tipos:
- `SupplierLocationTipo` ('tienda' | 'almacen' | 'delegacion' | 'punto_recogida')
- `SUPPLIER_LOCATION_TIPO_LABELS` — etiquetas de UI
- `SupplierLocation` — campos para mostrar en selector
- `LocationForActor extends SupplierLocation` — con `distancia_km`
- `LocalStockResult` — resultado de `get_local_stock`
- `EffectivePriceResultV2` — resultado de `resolve_effective_offering_price` RC1-C.5A.2

Cambios en interfaces:
- `SupplierCheckoutConfig.supplier_locations: SupplierLocation[]` — **nuevo campo**
- `SupplierCheckoutConfig.pickup_points` — marcado `@deprecated`
- `DeliveryOptionPerProvider.pickup_location_id?: string | null` — **nuevo**
- `DeliveryOptionPerProvider.pickup_location_snapshot?: SupplierLocation | null` — **nuevo**
- `DeliveryOptionPerProvider.pickup_point_id` — marcado `@deprecated`

Nuevas funciones:
- `getLocationsForActor()` — llama a `get_locations_for_actor` RPC
- `getLocalStock()` — llama a `get_local_stock` RPC
- `resolveEffectivePriceWithLocation()` — llama a `resolve_effective_offering_price` RC1-C.5A.2

### 5.3 React — `src/components/marketplace/StepEntrega.tsx`

- Import de `SupplierLocation`, `SupplierLocationTipo`, `SUPPLIER_LOCATION_TIPO_LABELS`
- `availableMethods`: recogida ahora basada en `supplier_locations.filter(l => l.permite_recogida).length > 0`
- Selector de recogida: reemplaza `pickup_points.map()` por `pickupLocations.map()` con:
  - chip de tipo (Tienda/Almacén/Delegación/Punto de recogida)
  - dirección compuesta `direccion_linea1, localidad, provincia`
  - selección guarda `pickup_location_id` y `pickup_location_snapshot`
- Validación: `pickup_location_id || pickup_point_id` (ambos aceptados)

---

## 6. Tests ejecutados (T1-T16)

Todos PASS tras correcciones.

| Test | Descripción | Resultado |
|------|-------------|-----------|
| T1 | ObrasMat tiene 4 locations activas | ✅ PASS |
| T2 | Stock fallback nacional cuando no hay inventario local | ✅ PASS |
| T3 | `disponible_hoy` correcto en stock local | ✅ PASS |
| T4 | `sin_stock` overrride local | ✅ PASS |
| T5 | Diferente status por tienda para misma offering | ✅ PASS |
| T6 | `professional_pvd` cuando no hay promo activa | ✅ PASS |
| T7 | Promo regional Cantabria -8% (P08 FSQ) | ✅ PASS (fix: `fecha_inicio` actualizado a 2026-08-01) |
| T8 | Promo local clearance lavabo ObrasMat Torrelavega | ✅ PASS |
| T9 | Trigger rechaza cross-actor en inventario | ✅ PASS |
| T10 | CHECK constraints de scope en promociones | ✅ PASS |
| T11 | Haversine: Santander 0.0km vs Basauri ~78km | ✅ PASS |
| T12 | Haversine: Madrid más cerca que Santander | ✅ PASS |
| T13 | `permite_recogida=false` filtra locations | ✅ PASS |
| T14 | Pinturas tiene exactamente 1 location | ✅ PASS |
| T15 | `destacado_home` no incluye `pct` descuento | ✅ PASS |
| T16 | `pickup_points` vacía y marcada deprecated | ✅ PASS |

### Incidencias durante implantación

**I1 — M006 cross-actor rechazado:** Intento de insertar offering de FSQ en location de STN. Trigger `fn_validate_inventory_actor_consistency` rechazó correctamente. Corrección: reemplazar con offerings STN propias.

**I2 — M007 P12 ambigüedad de columna:** `ARRAY(SELECT id::text ...)` con JOIN generó error "column reference 'id' is ambiguous". Corrección: CTE `WITH stc_offerings AS (SELECT o.id::text AS oid ...)`.

**I3 — T7 promo fuera de rango:** P08 tenía `fecha_inicio='2026-09-01'` pero fecha actual es 2026-08-09. Corrección: `UPDATE ... SET fecha_inicio='2026-08-01'`.

**I4 — No PostGIS disponible:** `pg_trgm` instalado pero no `cube/earthdistance`. Haversine implementado en SQL puro con funciones trigonométricas estándar.

---

## 7. Rollback

```sql
-- Revertir integración checkout (si es necesario antes de commit)
-- Nota: requiere DROP + CREATE ya que se añadió columna al RETURNS TABLE

-- Checkout config — volver a versión sin supplier_locations
DROP FUNCTION IF EXISTS public.get_supplier_checkout_config(uuid[]);
-- (restaurar versión anterior desde git)

-- Datos demo
DELETE FROM public.trade_marketplace_promotions    WHERE synthetic = true AND synthetic_dataset = 'RC1_C5A2_DEMO';
DELETE FROM public.trade_marketplace_location_inventory WHERE synthetic = true AND synthetic_dataset = 'RC1_C5A2_DEMO';
DELETE FROM public.trade_marketplace_supplier_locations WHERE synthetic = true AND synthetic_dataset = 'RC1_C5A2_DEMO';

-- Funciones
DROP FUNCTION IF EXISTS public.get_local_stock(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_locations_for_actor(uuid, boolean, numeric, numeric);
DROP FUNCTION IF EXISTS public.resolve_effective_offering_price(uuid, uuid, uuid, text, int);
DROP FUNCTION IF EXISTS public.haversine_km(numeric, numeric, numeric, numeric);

-- Tablas (en orden por FK)
DROP TABLE IF EXISTS public.trade_marketplace_promotions;
DROP TABLE IF EXISTS public.trade_marketplace_location_inventory;
DROP TABLE IF EXISTS public.trade_marketplace_supplier_locations;
DROP TYPE IF EXISTS public.promo_scope;
DROP TYPE IF EXISTS public.promo_tipo;
DROP TYPE IF EXISTS public.stock_local_status;
DROP TYPE IF EXISTS public.location_tipo;

-- Deshacer deprecación de pickup_points
ALTER TABLE public.trade_marketplace_supplier_pickup_points DROP COLUMN IF EXISTS deprecated_at;
```

---

## 8. Estado final de BD

```
trade_marketplace_supplier_locations:  17 filas (synthetic=true)
trade_marketplace_location_inventory:  26 filas (synthetic=true)
trade_marketplace_promotions:          12 filas (synthetic=true)
trade_marketplace_supplier_pickup_points: 0 filas (deprecated_at IS NOT NULL)
haversine_km:                          activa
resolve_effective_offering_price:      activa (RC1-C.5A.2-v1)
get_locations_for_actor:               activa
get_local_stock:                       activa
get_supplier_checkout_config:          actualizada (supplier_locations incluido)
```

---

## 9. Pendiente RC1-C.5B (requiere aprobación separada)

- Integración de `supplier_locations` en el comparador de offerings (mostrar tiendas con stock junto al precio)
- Integración de `resolve_effective_offering_price` RC1-C.5A.2 en `ScreenMarketplace`
- Portal Proveedor — gestión de locations e inventario local
- Datos demo: badges, profiles, reviews, featured offerings
