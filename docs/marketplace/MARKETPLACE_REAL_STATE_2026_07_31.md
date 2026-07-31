# TrabFlow Marketplace — Estado Real a 2026-07-31

**Propósito:** Análisis de evidencia directa (código fuente + BD + documentación) del estado real del Marketplace.
**Método:** Lectura de archivos fuente, no estimaciones ni suposiciones.
**Fecha de corte:** 2026-07-31

---

## 1. ¿Qué es exactamente el Marketplace actual?

El Marketplace de TrabFlow **no es un marketplace navegable**. Es un **flujo de compra guiada desde presupuesto** con un portal de gestión para proveedores.

La filosofía de diseño (documentada en `TRABFLOW_MARKETPLACE_MASTER_PLAN.md §3.1`) lo dice explícitamente:

> *"No existe una pantalla de inicio del Marketplace. El punto de entrada es siempre un presupuesto aceptado."*
> *"No hay búsqueda genérica de productos."*
> *"No hay carrito permanente."*

Esto **no es un defecto técnico**: es una decisión de producto deliberada para la fase actual. La visión de Fase 3 (catálogo libre navegable) está aprobada pero pendiente de implementar.

**Definición precisa del producto actual:**

> Un sistema de compra de materiales integrado en el ERP, activado desde un presupuesto aceptado, con un portal completo para que el proveedor gestione los pedidos recibidos, sincronice su catálogo por CSV o API, y consulte sus métricas operativas.

---

## 2. Rutas activas en producción

Evidencia: `src/types.ts` (enum ActivePage) + `src/App.tsx`

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/marketplace/comprar` | `MarketplaceComprarView` | Wizard de compra (Revisar → Confirmar → Éxito) |
| `/marketplace/seguimiento` | `ScreenSeguimientoMaterial` | Seguimiento de pedidos activos e historial |
| `/proveedor` | `PortalProveedorView` | Portal completo del proveedor (tabs: dashboard, catálogo, pedidos, equipo, informes, integraciones, config) |

**No existen** estas rutas: `/marketplace`, `/marketplace/buscar`, `/marketplace/categorias`, `/marketplace/producto/:id`, `/marketplace/carrito`. No hay componentes que las implementen.

---

## 3. A. Infraestructura — Evidencia de código

### A.1 Tablas de la base de datos

| Tabla | Estado | Evidencia |
|-------|--------|-----------|
| `trade_marketplace_universal_products` | 🟢 Completo | `20260724_marketplace_universal_products.sql` |
| `trade_marketplace_categories` | 🟢 Completo | Ídem — árbol jerárquico con parent_id, slug, oficio, posicion |
| `trade_marketplace_brands` | 🟢 Completo | Ídem — nombre, slug, logo_url, activa |
| `trade_marketplace_universal_product_variants` | 🟢 Completo | Ídem — atributos, EAN, manufacturer_ref |
| `trade_marketplace_supplier_offerings` | 🟢 Completo | Ídem — precio_coste, precio_venta, stock, match_state, match_confidence, image_url |
| `trade_marketplace_actors` | 🟢 Completo | `20260724_marketplace_actor_system.sql` |
| `trade_marketplace_actor_members` | 🟢 Completo | Ídem — activo (boolean), role_id |
| `trade_marketplace_carts` | 🟢 Completo | `20260724_04_marketplace_checkout_flow.sql` — source_type: quote/job/field_action/maintenance_incident/manual |
| `trade_marketplace_cart_items` | 🟢 Completo | Ídem — universal_product_id, selected_offering_id, ia_tipo, ia_sugerencia |
| `trade_marketplace_orders` | 🟢 Completo | `20260724_05_marketplace_order_lifecycle.sql` |
| `trade_marketplace_order_items` | 🟢 Completo | Ídem — precio_total (campo generado) |
| `trade_marketplace_order_events` | 🟢 Completo | Ídem — log de eventos por pedido |
| `trade_catalog_imports` | 🟢 Completo | `20260729_catalog_import.sql` — modo: append/api |
| `trade_supplier_api_credentials` | 🟢 Completo | `20260801_01_mvp7_api_credentials.sql` |
| `trade_supplier_api_sync_log` | 🟢 Completo | Ídem |
| `trade_supplier_api_idempotency` | 🟢 Completo | Ídem |
| `trade_supplier_api_rate_limits` | 🟢 Completo | Ídem |
| Outbox pattern (catalog.import_completed) | 🟢 Completo | Trigger en api_sync_catalog_offerings |
| Stripe Connect (split de comisión) | 🔴 No implementado | Solo mencionado en objetivos del Master Plan |

### A.2 Funciones RPC relevantes

| Función | Estado | Qué hace |
|---------|--------|----------|
| `search_marketplace_offerings` | 🟢 Existe | Búsqueda fuzzy por texto (pg_trgm). Solo se usa internamente para el carrito. |
| `load_marketplace_categories` (cliente) | 🟢 Existe | Devuelve categorías. No se usa en ninguna vista de comprador. |
| `load_universal_product` (cliente) | 🟢 Existe | Detalle de producto universal. No hay vista de comprador que la consuma. |
| `get_cart_detail` | 🟢 Existe | Carga el carrito del comprador con ítems y alternativas. |
| `checkout_cart` | 🟢 Existe | Convierte carrito en pedidos. |
| `auto_select_providers` | 🟢 Existe | Estrategia automática: balance/precio/velocidad/consolidar. |
| `analyze_cart_with_ai` | 🟢 Existe | Análisis IA del carrito. |
| `get_org_active_orders` | 🟢 Existe | Pedidos activos del instalador. |
| `get_org_order_history` | 🟢 Existe | Historial paginado del instalador. |
| `deliver_marketplace_order` | 🟢 Existe | El instalador marca como recibido. |
| `cancel_marketplace_order` | 🟢 Existe | El instalador cancela (estados pending/confirmed/preparing). |
| `api_sync_catalog_offerings` | 🟢 Existe | Sync API proveedor → catálogo (modo api). |
| `api_sync_stock` / `api_sync_prices` | 🟢 Existe | Sync stock y precios vía API. |
| Motor IA de matching automático | 🔴 No implementado | La columna match_state existe. El outbox dispara eventos. El motor que lee esos eventos y hace matching no existe en producción. |

### A.3 Catálogo universal en producción

El catálogo universal tiene estructura completa en BD, pero el número real de `trade_marketplace_universal_products` con `validation_state = 'validated'` es **muy bajo** (en PZ-001A se crearon manualmente ~6 productos para que el demo funcionara). Este es el mayor bloqueante funcional para un piloto real.

---

## 4. B. Experiencia de compra — Estado real por elemento

| Elemento | Estado | Evidencia |
|----------|--------|-----------|
| **Portada/Home del Marketplace** | 🔴 No existe | No hay ruta `/marketplace`. No hay componente de portada. Por diseño intencional (§3.1 Master Plan). |
| **Navegación por categorías (comprador)** | 🔴 No existe | `loadMarketplaceCategories` existe en `marketplace.ts` pero no se usa en ninguna vista de comprador. Las categorías solo existen en BD. |
| **Buscador de productos (comprador)** | 🔴 No existe como UI | `searchMarketplaceOfferings` RPC existe y funciona (pg_trgm), pero solo se invoca internamente durante la construcción del carrito. No hay campo de búsqueda visible para el instalador. |
| **Filtros por precio/marca/stock** | 🔴 No existe | Sin UI de filtros para el comprador. |
| **Fichas de producto** | 🔴 No existe para comprador | Los datos están en BD (universal_products + offerings). No hay vista `/producto/:id` ni componente de detalle de producto para el comprador. |
| **Carrito — desde presupuesto** | 🟢 Completo | El presupuesto aceptado activa "Comprar en Marketplace" → genera carrito (`source_type='quote'`). Funciona en producción (validado en PZ-001A). |
| **Carrito — revisión de ítems** | 🟢 Completo | `StepRevisar.tsx`: ver ítems, cambiar cantidad, seleccionar proveedor alternativo, estrategia (balance/precio/velocidad/consolidar), análisis IA. |
| **Carrito — checkout** | 🟢 Completo | `StepConfirmar.tsx` + `checkoutCart()`: resumen de pedido por proveedor, confirmar compra, genera `trade_marketplace_orders`. |
| **Carrito libre (sin presupuesto)** | 🔴 No existe como UI | `source_type='manual'` existe en el schema y en el tipo `CartSourceType`. No hay ningún punto de entrada en la UI que cree un carrito sin presupuesto. |
| **Carrito desde contrato de mantenimiento** | 🔴 No existe como UI | `source_type='maintenance_incident'` en el schema. Sin UI. |
| **Carrito desde parte de campo** | 🔴 No existe como UI | `source_type='field_action'` en el schema. Sin UI. |
| **Favoritos de productos** | 🔴 No existe | Sin tabla, sin UI. |
| **Recomendaciones (fuera del presupuesto)** | 🔴 No existe | Las sugerencias del Motor IA solo funcionan dentro del flujo de carrito (`ia_tipo`, `ia_sugerencia` en cart_items). |
| **Historial de pedidos (comprador)** | 🟢 Completo | `ScreenSeguimientoMaterial.tsx` tabs: "Activos" + "Historial" con paginación (HIST_PAGE_SIZE=20). |
| **Seguimiento en tiempo real** | 🟢 Completo | Supabase Realtime en `ScreenSeguimientoMaterial`, canal `org-orders-{orgId}`. |
| **Cancelar pedido (comprador)** | 🟢 Completo | `cancelMarketplaceOrder()` — disponible para estados: pending, confirmed, preparing. |
| **Confirmar recepción** | 🟢 Completo | `deliverMarketplaceOrder()` — disponible cuando estado = 'shipped'. |
| **Timeline de estado** | 🟢 Completo | `OrderTimeline.tsx` — 6 estados (pending→confirmed→preparing→shipped→delivered→completed) + cancelled. |
| **Valoración post-pedido** | 🔴 No existe | `trade_job_reviews` existe para trabajos pero no hay flujo de valoración para pedidos de marketplace. |
| **Carrito flotante persistente** | 🔴 No existe | Visión aprobada para Fase 3. Sin implementar. |

---

## 5. C. Experiencia del instalador

> **Nota importante:** No existe ningún componente llamado "Portal del Instalador". El instalador usa el ERP (AppDashboard) con acceso al flujo de marketplace desde los presupuestos.

| Elemento | Estado | Evidencia |
|----------|--------|-----------|
| **Panel del instalador (ERP)** | 🟢 Completo | AppDashboard con 17 módulos en producción |
| **Acceso al marketplace desde presupuesto** | 🟢 Completo | Botón "Comprar en Marketplace" en vista de presupuesto aceptado |
| **Vista de pedidos activos** | 🟢 Completo | ScreenSeguimientoMaterial — tab Activos |
| **Historial de pedidos** | 🟢 Completo | ScreenSeguimientoMaterial — tab Historial, paginado |
| **Detalle expandible del pedido** | 🟢 Completo | Ver ítems, tracking_url (si existe), timeline |
| **Incidencias / disputas** | 🔴 No existe | Sin flujo de incidencias entre instalador y proveedor. Cancelación es la única acción disponible. |
| **Valoración del proveedor** | 🔴 No existe | Sin UI para que el instalador valore al proveedor tras recibir el pedido. |
| **Panel móvil — seguimiento** | 🟡 Parcial | El componente es responsive pero no se ha validado E2E en dispositivo real. No probado en PZ-001A. |
| **Notificaciones de estado de pedido** | 🔴 No implementado | La infraestructura VAPID existe. No hay trigger que envíe push al instalador cuando el proveedor cambia el estado del pedido. |
| **Acceso al marketplace desde mantenimiento** | 🔴 No existe | Caso de uso documentado en §4.2 del Master Plan. Sin UI ni implementación. |
| **Acceso al marketplace desde parte de campo** | 🔴 No existe | Ídem — sin implementación. |

---

## 6. D. Experiencia del proveedor

| Módulo | Estado | Commit / Evidencia |
|--------|--------|-------------------|
| Autenticación y routing | 🟢 Completo | PZ-001A validado |
| Dashboard operativo con insights IA | 🟢 Completo | MVP-3 · commit 1c62394 |
| Importación CSV del catálogo | 🟢 Completo | MVP-1 · commit ed64f40 |
| Gestión individual de productos | 🟢 Completo | MVP-2 · commit 5080da0 |
| Acciones masivas (activar/desactivar/imagen) | 🟢 Completo | MVP-2 · commit 760fb23 |
| Imágenes de productos (Supabase Storage) | 🟢 Completo | commit a2a2076 |
| Gestión de pedidos (confirmar/preparar/enviar) | 🟢 Completo | MVP-4 · commit c314b40 |
| Centro de acción (pedidos sin confirmar) | 🟢 Completo | MVP-4 |
| Historial de pedidos completados | 🟢 Completo | MVP-4 |
| Gestión de equipo del proveedor | 🟢 Completo | MVP-5 |
| Reporting: KPIs generales | 🟢 Completo | MVP-6 · commit f140eb5 |
| Reporting: ventas por día/estado/org | 🟢 Completo | MVP-6 |
| Reporting: catálogo (top ventas, calidad IA) | 🟢 Completo | MVP-6 |
| Reporting: operativo (ciclos, SLA, incidencias) | 🟢 Completo | MVP-6 |
| Exportación CSV por pestaña | 🟢 Completo | MVP-6.5 |
| Supplier API v1 (Bearer auth) | 🟢 Completo | MVP-7 · commit aaf06a5 |
| Gestión de credenciales API (UI) | 🟢 Completo | PortalIntegraciones.tsx |
| Realtime en lista de pedidos | 🔴 Diferido | ADR-001 — pendiente Sprint 2 |
| Notificación push de nuevo pedido | 🔴 No implementado | Infraestructura VAPID existe; trigger no conectado |
| Registro auto-gestionado del proveedor | 🔴 No implementado | Requiere Sprint 2 |
| Contrato firmable (onboarding legal) | 🔴 No implementado | Pendiente RC1-Delta |
| Factura proveedor → coste del trabajo (ERP) | 🔴 No implementado | Mencionado en objetivos del Master Plan |

---

## 7. E. Experiencia del administrador

| Módulo | Estado | Grupo |
|--------|--------|-------|
| Seguridad base (RLS, ADMIN_EMAIL constants) | 🟢 Completo | Grupo 0 |
| Dashboard ejecutivo (MRR, ARR, ARPU, gráficos) | 🟢 Completo | Grupo 2 |
| Gestión de clientes (OrgDetailPanel, churn, VIP) | 🟢 Completo | Grupos 1+3 |
| Suscripciones y facturación | 🟢 Completo | Grupo 4 |
| Uso del producto y cohortes trial→pago | 🟢 Completo | Grupo 5 |
| Automatizaciones (churn, ntfy, CSV mensual) | 🟢 Completo | Grupo 6 |
| Gestión de proveedores marketplace | 🟢 Completo | Grupo 7 — AdminSuppliersSection |
| Catálogos de proveedores | 🟢 Completo | Grupo 7 |
| Productos universales (carga y matching admin) | 🟡 Parcial | Sin UI específica de gestión masiva de UPs; se gestionan via SQL/API |
| Módulo CRM corporativo | 🔴 No implementado | Sistema Documental — PENDIENTE |
| Dashboard de métricas del Marketplace (GMV, pedidos/día) | 🔴 No implementado | No hay sección específica de KPIs de marketplace en Admin |

---

## 8. Dependencias que faltan para un Marketplace completo

Ordenadas de mayor a menor impacto en la funcionalidad actual:

| # | Dependencia | Impacto | Cuándo |
|---|------------|---------|--------|
| 1 | **Catálogo universal poblado (≥ 50 productos validados)** | El Motor IA no puede sugerir proveedores si no hay UPs que matches las líneas del presupuesto | RC1-Beta (B03) |
| 2 | **Notificación push de nuevo pedido al proveedor** | El proveedor no sabe que tiene pedidos sin revisar el portal manualmente | Sprint 2 |
| 3 | **Realtime en PortalPedidos** | El proveedor no ve nuevos pedidos sin recargar (ADR-001) | Sprint 2 |
| 4 | **Motor IA de matching automático** | Los productos importados quedan en match_state='pending' hasta revisión manual | Post Sprint 2 |
| 5 | **Registro auto-gestionado del proveedor** | Hoy solo el admin puede crear actores de marketplace | Sprint 2 |
| 6 | **Carrito libre (sin presupuesto)** | El instalador no puede comprar material sin tener un presupuesto activo | Fase 3 |
| 7 | **Browse UI para el comprador** | No hay experiencia de descubrimiento de productos | Fase 3 |
| 8 | **Stripe Connect (comisiones)** | No hay modelo de ingresos por transacción activo | Post-pilotos |
| 9 | **Integración factura proveedor → coste trabajo ERP** | El ciclo completo no está cerrado contablemente | Roadmap 2027 |

---

## 9. ¿Qué sprint debía contener cada funcionalidad?

Según `TRABFLOW_MARKETPLACE_MASTER_PLAN.md` y el EXECUTION_BOARD:

| Funcionalidad | Sprint previsto | Estado real |
|--------------|----------------|-------------|
| Infraestructura BD (tablas, RLS, UPs) | Sprint 0 / 0B | 🟢 Completo |
| Flujo carrito desde presupuesto | Sprint 0 / Phase 2A | 🟢 Completo |
| Seguimiento Realtime (comprador) | Phase 2B | 🟢 Completo |
| Portal proveedor (dashboard, catálogo, pedidos) | Phase 2C | 🟢 Completo |
| Reporting operativo proveedor | MKT-V2-P02 (MVP-6) | 🟢 Completo |
| Supplier API v1 | MKT-V2-P02 (MVP-7) | 🟢 Completo |
| Realtime portal proveedor | Sprint 2 | 🔴 Pendiente |
| Registro auto-gestionado proveedor | Sprint 2 | 🔴 Pendiente |
| Email de nuevo pedido al proveedor | Sprint 2 | 🔴 Pendiente |
| Push notifications proveedor | Sprint 2 | 🔴 Pendiente |
| Browse UI comprador | Fase 3 | 🔴 No iniciado |
| Carrito libre sin presupuesto | Fase 3 | 🔴 No iniciado |
| Catálogo navegable por categorías | Fase 3 | 🔴 No iniciado |
| Stripe Connect (modelo de comisión) | Fase 3+ | 🔴 No iniciado |
| Motor IA de matching | Post Fase 2 | 🔴 Outbox listo, motor no |

---

## 10. Orden de ejecución correcto según dependencias

```
AHORA — RC1-Beta (sin código)
  ├── B03: Cargar ≥ 50 Productos Universales en producción
  │        → habilita que la demo funcione con datos reales
  └── B04: Checklist de bienvenida para proveedor nuevo

DESPUÉS — PZ-001B (piloto externo instalador real)
  → valida el flujo comprador con usuario real

DESPUÉS — RC1-Gamma / Sprint 2 (en paralelo decidir orden)
  ├── Notificación push nuevo pedido al proveedor      ← alto impacto operativo
  ├── Realtime PortalPedidos (resolver ADR-001)        ← alto impacto UX proveedor
  ├── Registro auto-gestionado del proveedor           ← habilita PZ-001C sin admin
  └── Email HTML transaccional (nuevo pedido)          ← back-stop si push falla

DESPUÉS — PZ-001C (piloto externo proveedor real)
  → requiere registro auto-gestionado o sesión de onboarding manual

DESPUÉS — Fase 3 (post-pilotos comerciales)
  ├── Browse UI: portada, categorías, buscador, fichas
  ├── Carrito flotante sin presupuesto
  └── Favoritos, recomendaciones

DESPUÉS — Roadmap 2027
  ├── Stripe Connect (modelo de comisión)
  ├── Integración factura proveedor → ERP
  └── Valoraciones de proveedor
```

---

## 11. Siguiente tarea única recomendada

**B03 — Cargar el catálogo demo funcional (≥ 50 Productos Universales)**

**Por qué es la siguiente tarea correcta:**

1. Es la primera tarea de RC1-Beta con impacto directo en la demo comercial.
2. Sin productos en el catálogo, el Motor IA no puede sugerir ningún proveedor para ningún presupuesto → la demo falla en el paso más impactante visualmente.
3. No requiere escribir código: se hace cargando datos vía la propia Supplier API v1 (MVP-7) o directamente en Admin Panel con las herramientas existentes.
4. Es completamente reversible y sin riesgo técnico.
5. Desbloquea inmediatamente B01 (guión de demo) porque la demo tendrá datos reales sobre los que crear el guión.

**Cómo ejecutarla:**

```
1. Seleccionar 50-100 productos reales de una categoría concreta
   (ej: fontanería de baño — lo que cubre un presupuesto de reforma estándar)

2. Usar el Portal Proveedor (OBRAMAT Demo, contacto@inmostay.com)
   → Catálogo → Importar CSV → cargar el CSV con los productos

3. En Admin Panel → Proveedores → OBRAMAT Demo
   → verificar que los productos se han importado correctamente

4. Crear los Productos Universales correspondientes
   (vía SQL en Supabase Dashboard o una herramienta de carga)
   → asignar match_state='matched' + match_confidence alto

5. Probar: crear presupuesto de reforma de baño → "Comprar en Marketplace"
   → verificar que el Motor IA sugiere OBRAMAT Demo para los materiales
```

---

## ESTADO REAL DEL MARKETPLACE

```
------------------------------------------------

TIPO DE PRODUCTO

  Sistema de compra guiada desde presupuesto + portal completo del proveedor.
  NO es un marketplace navegable tipo Amazon/Leroy Merlin Pro.
  La decisión es intencional y está documentada en el Master Plan.

PORCENTAJE APROXIMADO DE FINALIZACIÓN

  Infraestructura BD:                     95% completo
  Flujo comprador (desde presupuesto):    90% completo
  Portal del proveedor:                   90% completo
  Experiencia browse/descubrimiento:       0% (Fase 3)
  Carrito libre sin presupuesto:           0% (Fase 3)
  Modelo de comisión (Stripe Connect):     0% (post-pilotos)
  Marketplace completo según visión final: ~35%

  Marketplace operativo para pilotos:      85%
  (el 15% restante son datos —catálogo— no código)

FASE ACTUAL

  RC1-Beta: Commercial Readiness Bloque 2
  El Portal Proveedor está técnicamente completo (MVP 1-7).
  El flujo comprador funciona pero carece de catálogo real para demo.

FASE PREVISTA (según roadmap)

  Siguiente: RC1-Beta → PZ-001B → RC1-Gamma + Sprint 2 → PZ-001C
  Después:   Fase 3 (catálogo libre) — post-pilotos comerciales

BLOQUEADOR PRINCIPAL

  Catálogo universal vacío.
  Hay < 10 Productos Universales con validation_state='matched' en producción.
  Sin ellos, el Motor IA no puede sugerir ningún proveedor a ningún instalador,
  y la demo del Marketplace falla en su momento más crítico.
  Este bloqueador no requiere código — requiere datos.

SIGUIENTE TAREA ÚNICA

  B03: Cargar ≥ 50 Productos Universales validados en producción
  usando el Portal Proveedor (CSV) + matching manual vía Admin/SQL.
  Foco: productos de reforma de baño (fontanería) para tener una demo
  completa y funcional del flujo instalador → presupuesto → pedido.

------------------------------------------------
```

---

*Documento generado 2026-07-31 · Basado en lectura directa del código fuente y migraciones*
*No contiene estimaciones — solo evidencia de archivos existentes*
