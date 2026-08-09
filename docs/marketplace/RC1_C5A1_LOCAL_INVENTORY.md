# RC1-C.5A.1 — Modelo de stock local por tienda

**Versión:** 1.0  
**Fecha:** 2026-08-09  
**Estado:** DISEÑO — pendiente aprobación  
**Dependencia:** RC1_C5A1_SUPPLIER_LOCATIONS.md

---

## 1. Principio de diseño

El stock local es un **override**, no una réplica.

```
Resolución de stock en checkout:
  1. ¿Existe entrada en trade_marketplace_location_inventory para esta location + offering?
       SÍ → usar stock_status / stock_quantity local
       NO → usar stock_disponible / stock_cantidad de la offering (stock nacional)
```

No se replican todas las offerings por tienda. Solo se registran las excepciones: una tienda con stock explícito, o una tienda que ha agotado un producto.

---

## 2. Modelo de datos

### 2.1 `trade_marketplace_location_inventory` (nueva tabla)

```sql
CREATE TYPE stock_local_status AS ENUM (
  'disponible',        -- hay stock hoy
  'disponible_hoy',    -- stock garantizado para recogida hoy (misma jornada)
  'bajo_pedido',       -- disponible en N días tras pedido
  'sin_stock',         -- agotado en esta tienda
  'discontinuado'      -- retirado del catálogo de esta location
);

CREATE TABLE public.trade_marketplace_location_inventory (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id      uuid NOT NULL REFERENCES public.trade_marketplace_supplier_locations(id) ON DELETE CASCADE,
  offering_id      uuid NOT NULL REFERENCES public.trade_marketplace_supplier_offerings(id) ON DELETE CASCADE,

  -- Stock
  stock_status     public.stock_local_status NOT NULL DEFAULT 'disponible',
  stock_cantidad   int,                    -- NULL = desconocido; 0 = sin stock
  reservado        int NOT NULL DEFAULT 0, -- cantidad reservada por pedidos no completados
  plazo_local_dias int,                    -- solo para bajo_pedido: días en esta tienda

  -- Precio local (excepción)
  -- Si NULL: se usa el precio de la offering (precio nacional)
  precio_local_profesional numeric(10,2),
  precio_local_publico     numeric(10,2),
  precio_source            text,           -- 'professional_pvd' | 'local_promotion' | 'local_clearance'

  -- Auditoría
  updated_at       timestamptz DEFAULT now(),
  updated_by       text,                   -- 'manual' | 'import' | 'api' | 'sync'
  source           text,                   -- origen del dato de stock

  -- Demo flag
  synthetic        bool NOT NULL DEFAULT false,
  synthetic_dataset text,

  UNIQUE (location_id, offering_id)
);

CREATE INDEX ON public.trade_marketplace_location_inventory (location_id, stock_status);
CREATE INDEX ON public.trade_marketplace_location_inventory (offering_id);
```

### 2.2 Vista de resolución de stock (para checkout y comparador)

```sql
CREATE OR REPLACE VIEW public.v_offering_location_stock AS
SELECT
  o.id                        AS offering_id,
  o.supplier_catalog_id,
  o.descripcion_comercial,
  o.precio_profesional_neto   AS precio_profesional_nacional,
  o.precio_publico_neto       AS precio_publico_nacional,
  o.stock_disponible          AS stock_nacional,
  o.plazo_entrega_dias        AS plazo_nacional_dias,
  l.id                        AS location_id,
  l.actor_id,
  l.nombre                    AS location_nombre,
  l.localidad,
  l.provincia,
  l.latitud,
  l.longitud,
  l.permite_recogida,
  l.permite_entrega_local,
  l.radio_servicio_km,
  -- Stock resuelto (local override o nacional)
  COALESCE(inv.stock_status, CASE WHEN o.stock_disponible THEN 'disponible' ELSE 'sin_stock' END)
                              AS stock_status_resuelto,
  COALESCE(inv.stock_cantidad, o.stock_cantidad) AS stock_cantidad_resuelto,
  -- Precio resuelto (local override o nacional)
  COALESCE(inv.precio_local_profesional, o.precio_profesional_neto) AS precio_profesional_resuelto,
  COALESCE(inv.precio_local_publico, o.precio_publico_neto)         AS precio_publico_resuelto,
  COALESCE(inv.precio_source, 'professional_pvd') AS precio_source,
  -- ¿Tiene promoción local?
  (inv.precio_local_profesional IS NOT NULL AND inv.precio_local_profesional < o.precio_profesional_neto)
                              AS tiene_precio_local_inferior
FROM public.trade_marketplace_supplier_offerings o
JOIN public.trade_marketplace_supplier_locations l ON l.actor_id = (
  SELECT actor_id FROM public.trade_marketplace_actors
  WHERE supplier_catalog_id = o.supplier_catalog_id LIMIT 1
)
LEFT JOIN public.trade_marketplace_location_inventory inv
  ON inv.location_id = l.id AND inv.offering_id = o.id
WHERE o.activa = true AND l.activa = true;
```

---

## 3. Lógica de resolución en checkout

```typescript
// Pseudocódigo frontend
async function resolveStockForCheckout(offeringId: string, locationId: string | null) {
  if (locationId) {
    // Prioridad 1: stock local de la location seleccionada
    const local = await getLocationInventory(offeringId, locationId);
    if (local) return {
      status:    local.stock_status,
      cantidad:  local.stock_cantidad,
      precio:    local.precio_local_profesional ?? offering.precio_profesional_neto,
      source:    local.precio_source ?? 'professional_pvd',
    };
  }
  // Fallback: stock nacional de la offering
  return {
    status:   offering.stock_disponible ? 'disponible' : 'sin_stock',
    cantidad: offering.stock_cantidad,
    precio:   offering.precio_profesional_neto,
    source:   'professional_pvd',
  };
}
```

---

## 4. Señales visuales en UI

| stock_status_resuelto | Badge | Color |
|----------------------|-------|-------|
| disponible_hoy | ✅ Disponible hoy para recoger | verde |
| disponible | 📦 En stock | verde claro |
| bajo_pedido | 🕐 Disponible en N días | ámbar |
| sin_stock | ❌ Sin stock en esta tienda | rojo |
| discontinuado | — (ocultar de lista) | — |

**Señal de precio local inferior:**
```
🏷 Precio especial en Torrelavega
32,90 € (nacional: 36,50 €)
```

---

## 5. Dataset demo de inventario

Para los 16 locations demo, crear ~20-25 entradas de inventario específicas (el resto resuelve por fallback nacional).

**Ejemplos representativos:**

```sql
-- ObrasMat Santander: stock explícito de varios productos
-- Válvula esfera latón 1/2" — stock local conocido
(location_id: obramat-santander, offering: válvula-esfera, status: disponible_hoy, cantidad: 48)

-- ObrasMat Torrelavega: liquidación de un producto
-- Plato ducha resina 80×80 — clearance
(location_id: obramat-torrelavega, offering: plato-ducha-resina, status: disponible, cantidad: 3, precio_local: 89.90)

-- FSQ Santander: stock hoy de grifería
(location_id: fsq-santander, offering: grifo-monomando-lavabo, status: disponible_hoy, cantidad: 12)

-- EDC Maliaño: gran stock de cables (almacén distribución)
(location_id: edc-maliayo, offering: cable-1.5mm2, status: disponible, cantidad: 500)

-- STN Santander: calentador bajo pedido (2 días)
(location_id: stn-santander, offering: calentador-11l, status: bajo_pedido, plazo: 2)
```

Total: ~25 entradas demo, `synthetic = true`, `synthetic_dataset = 'RC1_C5A1_DEMO'`.

---

## 6. Integración en comparador de precios

```
UP: Grifo monomando lavabo

┌──────────────────────────────────────────────┐
│ FSQ   36,50 €  ✅ Stock en Santander hoy      │  ← precio nacional + stock local
│ STN   42,80 €  📦 Stock disponible            │  ← precio nacional + stock nacional
│ STN-c 44,90 €  🕐 Bajo pedido (3 días)        │
└──────────────────────────────────────────────┘

📍 Basado en tu obra en Santander
```

El comparador ordena siempre por `precio_profesional_resuelto ASC`. El stock local es **información**, no factor de ranking.

---

## 7. Riesgos

| Riesgo | Prob | Mitigación |
|--------|------|-----------|
| Stock local desactualizado → comprador llega y no hay | Media | Marcar como demo claramente; en producción, el proveedor actualiza vía API o Portal |
| `UNIQUE (location_id, offering_id)` impide múltiples entradas | N/A | Correcto — solo una entrada por par, que se actualiza |
| Vista `v_offering_location_stock` lenta con muchos actores | Baja | Índices en location_id + offering_id; limitar en query por actor |
| `reservado` no actualizado si pedido se cancela | Media | Trigger en `trade_marketplace_orders` para decrementar al cancelar |

## 8. Rollback

```sql
DROP VIEW IF EXISTS public.v_offering_location_stock;
DROP TABLE IF EXISTS public.trade_marketplace_location_inventory;
DROP TYPE IF EXISTS public.stock_local_status;
```
