# PILOT_ZERO_METRICS — Definición de métricas

**Versión:** 1.0 — Julio 2026  
**Propósito:** Definir exactamente qué se mide en el Pilot Zero, cómo y desde qué fuente.  
**Nota:** Estas métricas son de validación interna. No se mezclan con métricas comerciales (MRR, GMV real, retención de clientes de pago).

---

## Leyenda de disponibilidad

| Símbolo | Significado |
|---|---|
| ✅ Ya disponible | Dato existe en BD y se puede consultar ahora |
| 🔧 Calculable | Dato derivable de tablas existentes (requiere query) |
| ❌ No existe | Campo o evento no registrado en el sistema actual |

---

## Bloque 1 — Motor IA

| Métrica | Descripción | Unidad | Fórmula / fuente | Disponibilidad |
|---|---|---|---|---|
| **IA-01** Tiempo de respuesta | Tiempo entre inicio de grabación y presupuesto generado | segundos | Medir en cliente (performance.now) | ❌ No existe en BD — medir manualmente |
| **IA-02** Materiales detectados | Número de líneas de material generadas por el motor | count | `COUNT(quote_items) WHERE quote_id = X` | ✅ `trade_quote_items` |
| **IA-03** Materiales corregidos | Líneas modificadas manualmente tras la IA | count | ❌ Sin campo `was_modified_by_user` | ❌ Anotar manualmente por ciclo |
| **IA-04** Sugerencias aceptadas | Sugerencias del Motor IA aceptadas en el carrito | count | `COUNT(cart_items) WHERE ia_añadido = true` | ✅ `trade_marketplace_cart_items.ia_añadido` |
| **IA-05** Errores del motor | Fallos en la Edge Function `trade-voice-to-quote` | count | Logs Supabase Edge Functions | ✅ Logs disponibles |
| **IA-06** Versión del motor | Versión activa en producción | string | `SELECT version FROM trade_ai_versions WHERE is_production = true` | ✅ `trade_ai_versions` |

---

## Bloque 2 — Instalador (flujo ERP → carrito)

| Métrica | Descripción | Unidad | Fórmula / fuente | Disponibilidad |
|---|---|---|---|---|
| **INS-01** Tiempo presupuesto IA | Desde apertura del wizard hasta presupuesto guardado | segundos | Medir manualmente por ciclo | ❌ No registrado en BD |
| **INS-02** Tiempo aceptación → pedido | Desde `accepted_at` del presupuesto hasta `created_at` del carrito | segundos | `cart.created_at - quote.accepted_at` | 🔧 `trade_marketplace_carts + trade_quotes` |
| **INS-03** Número de acciones para comprar | Clics desde "Comprar material" hasta `checkout_cart` | count | Medir manualmente por ciclo | ❌ No existe en BD |
| **INS-04** Cambios manuales de proveedor | Veces que el instalador cambia el proveedor seleccionado | count | Medir manualmente por ciclo (observe StepComparar) | ❌ No registrado |
| **INS-05** Materiales añadidos/eliminados | Cambios en el carrito respecto a los items del presupuesto | count | `COUNT(cart_items) - COUNT(quote_items)` | 🔧 Calculable por ciclo |
| **INS-06** Errores durante checkout | Excepciones devueltas por `checkout_cart` | count | Log Supabase Edge Functions + error_logger | ✅ `trade_client_errors` si se activa |

---

## Bloque 3 — Proveedor (flujo Portal)

| Métrica | Descripción | Unidad | Fórmula / fuente | Disponibilidad |
|---|---|---|---|---|
| **PRV-01** Tiempo pedido recibido → confirmado | `confirmed_at - created_at` del pedido | segundos | `trade_marketplace_order_events WHERE event_type = 'confirmed'` | ✅ `trade_marketplace_order_events` |
| **PRV-02** Tiempo confirmado → preparación | `prepared_at - confirmed_at` | segundos | `order_events WHERE type IN ('confirmed','preparing')` | ✅ `trade_marketplace_order_events` |
| **PRV-03** Tiempo preparación → envío | `shipped_at - prepared_at` | segundos | `order_events` | ✅ `trade_marketplace_order_events` |
| **PRV-04** Tiempo total pedido → enviado | `shipped_at - created_at` | segundos | `order_events` | ✅ `trade_marketplace_order_events` |
| **PRV-05** Número de acciones para gestionar | Clics desde login hasta pedido confirmado | count | Medir manualmente por ciclo | ❌ No registrado |
| **PRV-06** Pedidos sin respuesta | Pedidos en `pending` tras 24h sin acción del proveedor | count | `WHERE estado='pending' AND created_at < now()-interval '24h'` | ✅ Calculable desde `trade_marketplace_orders` |
| **PRV-07** Pedidos cancelados | Pedidos que llegan a `cancelled` | count | `COUNT(*) WHERE estado = 'cancelled'` | ✅ `trade_marketplace_orders` |

---

## Bloque 4 — Marketplace (pedidos y flujo)

| Métrica | Descripción | Unidad | Fórmula / fuente | Disponibilidad |
|---|---|---|---|---|
| **MKT-01** Pedidos creados | Total de pedidos generados en el piloto | count | `COUNT(*) FROM trade_marketplace_orders WHERE actor_id = '85e73234...'` | ✅ |
| **MKT-02** Pedidos completados | Pedidos que alcanzan `delivered` | count | `COUNT(*) WHERE estado = 'delivered'` | ✅ |
| **MKT-03** Tasa de cancelación | Pedidos cancelados / pedidos creados | % | `cancelled / created * 100` | 🔧 |
| **MKT-04** Proveedor elegido | Actor seleccionado en cada ciclo | nombre | `trade_marketplace_actors.nombre` | ✅ |
| **MKT-05** Estrategia auto-select | Estrategia usada en `autoSelectProviders` | string | Anotar manualmente (balance/precio/velocidad/consolidar) | ❌ No persiste en BD |
| **MKT-06** Importe total pedido | Suma de líneas del pedido | € | `trade_marketplace_orders.total` | ✅ |
| **MKT-07** Número de líneas | Artículos por pedido | count | `COUNT(*) FROM trade_marketplace_order_items WHERE order_id = X` | ✅ |
| **MKT-08** % productos vinculados a UP | Offerings con match_state = 'matched' | % | `matched / total * 100` | ✅ `trade_marketplace_supplier_offerings` |
| **MKT-09** % productos sin stock | Offerings con stock_disponible = false | % | `sin_stock / total * 100` | ✅ |
| **MKT-10** Eventos Outbox | Eventos enviados a la cola | count | `COUNT(*) FROM trade_marketplace_outbox WHERE actor_id = '85e73234...'` | ✅ |
| **MKT-11** Fallos Outbox / reintentos | Eventos sin procesar (sin processed_at) | count | `COUNT(*) WHERE processed_at IS NULL AND created_at < now()-interval '10m'` | ✅ |

---

## Bloque 5 — ERP (flujo post-pedido)

| Métrica | Descripción | Unidad | Fórmula / fuente | Disponibilidad |
|---|---|---|---|---|
| **ERP-01** Trabajo desbloqueado | El trabajo asociado al presupuesto se desbloquea tras recepción | booleano | Verificar UI + `trade_jobs.material_received` | 🔧 Campo verificable si existe |
| **ERP-02** Factura generada | Se emite factura tras el trabajo completado | booleano | `COUNT(*) FROM trade_invoices WHERE job_id = X` | ✅ `trade_invoices` |
| **ERP-03** Tiempo total presupuesto → recepción | Desde `quote.created_at` hasta `delivered_at` del pedido | minutos | `delivered_at - quote.created_at` | 🔧 Cross-join |
| **ERP-04** Continuidad del flujo | El instalador puede continuar desde recepción hacia factura sin errores | booleano | Observación manual por ciclo | ❌ No automatizable |

---

## Bloque 6 — Calidad técnica

| Métrica | Descripción | Unidad | Fórmula / fuente | Disponibilidad |
|---|---|---|---|---|
| **CAL-01** Errores frontend | Excepciones JS capturadas | count | `trade_client_errors WHERE org_id = '1047165e...'` | ✅ Si `logError` funciona |
| **CAL-02** Errores RPC | Excepciones en funciones SQL | count | Supabase Dashboard → Database → Logs | ✅ Logs Edge/DB |
| **CAL-03** Errores Edge Functions | Fallos en voice-to-quote, outbox-consumer | count | Supabase Dashboard → Edge Functions → Logs | ✅ |
| **CAL-04** Errores Realtime | Eventos perdidos o desconexiones del canal Realtime | count | Observación manual + consola navegador | ❌ No registrado en BD |
| **CAL-05** Latencia voice-to-quote | Tiempo de respuesta P50/P95 | segundos | Logs Edge Function + cronómetro manual | 🔧 Parcial |
| **CAL-06** Retries Outbox | Eventos del outbox con múltiples intentos | count | `trade_marketplace_outbox WHERE retry_count > 0` | ✅ Si campo existe |
| **CAL-07** Incidencias manuales | Intervenciones SQL o manuales para corregir estado | count | Registrar en RUNBOOK por ciclo | ❌ Solo en RUNBOOK |

---

## Criterios objetivo por fase

### Fase 1 (PZ-001 a PZ-003)

| Métrica | Objetivo |
|---|---|
| PRV-01 (pedido → confirmado) | < 60 segundos (piloto controlado) |
| MKT-01 (pedidos creados) | 3 |
| MKT-02 (pedidos completados) | 3 (100%) |
| MKT-03 (tasa cancelación) | 0% |
| ERP-01 (trabajo desbloqueado) | 100% |
| CAL-01 + CAL-02 (errores críticos) | 0 |

### Fase 2 (PZ-001 a PZ-025 acumulado)

| Métrica | Objetivo |
|---|---|
| MKT-02 (completados) | ≥ 23/25 (92%) |
| ERP-01 (trabajo desbloqueado) | 100% |
| INS-02 (tiempo aceptación → pedido) | < 120s habitual |
| PRV-04 (pedido → enviado) | < 48h en condiciones reales |
| CAL-07 (incidencias manuales) | ≤ 2 totales |
| MKT-11 (Outbox sin procesar) | 0 tras 10 min |
