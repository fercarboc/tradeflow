# RC1-C.6.4 — Ficha Operativa de Pedido (Portal Proveedor)

**Estado:** Completado — 2026-08-11  
**Componente:** `src/components/portal/PortalPedidoSlideOver.tsx`  
**RPC principal:** `get_order_full_detail` (Supabase, proyecto dqqjaujnulutinskmqsu)

---

## Cambios realizados

### Reescritura completa del SlideOver

Se eliminó la estructura de 5 pestañas (Resumen / Envío / Pago / Seguimiento / Exportar) y se reemplazó por una **vista única scrollable** dividida en secciones semánticas:

| Sección | Fuente de datos | Notas |
|---|---|---|
| Header | `order.numero`, `order.estado`, `order.total`, `order.created_at` | Fijo en la parte superior |
| Acciones | Estado del pedido + permisos `canManage`/`canFulfill` | Inline forms para envío, cancelación, incidencia |
| CLIENTE | `order.buyer_snapshot` (snapshot histórico) | Fallback a `order.org_nombre` si no hay snapshot |
| ORIGEN | `order.source_type`, `order.source_ref`, `order.quote_descripcion` | "PRE-XXXX" o "Compra directa Marketplace" |
| PRODUCTOS | `detail.items[]` | Tabla con ref/desc/cant/unidad/precio_u/total |
| ENTREGA | `delivery_method`, `pickup_location_snapshot`, `direccion_entrega` | Badge + datos estructurados; fallback legacy text |
| PAGO | `payment_method` | Sin estados bancarios falsos |
| SEGUIMIENTO | Timestamps reales + `detail.events[]` | Timeline visual + historial colapsable |
| Exportar | — | CSV (BOM UTF-8) + Print |

### Layout desktop / móvil

- Desktop (≥640px): CLIENTE y ORIGEN en grid 2 columnas; ENTREGA y PAGO en grid 2 columnas
- Móvil: todo en columna única
- SlideOver fijo: 660px en sm, 740px en xl

---

## Migraciones aplicadas (sesiones previas RC1-C.6.3)

### `portal_delivery_pickup_fields`
```sql
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN pickup_location_id   uuid REFERENCES public.trade_marketplace_supplier_locations(id),
  ADD COLUMN pickup_location_snapshot jsonb;
```
`checkout_cart_v2` actualizada para persistir estos campos al hacer checkout.

### `order_detail_buyer_and_source`
Actualización de `get_order_full_detail` para incluir:
- `buyer_snapshot` — desde `trade_marketplace_orders.buyer_snapshot`
- `source_ref` — desde `trade_marketplace_carts.source_ref` (JOIN por `cart_id_v2`)
- `source_type` — desde `trade_marketplace_carts.source_type`
- `quote_descripcion` — desde `trade_quotes.descripcion` (JOIN por `quote_id`)

---

## Integridad de datos históricos

| Campo | Estrategia | Órdenes afectadas |
|---|---|---|
| `buyer_snapshot` | Snapshot en checkout — no cambia | MKT-000001..005: null (pre-migración) |
| `pickup_location_snapshot` | Snapshot en checkout — no cambia | MKT-000001..005: null (pre-migración) |
| `quote_descripcion` | JOIN live a `trade_quotes` | Aceptable como informativo |
| `direccion_entrega` | jsonb estructurado en checkout | Órdenes anteriores: texto plano en `delivery_address` |

El componente maneja todos los casos null con fallbacks apropiados.

---

## Multiproveedor

Cada proveedor ve únicamente sus propias líneas de pedido gracias a:
1. RLS en `trade_marketplace_orders` (filtra por `actor_id`)
2. `get_order_full_detail(p_actor_id, p_order_id)` valida que el pedido pertenece al actor
3. El componente recibe el `actorId` del contexto del portal y lo pasa al RPC

---

## Casos de origen validados

| Caso | `source_type` | `source_ref` | Muestra |
|---|---|---|---|
| Desde presupuesto | `"quote"` | `"PRE-2026-092"` | Número de presupuesto + descripción obra |
| Compra directa | `"free"` | `null` | Badge "Compra directa Marketplace" |
| Legacy (pre-RC1) | `null` | `null` | Sección vacía (no errora) |

---

## Tests manuales T1–T10

| Test | Descripción | Resultado esperado |
|---|---|---|
| T1 | Abrir pedido con origen presupuesto PRE-XXXX | Sección Origen muestra número y descripción |
| T2 | Abrir pedido con origen compra directa (free) | Badge "Compra directa Marketplace" |
| T3 | Pedido con buyer_snapshot completo | Sección Cliente muestra empresa, NIF, teléfono, email |
| T4 | Pedido con buyer_snapshot=null | Sección Cliente muestra org_nombre |
| T5 | Pedido con delivery_method=recogida_proveedor | Badge ámbar + datos de tienda de pickup_location_snapshot |
| T6 | Pedido con delivery_method=entrega_obra + direccion_entrega jsonb | Badge teal + destinatario + dirección + teléfono |
| T7 | Pedido pre-migración (delivery_address texto plano) | Fallback: muestra texto plano |
| T8 | Timeline con pedido cancelled | Barra roja con motivo de cancelación |
| T9 | Exportar CSV — abrir en Excel | BOM UTF-8, columnas separadas por ; |
| T10 | Proveedor B no puede ver pedido de proveedor A | RPC devuelve error / null (RLS) |

---

## Componentes internos (todos al nivel del módulo, nunca anidados)

`OrderHeader`, `OrderContent`, `SectionCliente`, `SectionOrigen`, `SectionProductos`, `SectionEntrega`, `SectionPago`, `SectionSeguimiento`, `CardSection`, `InfoCell`, `ActionBtn`, `InlineForm`, `FormField`, `OrderItemRow`, `DocButton`, `EventItem`, `DetailSkeleton`

Cumple la regla de no definir sub-componentes dentro del padre para evitar re-mounts y pérdida de foco.
