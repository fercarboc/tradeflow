# PILOT_ANALYTICS — Dashboards y consultas del Pilot Zero

**Versión:** 1.0 — Julio 2026  
**Propósito:** Consultas SQL y procedimientos de observación para medir el Pilot Zero desde Supabase y Vercel.  
**Audiencia:** Equipo técnico que ejecuta y analiza los ciclos PZ-001 a PZ-025.

---

## IDs del piloto (referencia rápida)

```
org_instaladora:    1047165e-f6ce-4b5a-9141-0d76be0a4a5a
actor_marketplace:  85e73234-c74e-44e7-865a-1aca8312f9a5
catalog_legacy:     280c05e5-7590-4ca1-82d0-fc8977a919d8
email_instalador:   legal@inmostay.com
email_proveedor:    contacto@inmostay.com  (pendiente creación)
```

---

## 1. Estado global del piloto

Ejecutar al inicio de cada sesión de piloto para verificar integridad del entorno.

```sql
-- Resumen de estado: pedidos por estado
SELECT
  estado,
  COUNT(*) AS total,
  MIN(created_at) AS primer_pedido,
  MAX(created_at) AS ultimo_pedido
FROM trade_marketplace_orders
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY estado
ORDER BY
  CASE estado
    WHEN 'pending'    THEN 1
    WHEN 'confirmed'  THEN 2
    WHEN 'preparing'  THEN 3
    WHEN 'shipped'    THEN 4
    WHEN 'delivered'  THEN 5
    WHEN 'cancelled'  THEN 6
    ELSE 7
  END;
```

---

## 2. Resumen por ciclo

```sql
-- Cada ciclo es un pedido del piloto (usar cycle_id en metadata o correlato con fecha)
SELECT
  o.id                                    AS order_id,
  o.estado,
  o.total,
  o.created_at,
  COUNT(oi.id)                            AS num_lineas,
  json_agg(json_build_object(
    'event', e.event_type,
    'at',    e.created_at
  ) ORDER BY e.created_at)                AS timeline
FROM trade_marketplace_orders o
LEFT JOIN trade_marketplace_order_items  oi ON oi.order_id = o.id
LEFT JOIN trade_marketplace_order_events e  ON e.order_id  = o.id
WHERE o.actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY o.id, o.estado, o.total, o.created_at
ORDER BY o.created_at;
```

---

## 3. Métricas de tiempo (PRV-01 a PRV-04)

```sql
-- Tiempos por pedido entre transiciones de estado
SELECT
  o.id                                         AS order_id,
  o.created_at                                 AS t_creado,
  MIN(e_c.created_at)                          AS t_confirmado,
  MIN(e_p.created_at)                          AS t_preparando,
  MIN(e_s.created_at)                          AS t_enviado,
  MIN(e_d.created_at)                          AS t_entregado,
  EXTRACT(EPOCH FROM (MIN(e_c.created_at) - o.created_at))        AS seg_pendiente_a_confirmado,
  EXTRACT(EPOCH FROM (MIN(e_p.created_at) - MIN(e_c.created_at))) AS seg_confirmado_a_preparando,
  EXTRACT(EPOCH FROM (MIN(e_s.created_at) - MIN(e_p.created_at))) AS seg_preparando_a_enviado,
  EXTRACT(EPOCH FROM (MIN(e_s.created_at) - o.created_at))        AS seg_total_hasta_enviado
FROM trade_marketplace_orders o
LEFT JOIN trade_marketplace_order_events e_c ON e_c.order_id = o.id AND e_c.event_type = 'confirmed'
LEFT JOIN trade_marketplace_order_events e_p ON e_p.order_id = o.id AND e_p.event_type = 'preparing'
LEFT JOIN trade_marketplace_order_events e_s ON e_s.order_id = o.id AND e_s.event_type = 'shipped'
LEFT JOIN trade_marketplace_order_events e_d ON e_d.order_id = o.id AND e_d.event_type = 'delivered'
WHERE o.actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY o.id, o.created_at
ORDER BY o.created_at;
```

---

## 4. Pedidos sin respuesta del proveedor (PRV-06)

```sql
-- Pedidos en 'pending' hace más de 24 horas — alerta de SLA
SELECT
  id,
  created_at,
  total,
  EXTRACT(EPOCH FROM (now() - created_at)) / 3600 AS horas_sin_respuesta
FROM trade_marketplace_orders
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
  AND estado = 'pending'
  AND created_at < now() - interval '24 hours';
```

---

## 5. Estado del catálogo de offerings (MKT-08 / MKT-09)

```sql
-- Distribución por match_state y stock
SELECT
  match_state,
  stock_disponible,
  COUNT(*) AS total
FROM trade_marketplace_supplier_offerings
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY match_state, stock_disponible
ORDER BY match_state, stock_disponible;
```

```sql
-- % vinculados a UP (matched) vs total
SELECT
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE match_state = 'matched')
    / NULLIF(COUNT(*), 0),
    1
  ) AS pct_matched,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE NOT stock_disponible)
    / NULLIF(COUNT(*), 0),
    1
  ) AS pct_sin_stock,
  COUNT(*) AS total_offerings
FROM trade_marketplace_supplier_offerings
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5';
```

---

## 6. Outbox: eventos pendientes y fallos (MKT-10 / MKT-11)

```sql
-- Eventos sin procesar
SELECT
  id,
  event_type,
  created_at,
  retry_count,
  EXTRACT(EPOCH FROM (now() - created_at)) / 60 AS minutos_pendiente
FROM trade_marketplace_outbox
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
  AND processed_at IS NULL
ORDER BY created_at;
```

```sql
-- Total de eventos del piloto
SELECT
  event_type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) AS procesados,
  COUNT(*) FILTER (WHERE processed_at IS NULL)     AS pendientes,
  AVG(retry_count)                                 AS reintentos_prom
FROM trade_marketplace_outbox
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY event_type;
```

---

## 7. Datos del instalador (INS-02 / INS-05)

```sql
-- Carritos creados por legal@inmostay.com con relación a presupuesto
SELECT
  c.id          AS cart_id,
  c.created_at  AS cart_created,
  c.status,
  COUNT(ci.id)  AS num_items,
  SUM(ci.quantity * ci.unit_price) AS total_carrito
FROM trade_marketplace_carts c
JOIN trade_marketplace_cart_items ci ON ci.cart_id = c.id
WHERE c.org_id = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a'
GROUP BY c.id, c.created_at, c.status
ORDER BY c.created_at;
```

```sql
-- Items del carrito con el actor seleccionado
SELECT
  ci.id,
  ci.offering_id,
  ci.quantity,
  ci.unit_price,
  ci.selected_actor_id,
  a.nombre AS actor_nombre,
  ci.ia_añadido
FROM trade_marketplace_cart_items ci
JOIN trade_marketplace_carts c ON c.id = ci.cart_id
LEFT JOIN trade_marketplace_actors a ON a.id = ci.selected_actor_id
WHERE c.org_id = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a'
ORDER BY ci.created_at;
```

---

## 8. Motor IA — presupuestos generados (IA-02 / IA-04)

```sql
-- Presupuestos de la org instaladora en el piloto
SELECT
  q.id,
  q.created_at,
  q.estado,
  COUNT(qi.id) AS num_materiales
FROM trade_quotes q
LEFT JOIN trade_quote_items qi ON qi.quote_id = q.id
WHERE q.org_id = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a'
GROUP BY q.id, q.created_at, q.estado
ORDER BY q.created_at;
```

```sql
-- Items del carrito generados por IA
SELECT
  COUNT(*) FILTER (WHERE ia_añadido = true)  AS ia_sugeridos,
  COUNT(*) FILTER (WHERE ia_añadido = false) AS manuales,
  COUNT(*)                                   AS total
FROM trade_marketplace_cart_items ci
JOIN trade_marketplace_carts c ON c.id = ci.cart_id
WHERE c.org_id = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a';
```

---

## 9. Pedidos completados vs objetivo (MKT-02 / MKT-03)

```sql
-- Resumen ejecutivo del piloto para informe de fase
SELECT
  COUNT(*)                                        AS total_pedidos,
  COUNT(*) FILTER (WHERE estado = 'delivered')    AS completados,
  COUNT(*) FILTER (WHERE estado = 'cancelled')    AS cancelados,
  COUNT(*) FILTER (WHERE estado = 'pending')      AS pendientes,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE estado = 'delivered')
    / NULLIF(COUNT(*), 0),
    1
  )                                               AS pct_completados,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE estado = 'cancelled')
    / NULLIF(COUNT(*), 0),
    1
  )                                               AS pct_cancelados,
  SUM(total)                                      AS gmv_piloto
FROM trade_marketplace_orders
WHERE actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5';
```

---

## 10. Verificación de membresía del proveedor

```sql
-- Estado de contacto@inmostay.com como miembro del actor
SELECT
  u.email,
  m.activo,
  m.accepted_at,
  r.name AS role_name
FROM trade_marketplace_actor_members m
JOIN auth.users u ON u.id = m.user_id
JOIN trade_marketplace_member_roles r ON r.id = m.role_id
WHERE m.actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5';
```

---

## 11. Verificación de integridad (ejecutar antes de cada ciclo)

```sql
-- Confirmar que el actor está activo y bien configurado
SELECT
  a.id,
  a.nombre,
  a.actor_type,
  a.estado,
  a.supplier_catalog_id,
  sc.supplier_name AS catalog_nombre,
  COUNT(o.id)      AS pedidos_totales
FROM trade_marketplace_actors a
LEFT JOIN trade_supplier_catalogs sc ON sc.id = a.supplier_catalog_id
LEFT JOIN trade_marketplace_orders o ON o.actor_id = a.id
WHERE a.id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY a.id, a.nombre, a.actor_type, a.estado, a.supplier_catalog_id, sc.supplier_name;
```

```sql
-- Confirmar que la org tiene el catálogo habilitado
SELECT
  tos.org_id,
  tos.supplier_catalog_id,
  tos.enabled,
  sc.supplier_name
FROM trade_org_suppliers tos
JOIN trade_supplier_catalogs sc ON sc.id = tos.supplier_catalog_id
WHERE tos.org_id = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a'
  AND tos.supplier_catalog_id = '280c05e5-7590-4ca1-82d0-fc8977a919d8';
```

---

## 12. Procedimiento de observación manual (métricas ❌)

Para las métricas sin cobertura automática, registrar en el Runbook (`PILOT_ZERO_RUNBOOK.md`) al final de cada ciclo:

| Campo a anotar | Cuándo medir | Herramienta |
|---|---|---|
| IA-01 Tiempo voice-to-quote | Desde "Grabar" hasta presupuesto visible | Cronómetro manual o DevTools Network |
| IA-03 Materiales corregidos | Contar líneas editadas antes de guardar | Observación |
| INS-01 Tiempo hasta guardar presupuesto | Apertura wizard → guardar | Cronómetro |
| INS-03 Número de clics hasta pedido | Desde "Comprar material" → confirmación | Contador manual |
| INS-04 Cambios de proveedor | Cambios en StepComparar | Observación |
| MKT-05 Estrategia auto-select | Opción elegida en autoSelectProviders | Anotar del UI |
| PRV-05 Acciones para gestionar pedido | Login proveedor → confirmar | Contador manual |
| CAL-04 Errores Realtime | Canal desconectado o evento perdido | Consola navegador |
| ERP-04 Continuidad del flujo | Sin error hasta factura | Observación |

---

## 13. Logs de Edge Functions y Base de Datos

Acceder en Supabase Dashboard:

- **Edge Functions → Logs:** `trade-voice-to-quote`, `marketplace-outbox-consumer`
- **Database → Logs:** errores SQL, RPC failures, constraint violations
- **API → Logs:** errores 400/500 en las RPCs del Marketplace

Filtro relevante para el piloto:
```
actor_id: 85e73234-c74e-44e7-865a-1aca8312f9a5
org_id:   1047165e-f6ce-4b5a-9141-0d76be0a4a5a
```

---

## 14. Verificación de seguridad (aislamiento de datos)

```sql
-- Confirmar que los pedidos del piloto no mezclan orgs externas
SELECT DISTINCT
  o.org_id,
  o.actor_id,
  COUNT(*) AS pedidos
FROM trade_marketplace_orders o
WHERE o.actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
   OR o.org_id   = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a'
GROUP BY o.org_id, o.actor_id;
```

Si aparece cualquier `org_id` o `actor_id` diferente a los del piloto, detener y revisar RLS.

---

## 15. Exportar resumen del piloto (post-fase)

```sql
-- Exportar como CSV desde Supabase: Resultados ejecutivos
SELECT
  o.id                                                                 AS order_id,
  o.estado,
  o.total,
  o.created_at,
  MIN(e_c.created_at)                                                  AS confirmado_at,
  MIN(e_s.created_at)                                                  AS enviado_at,
  MIN(e_d.created_at)                                                  AS entregado_at,
  EXTRACT(EPOCH FROM (MIN(e_c.created_at) - o.created_at))            AS seg_confirmacion,
  EXTRACT(EPOCH FROM (MIN(e_s.created_at) - o.created_at))            AS seg_hasta_envio,
  COUNT(oi.id)                                                         AS num_lineas
FROM trade_marketplace_orders o
LEFT JOIN trade_marketplace_order_events e_c ON e_c.order_id = o.id AND e_c.event_type = 'confirmed'
LEFT JOIN trade_marketplace_order_events e_s ON e_s.order_id = o.id AND e_s.event_type = 'shipped'
LEFT JOIN trade_marketplace_order_events e_d ON e_d.order_id = o.id AND e_d.event_type = 'delivered'
LEFT JOIN trade_marketplace_order_items  oi  ON oi.order_id  = o.id
WHERE o.actor_id = '85e73234-c74e-44e7-865a-1aca8312f9a5'
GROUP BY o.id, o.estado, o.total, o.created_at
ORDER BY o.created_at;
```
