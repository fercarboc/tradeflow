# TrabFlow — Execution Board

**Versión:** 2.0  
**Última actualización:** 2026-07-31  
**Propósito:** Documento de gobierno único del proyecto. Primer documento que se consulta en cada sesión de trabajo. Indica dónde estamos, qué está terminado, cuál es el siguiente paso y qué depende de qué.

> **Regla de uso:** Este documento se actualiza al terminar cada tarea o fase. Nunca al empezarla. Si el EXECUTION_BOARD no refleja la realidad, el proyecto pierde el control.

---

## 1. ESTADO ACTUAL

```
FECHA          2026-08-02

FASE ACTIVA    MKT-FASE1-PILOT-002 — Validación funcional puente Motor IA → UP → Marketplace
               ETAPAs 1–6 completadas · Pendiente revisión humana (ETAPA 7 no autorizada)

ESTADO GENERAL
  ██████████████████░░  Producto ERP:             95% completado
  ████████████████░░░░  Portal Proveedor:         90% completado (MVP 1-7)
  ████████░░░░░░░░░░░░  Commercial Readiness RC1:  40% completado
  ██░░░░░░░░░░░░░░░░░░  Pilotos externos:          0 / 4 (PZ-001A interno ✔)
  ████░░░░░░░░░░░░░░░░  Catálogo Marketplace:      16 / ∞ UPs validated · 5 offerings OBRAMAT Demo pending_review

ÚLTIMA ACCIÓN
  2026-08-02  MKT-FASE1-PILOT-002 ETAPA 6 completada — C-006: 5 offerings OBRAMAT Demo cargadas
              Método: Supplier API v1 (Bearer auth, endpoint /catalog/upsert)
              Bug fix: api_sync_catalog_offerings — gen_random_bytes → gen_random_uuid() (search_path fix)
              5/5 offerings: DEMO-FON-C15-001, DEMO-FON-COC-001, DEMO-FON-CU15-001, DEMO-FON-PDR-001, DEMO-FON-VSEG-001
              Todos en match_state=pending_review, universal_product_id=NULL (matching no ejecutado)
              import_id: 67c8103d-1b4c-4541-b6f0-0ef713eac358 · filas_ok=5 · filas_error=0
              Postvalidaciones 7/7 OK

SIGUIENTE ACCIÓN
  ETAPA 7 — Revisar match_state offerings OBRAMAT Demo y vincular a UPs validated
  Requiere autorización explícita. DETENIDO para revisión humana.
```

---

## 2. FASES TERMINADAS

Lista cronológica. Solo se añade. Nunca se modifica lo ya completado.

---

**✔ FASE 0 — ERP Base + Motor IA**
`Ene–Jun 2026`
Presupuestos (voz, foto, manual), facturas, clientes, trabajos, ruta del día, equipo, roles, contratos de mantenimiento SAT, subcontratas, ingresos, exportaciones DOCX/CSV/PDF. Motor IA v1–v59 con 98.2% OK rate. Benchmark de 400 casos validado. Stripe billing con trial de 3 meses. Onboarding wizard 7 pasos. Chatbot de ayuda. Asistente técnico normativa. Admin Panel (grupos 0–7). Push notifications infraestructura. PWA instalable.

---

**✔ FASE 1 — Marketplace Connect Phase 2**
`Jun–Jul 2026`
Phase 2A: checkout 2 pasos, auto-selección proveedor. Phase 2B: seguimiento Realtime (Supabase Realtime, timeline animado, ScreenSeguimientoMaterial). Phase 2C: portal proveedor completo (dashboard IA, pedidos, catálogo, equipo, configuración). Componentes shared/ (OrderStatusBadge, OrderTimeline, ConfirmModal). Design System v1 y Product Language v1. ADR-001 formaliza decisión de diferir Realtime en portal proveedor.

---

**✔ FASE 2 — Consolidación UX pre-piloto**
`Jul 2026`
Fix routing AppDashboard (sub-vista persistente). Fix auth portal proveedor (workspaceResolver cliente correcto). Integración pedidos Marketplace en ScreenPedidosMaterial. UX-001 a UX-005 resueltos.

---

**✔ PZ-001A — Piloto Zero Interno**
`2026-07-26 / 2026-07-27`
Primer piloto operativo completo del Marketplace de extremo a extremo. Actores: `legal@inmostay.com` (instalador ANGEL AMETEO) + `contacto@inmostay.com` (proveedor OBRAMAT Demo). 2 ciclos completos (MKT-000001, MKT-000002). Ciclo MKT-000002: confirmar 12:06 → recibido 12:09 (~3 min). 11 bugs resueltos, 0 pendientes. Resultado: PASS. Documentado en `docs/pilot/PZ001A_COMPLETED.md`.

---

**✔ AUDITORÍA RC-1**
`2026-07-28`
15 secciones de análisis. Checklist de ~100 ítems en 14 bloques. Plan priorizado en 4 sprints (Alpha/Beta/Gamma/Delta). Documentado en `docs/RC1_COMMERCIAL_READINESS.md`, `docs/RC1_CHECKLIST.md`, `docs/RC1_MVP_ELEMENTS.md`.

---

**✔ RC1-Alpha — Bloqueantes legales y percepción**
`2026-07-28 / 2026-07-29`

| Código | Tarea | Commit | Fecha |
|--------|-------|--------|-------|
| RC1-C01 | NIF provisional B11792515 en Aviso Legal | f2120a1 | 2026-07-28 |
| RC1-C02 | Domicilio social: C/ Las Varas 69, Castillo Pedroso | 841e4b5 | 2026-07-28 |
| RC1-C03 | Banner cookies RGPD (3 categorías, localStorage) | 3ce0908 | 2026-07-28 |
| RC1-C04-A | Vercel Analytics con consent gate | e781a7e | 2026-07-28 |
| RC1-C04-B | Eliminar narrativa "beta privada" de toda la UI | 7488d69 | 2026-07-28 |
| RC1-C04-C | Auditoría documental + sincronización docs vivos | 82acdb0 | 2026-07-29 |
| RC1-C05 | Actualizar fecha "Mayo 2026" en páginas legales | — | ⏸ Diferida deliberadamente |
| RC1-C06 | Limpiar /public (imágenes ChatGPT, PDFs de prueba) | — | ⏸ Diferida deliberadamente |

RC1-C05 y RC1-C06 diferidas por decisión del fundador (2026-07-29): "pueden hacerse en una hora cuando el producto esté terminado". No bloquean ningún piloto comercial.

---

**✔ MKT-FASE1-PILOT-002 — ETAPAs 1–6 (puente Motor IA → UP → Marketplace)**
`2026-08-01 / 2026-08-02`

| Ítem | Detalle |
|------|---------|
| ETAPA 1 — C-001 DDL | 3 columnas en `trade_quote_items` (gc/up/variant_id) + 3 índices parciales. Commit `2ae619c` |
| ETAPA 2 — C-002 Motor IA | `resolveMarketplaceIds` batch (max 2 queries anti-N+1). 14/14 tests. Deploy v70. Commit `d445651` |
| ETAPA 3 — C-003 Level 0 | `create_cart_from_quote` con 4 sub-niveles deterministas (0-A/B/C). 10/10 tests SQL. Commit `e279bd5` |
| ETAPA 4 — C-004 Promoción | 16 UPs draft → validated. Dry run 100% OK (§DR-11g corregido). 7/7 postvalidaciones. Commit `e8b1cb9` |
| ETAPA 5 — C-005 Validación | 27/27 tests PASS sin offerings. Level 0 paths verificados. Doc: `MKT_FASE1_PILOT_002_STAGE5_RESULTS.md`. Commit `e8b1cb9` |
| ETAPA 6 — C-006 Offerings | 5 offerings OBRAMAT Demo cargadas via Supplier API v1. Bug fix `gen_random_bytes`. 7/7 postvalidaciones. |
| Bug fix | `api_sync_catalog_offerings`: `gen_random_bytes(8)` → `replace(gen_random_uuid()::text,'-','')`. Migración: `20260802_01_fix_api_sync_catalog_gen_random_bytes.sql` |
| Estado offerings | 5 offerings en `match_state=pending_review`. Matching NO ejecutado. Pendiente revisión humana. |
| Rollback disponible | C-003: `C003_ROLLBACK_create_cart_from_quote_pre_level0.sql`. C-004: UPDATE validated→draft (condicionado). |
| Siguiente | ETAPA 7 — Matching offerings → UPs validated. Requiere autorización. |

---

**✔ MKT-FASE1-PILOT-001 — Puente gc → UP → Marketplace (fontanería)**
`2026-08-01`

| Ítem | Detalle |
|------|---------|
| Proyecto Supabase | dqqjaujnulutinskmqsu (eu-central-1) |
| DDL | `global_catalog_id uuid FK` en variants + índice UNIQUE parcial |
| Incidencia 1 | `chk_up_origen` → `origen = 'global_catalog'`; batch por `especificaciones->>'_batch'` |
| Incidencia 2 | `NULLS NOT DISTINCT` en EAN/GTIN → reemplazados por índices parciales `WHERE IS NOT NULL` |
| UPs creados | 16 (11 padre genéricos + 5 directos) |
| Variantes creadas | 15 |
| Categoría creada | `font-acs` — Equipos de agua caliente sanitaria |
| Cobertura gc | 21/21 CUBIERTO |
| Integridad | 7/7 checks OK |
| Rollback disponible | Sí — `MKT_FASE1_PILOT_001_ROLLBACK_v4.sql` |

---

**✔ Portal Proveedor — MVP-1 a MVP-7**
`2026-07-29 / 2026-07-31`

| MVP | Módulo | Commit | Fecha |
|-----|--------|--------|-------|
| MVP-1 | Importación CSV catálogo | ed64f40 | 2026-07-29 |
| MVP-2 | Gestión de productos (individual + masiva) | 5080da0 / 6ad37d3 / 760fb23 | 2026-07-29 |
| MVP-3 | Dashboard operativo del proveedor | a2a2076 / 1c62394 | 2026-07-30 |
| MVP-4 | Portal de pedidos completo | c314b40 | 2026-07-30 |
| MVP-5 | Gestión de equipo del proveedor | (incluido en MVP-4) | 2026-07-30 |
| MVP-6 | Reporting operativo (KPIs, Ventas, Catálogo, CSV) | f140eb5 / 75f011a | 2026-07-31 |
| MVP-7 | Supplier API v1 (credenciales Bearer, sync) | aaf06a5 | 2026-07-31 |

---

## 3. ESTADO POR MÓDULO

### ERP — Instalador

| Módulo | Estado | Notas |
|--------|--------|-------|
| Motor IA presupuestos | ✅ Producción | v59, 98.2% OK rate, 400 casos benchmark |
| Presupuestos (voz/foto/manual) | ✅ Producción | Wizard sugerencias, PDF auto, WhatsApp |
| Facturas | ✅ Producción | ScreenFacturas unificado, DOCX |
| Clientes | ✅ Producción | |
| Trabajos y partes de campo | ✅ Producción | trade_field_actions, firma digital |
| Contratos de mantenimiento | ✅ Producción | DOCX 14 cláusulas |
| Planificación y ruta del día | ✅ Producción | |
| Equipo e invitaciones | ✅ Producción | roles owner/técnico/admin |
| Subcontratas | ✅ Producción | |
| Catálogos de proveedores | ✅ Producción | ScreenCatalog con proveedor, precio coste en pedidos |
| Flujo post-cierre (firma + valoración) | ✅ Producción | SignaturePad, trade_job_reviews, /valorar/:token |
| Exportaciones DOCX/CSV/PDF | ✅ Producción | |

### Marketplace — Comprador (Instalador)

| Módulo | Estado | Notas |
|--------|--------|-------|
| Carrito desde presupuesto | ✅ Producción | auto-selección proveedor vía Motor IA |
| Checkout 2 pasos | ✅ Producción | StepRevisar + StepConfirmar |
| Seguimiento realtime | ✅ Producción | Supabase Realtime, timeline animado |
| Historial de pedidos | ✅ Producción | ScreenSeguimientoMaterial |
| Carrito libre (sin presupuesto) | ❌ No implementado | Fase 3 — post-pilotos comerciales |

### Portal Proveedor

| Módulo | Estado | Notas |
|--------|--------|-------|
| Autenticación y routing | ✅ Producción | workspaceResolver corregido |
| Dashboard con insights IA | ✅ Producción | MVP-3 |
| Catálogo — importación CSV | ✅ Producción | MVP-1 |
| Catálogo — gestión productos | ✅ Producción | MVP-2, imágenes en Storage |
| Pedidos — gestión completa | ✅ Producción | MVP-4, confirmar/preparar/enviar |
| Pedidos — Realtime push | ❌ Diferido | ADR-001 — pendiente Sprint 2 |
| Equipo del proveedor | ✅ Producción | MVP-5 |
| Configuración | ✅ Producción | |
| Reporting operativo | ✅ Producción | MVP-6, KPIs+Ventas+Catálogo+Operativo+CSV |
| Supplier API v1 | ✅ Producción | MVP-7, Bearer auth, 5 endpoints |
| Portal Integraciones (UI) | ✅ Producción | PortalIntegraciones.tsx, gestión credentials |
| Onboarding guiado (primer acceso) | ❌ No implementado | Pendiente RC1-Beta |
| Registro de proveedor auto-gestionado | ❌ No implementado | Pendiente Sprint 2 |

### Admin Panel

| Módulo | Estado | Notas |
|--------|--------|-------|
| Seguridad base (RLS, constants) | ✅ Grupo 0 completo | |
| Dashboard ejecutivo (KPIs, gráficos) | ✅ Grupo 2 completo | MRR, ARR, ARPU, altas/mes |
| Gestión de clientes | ✅ Grupos 1+3 completos | OrgDetailPanel, churn_risk, VIP |
| Suscripciones y facturación | ✅ Grupo 4 completo | |
| Uso del producto y cohortes | ✅ Grupo 5 completo | |
| Automatizaciones (churn, ntfy, CSV) | ✅ Grupo 6 completo | pg_cron activo |
| Gestión de proveedores marketplace | ✅ Grupo 7 completo | AdminSuppliersSection |
| Catálogos de proveedores (Admin) | ✅ Completado | AdminSuppliersSection + ScreenCatalog |
| Módulo CRM corporativo | ❌ No implementado | Sistema Documental pendiente |

### Motor IA

| Ítem | Estado | Notas |
|------|--------|-------|
| v59 en producción | ✅ | 98.2% OK rate |
| Benchmark 400 casos | ✅ | |
| Aprendizaje implícito proveedores preferidos | ✅ | Fase 3 completada |
| Sprint 4 P1 (fix max_tokens) | ✅ | |
| Sprint 4 P2 (Regression Diff / AI Validation Center) | ❌ Pendiente | Bloquea P3-P6 |
| Sprint 4 P3 (Dashboard observabilidad) | ❌ Pendiente | Requiere P2 |
| Sprint 4 P4 (Mejora detección de oficio) | ❌ Pendiente | Requiere P2 |
| Sprint 4 P5 (SLA latencia y alertas) | ❌ Pendiente | Requiere P2 |
| Sprint 4 P6 (Correlación benchmark↔producción) | ❌ Pendiente | Requiere P2 |
| Matching de productos universales | ⚠️ Parcial | Outbox activo, matching manual/básico |

### Push Notifications

| Ítem | Estado | Notas |
|------|--------|-------|
| Infraestructura VAPID + service worker | ✅ Producción | trade_push_subscriptions, sw.js |
| Suscripción desde la UI (instalador) | ✅ Producción | subscribePush() |
| Envío desde Edge Function | ✅ Producción | trade-push-notification |
| Probado en dispositivo real (iOS/Android) | ❌ No probado | No se probó en PZ-001A |
| Notificación de nuevo pedido al proveedor | ❌ No implementado | Trigger pendiente en Portal |

### Experiencia Móvil (PWA)

| Ítem | Estado | Notas |
|------|--------|-------|
| PWA instalable (manifest, service worker, iconos) | ✅ Producción | |
| Prompt de instalación Android/iOS | ✅ Producción | HomeView.tsx |
| Tabs móvil ERP (carrusel, 6 tabs) | ✅ Producción | |
| Flujo ERP completo en móvil | ✅ Producción | |
| Flujo Marketplace en móvil (comprador) | ⚠️ No probado E2E | PZ-001A solo desktop |
| Portal Proveedor en móvil | ⚠️ No probado E2E | Diseñado responsive pero sin validar |
| Push notifications en dispositivo real | ❌ No probado | |
| Paridad funcional móvil vs desktop (completa) | ⚠️ Parcial | Pendiente PZ-001E |

### Documentación

| Documento | Estado | Ubicación |
|-----------|--------|-----------|
| EXECUTION_BOARD.md | ✅ Actualizado | docs/ |
| RC1_CHECKLIST.md | ✅ Actualizado a RC1-Alpha | docs/ |
| RC1_COMMERCIAL_READINESS.md | ✅ Snapshot histórico | docs/ |
| RC1_BETA_PLAN.md | ✅ Creado | docs/ |
| PZ001A_COMPLETED.md | ✅ | docs/pilot/ |
| ADR-001 (Realtime portal proveedor) | ✅ | docs/adr/ |
| Design System v1 | ✅ | docs/design-system/ |
| Product Language v1 | ✅ | docs/design-system/ |
| SUPPLIER_API_V1.md | ✅ | docs/marketplace/ |
| CHANGELOG.md | ✅ | docs/ |
| Manual instalador (usuario final) | ❌ No existe | Pendiente RC1-Beta |
| Manual proveedor (usuario final) | ❌ No existe | Pendiente RC1-Beta |
| FAQ pública | ❌ No existe | Pendiente RC1-Beta |
| Centro de ayuda | ❌ No existe | Pendiente RC1-Beta |
| Contrato de proveedor marketplace | ❌ No existe | Pendiente RC1-Delta |

---

## 4. FASE EN CURSO

```
FASE:        RC1-Beta
TIPO:        Commercial Readiness — Bloque 2
OBJETIVO:    Tener una demo comercial ejecutable y los elementos
             mínimos para que un proveedor externo real pueda
             ser incorporado sin intervención técnica.
RESULTADO    Un distribuidor real puede recibir una demo de 15 min
ESPERADO:    y quedar convencido de unirse al marketplace.
DOCUMENTOS   docs/RC1_BETA_PLAN.md (nuevo)
AFECTADOS:   docs/RC1_CHECKLIST.md (Bloques 6, 7, 9)
PRERREQUISITO: RC1-Alpha completado ✔
DESBLOQUEA:    PZ-001B (primer instalador externo real)
```

### Tareas RC1-Beta (en orden de ejecución)

| Código | Tarea | Prioridad | Estado |
|--------|-------|-----------|--------|
| B01 | Guión de demo estandarizado (15 min) | 🔴 CRÍTICO | ⬜ Pendiente |
| B02 | Datos de demo coherentes (presupuesto, cliente, pedido) | 🔴 CRÍTICO | ⬜ Pendiente |
| B03 | Catálogo demo funcional (≥ 50 Productos Universales) | 🔴 CRÍTICO | ⬜ Pendiente |
| B04 | Checklist de bienvenida en Dashboard del proveedor nuevo | 🔴 CRÍTICO | ⬜ Pendiente |
| B05 | Email de bienvenida HTML (instalador y proveedor) | 🟠 ALTO | ⬜ Pendiente |
| B06 | FAQ pública (mínimo 15 preguntas) | 🟠 ALTO | ⬜ Pendiente |
| B07 | Canal de soporte operativo (WhatsApp/email < 24h) | 🟠 ALTO | ⬜ Pendiente |
| B08 | Argumento de ROI en la landing | 🟠 ALTO | ⬜ Pendiente |
| B09 | Tabla de cookies específica en Política de Cookies | 🔴 CRÍTICO | ⬜ Pendiente |
| B10 | Retención de datos y transferencias internacionales en Privacidad | 🔴 CRÍTICO | ⬜ Pendiente |

Ver plan completo en `docs/RC1_BETA_PLAN.md`.

---

## 5. COLA DE EJECUCIÓN

El orden es fijo. No se modifica sin actualizar este documento y registrar la razón.

```
  ✔ PZ-001A             Piloto Zero Interno — COMPLETADO
  ✔ Auditoría RC-1      Análisis completo — COMPLETADO
  ✔ RC1-Alpha           Bloqueantes legales + analytics + sin "beta" — COMPLETADO
  ✔ Portal Proveedor    MVP-1 a MVP-7 — COMPLETADO
  ✔ MKT-FASE1-PILOT-001 Puente gc → UP → Marketplace fontanería — COMPLETADO 2026-08-01

  ▶ MKT-FASE1-PILOT-002 Validación funcional Motor IA → UP → variante → Marketplace ← SIGUIENTE
    │
    ▼
  RC1-Beta              Demo ejecutable + catálogo + onboarding proveedor
    │
    ▼
    PZ-001B             Primer instalador externo real
    │
    ▼
    RC1-Gamma           Conversión: ROI, tutorial in-app, emails HTML, Sentry
    │
    ▼
    PZ-001C             Primer proveedor externo real
    │
    ▼
    RC1-Delta           Legal completo + vídeo + SEO + recordatorios trial
    │
    ▼
    PZ-001D             Piloto multi-proveedor
    │
    ▼
    PZ-001E             Piloto móvil (instalador en campo, PWA + push)
    │
    ▼
    Cierre RC-1         Todos los CRÍTICOS y 80%+ ALTOS resueltos
    │
    ▼
    Sprint 2 Marketplace  Realtime portal, registro proveedor auto, email alertas
    │
    ▼
    Fase 3 Marketplace  Catálogo libre navegable + carrito flotante (Amazon B2B)
```

### Pista paralela — Motor IA Sprint 4 (independiente)

```
  ✔ Sprint 4 P1 — fix max_tokens → v59 (COMPLETADO)
  ⬜ Sprint 4 P2 — Regression Diff (AI Validation Center)   ← próximo en pista IA
  ⬜ Sprint 4 P3 — Dashboard observabilidad motor IA         requiere P2
  ⬜ Sprint 4 P4 — Mejora detección de oficio                requiere P2
  ⬜ Sprint 4 P5 — SLA latencia y alertas                    requiere P2
  ⬜ Sprint 4 P6 — Correlación benchmark ↔ producción real   requiere P2
```

---

## 6. PILOTOS

### PZ-001A — Piloto Zero Interno ✔ COMPLETADO

```
ESTADO:    ✔ COMPLETADO
FECHA:     2026-07-26 / 2026-07-27
ACTORES:   legal@inmostay.com (Instalador) · contacto@inmostay.com (Proveedor)
EMPRESA:   ANGEL AMETEO / OBRAMAT Demo (actor_id: 85e73234-c74e-44e7-865a-1aca8312f9a5)
RESULTADO: PASS — 2 ciclos E2E completados (~3 min por ciclo)
PEDIDOS:   MKT-000001 · MKT-000002
BUGS:      11 encontrados · 11 resueltos · 0 pendientes
DOC:       docs/pilot/PZ001A_COMPLETED.md
```

### PZ-001B — Primer Instalador Externo Real ⬜ PENDIENTE

```
ESTADO:    ⬜ PENDIENTE
PRERREQ:   RC1-Beta completado
ACTORES:   Instalador real (empresa instaladora de Cantabria)
           Proveedor: OBRAMAT Demo (cuenta controlada TrabFlow)
ALCANCE:   Flujo completo. 1 pedido real desde presupuesto real.
CRITERIO:  Instalador completa el flujo sin asistencia tras 10 min de demo.
```

### PZ-001C — Primer Proveedor Externo Real ⬜ PENDIENTE

```
ESTADO:    ⬜ PENDIENTE
PRERREQ:   RC1-Beta + PZ-001B completados
ACTORES:   Proveedor real (distribuidor fontanería o electricidad)
           Instalador: TrabFlow interno o PZ-001B
ALCANCE:   Onboarding proveedor, carga catálogo, ciclo completo pedido.
CRITERIO:  Proveedor gestiona pedido completo sin asistencia técnica.
```

### PZ-001D — Piloto Multi-Proveedor ⬜ PENDIENTE

```
PRERREQ:   PZ-001B + PZ-001C completados
ALCANCE:   Carrito con materiales de 2 proveedores. Motor IA asigna.
CRITERIO:  2 pedidos independientes, 2 confirmaciones de entrega.
```

### PZ-001E — Piloto Móvil (Campo) ⬜ PENDIENTE

```
PRERREQ:   RC1-Gamma completado
ALCANCE:   Presupuesto por voz → marketplace → pedido, todo desde móvil.
CRITERIO:  Técnico completa en < 5 min desde obra. Push activas.
```

---

## 7. BLOQUEADORES ABIERTOS

| ID | Bloqueador | Tipo | Acción necesaria |
|----|-----------|------|-----------------|
| BLQ-001 | NIF provisional (B11792515) — requiere NIF real al inscribirse en RM | Legal | Fernando: obtener NIF real y actualizar LegalViews.tsx |
| BLQ-002 | Domicilio social provisional — requiere domicilio registral definitivo | Legal | Fernando: confirmar domicilio al inscribir sociedad |
| BLQ-003 | Política de privacidad incompleta (retención datos, transferencias EEUU, DPO) | Legal/RGPD | Redactar en RC1-Beta |
| BLQ-004 | Tabla de cookies específica ausente en Política de Cookies | Legal/RGPD | Redactar en RC1-Beta |
| BLQ-005 | Sin catálogo demo funcional (< 10 Productos Universales activos) | Comercial | Cargar ≥ 50 productos en RC1-Beta |
| BLQ-006 | Sin guión de demo estandarizado | Comercial | Crear en RC1-Beta |
| BLQ-007 | Push notifications no probadas en dispositivo real | Operativo | Probar en PZ-001B (prerreq PZ-001E) |
| BLQ-008 | ADR-001 sin resolver — Realtime en PortalPedidos diferido | Técnico | Sprint 2: auditar supplier_actor_id en RLS |
| BLQ-009 | Sin onboarding guiado para proveedor nuevo en el Portal | UX | Checklist de bienvenida en RC1-Beta |
| BLQ-010 | Sin error monitoring (Sentry o equivalente) | Operativo | RC1-Gamma |
| BLQ-011 | RC1-C05 y RC1-C06 diferidas (fechas legales + /public) | Legal/Calidad | Completar antes del cierre de RC1-Alpha formal |

---

## 8. DEUDA TÉCNICA

| ID | Deuda | Prioridad | Cuándo resolver |
|----|-------|-----------|----------------|
| DT-001 | `supabase.gen.ts` desactualizado (~67 `as any`) | Media | Sprint 2 — antes de añadir funcionalidades nuevas |
| DT-002 | Sin staging separado de producción (Supabase branch) | Media | Sprint 2 |
| DT-003 | `e2e/.auth/*.json` en repositorio (credenciales Playwright) | Alta | Añadir a .gitignore y eliminar del índice |
| DT-004 | `ADMIN_EMAIL` hardcodeado en Edge Functions desplegadas | Media | Al cambiar email de admin, redesplegar |
| DT-005 | Motor IA Sprint 4 P2-P6 pendientes (Regression Diff y observabilidad) | Alta (pista paralela) | Pista paralela, sin bloquear RC-1 |
| DT-006 | Scripts `test-motor-ia/` con errores TS en `ITableBordersOptions` | Baja | Cuando se retome el módulo |
| DT-007 | Sin Sentry ni uptime monitoring en producción | Alta | RC1-Gamma |
| DT-008 | Templates de email como strings planos en Edge Functions | Media | RC1-Beta/Gamma |
| DT-009 | Registro de proveedor no auto-gestionado (requiere admin) | Media | Sprint 2 |

---

## 9. RIESGOS

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|----|--------|-------------|---------|------------|
| R-001 | Piloto externo (PZ-001B) sin catálogo funcional — Motor IA no sugiere materiales | Alta | Alto | Cargar ≥ 50 Productos Universales antes de PZ-001B |
| R-002 | Proveedor real sin onboarding guiado — primera sesión caótica | Alta | Alto | Checklist de bienvenida en Dashboard (RC1-Beta B04) + sesión de 15 min presencial |
| R-003 | Sin push notifications — proveedor no se entera de pedidos | Alta | Alto | Protocolo manual (revisar portal 2×/día) hasta que push esté probado |
| R-004 | Política de privacidad incompleta — problema RGPD con empresa española | Media | Alto | Completar en RC1-Beta antes de PZ-001B |
| R-005 | Sin error monitoring — bug crítico en producción sin alerta | Media | Alto | Añadir Sentry básico en RC1-Gamma |
| R-006 | Flujo marketplace en móvil no validado — instalador en obra con problemas | Media | Medio | Validar en PZ-001E (puede usarse desktop hasta entonces) |
| R-007 | Múltiples proveedores en carrito no probado | Media | Medio | Limitar PZ-001B y PZ-001C a mono-proveedor |
| R-008 | NIF provisional — puede generar dudas legales si se firma un contrato | Baja | Alto | Usar NIF real en cuanto esté disponible (Fernando: gestión sociedad) |
| R-009 | Rendimiento bajo carga real — solo probado con 2 usuarios | Baja | Medio | Monitorizar logs Vercel/Supabase durante pilotos |

---

## 10. SPRINTS

### ERP y Motor IA (pista paralela)

| Sprint | Período | Estado | Resultado |
|--------|---------|--------|-----------|
| IA Sprint 1 | Feb–Mar 2026 | ✔ Completado | Motor IA v1 en producción |
| IA Sprint 2 | Mar–Abr 2026 | ✔ Completado | Benchmark 200 casos, oficios básicos |
| IA Sprint 3 | May–Jun 2026 | ✔ Completado | v59. Fix max_tokens. 98.2% OK. 400 casos |
| IA Sprint 4 | Jul–Sep 2026 | 🔧 En progreso | P1 completado. P2-P6 pendientes |

### Marketplace

| Sprint | Período | Estado | Resultado |
|--------|---------|--------|-----------|
| Sprint 0 | Ene–May 2026 | ✔ Completado | Catálogos, pedidos clásicos, proveedores preferidos |
| Phase 2A | Jun 2026 | ✔ Completado | Checkout integrado 2 pasos |
| Phase 2B | Jun–Jul 2026 | ✔ Completado | Seguimiento Realtime, timeline, historial |
| Phase 2C | Jul 2026 | ✔ Completado | Portal proveedor completo |
| MVP-1 a MVP-7 | Jul 2026 | ✔ Completado | Portal Proveedor 100% operativo |
| Sprint 2 | Sep–Oct 2026 | ⬜ Pendiente | Realtime portal, registro proveedor, email alertas |
| Fase 3 (catálogo libre) | 2026–2027 | ⬜ Futuro | Post-pilotos comerciales |

### RC-1 Commercial Readiness

| Bloque | Estado | Objetivo |
|--------|--------|---------|
| RC1-Alpha | ✔ Completado (6/8 — 2 diferidas) | Bloqueantes legales + analytics + sin "beta" |
| RC1-Beta | ▶ ACTIVO | Demo ejecutable + catálogo + onboarding proveedor |
| RC1-Gamma | ⬜ Pendiente | Conversión: ROI, tutorial in-app, emails HTML, Sentry |
| RC1-Delta | ⬜ Pendiente | Legal completo, vídeo, SEO, recordatorios trial |

---

## 11. MÉTRICAS DEL PROYECTO

| Métrica | Valor | Fecha |
|---------|-------|-------|
| Motor IA — OK rate | 98.2% | v59 · Jun 2026 |
| Motor IA — Benchmark | 400 casos | Jun 2026 |
| Motor IA — Versión producción | v59 | Jun 2026 |
| Marketplace | MVP-7 — Portal completo | Jul 2026 |
| Edge Functions desplegadas | 26 (incl. supplier-api-v1) | Jul 2026 |
| Módulos ERP | 17 módulos en producción | Jul 2026 |
| Pilotos internos completados | 1 (PZ-001A) | Jul 2026 |
| Pilotos externos completados | 0 / 4 pendientes | — |
| Bugs PZ-001A | 11 encontrados · 11 resueltos | Jul 2026 |
| Tests Vitest | 13 archivos · suite activa | Jul 2026 |
| Tests Playwright E2E | 6 archivos · suite activa | Jul 2026 |
| Analytics | ✅ Vercel Analytics — consent gate activo | Jul 2026 |
| NIF en Aviso Legal | ✅ B11792515 provisional | Jul 2026 |
| Banner de cookies | ✅ RGPD · 3 categorías | Jul 2026 |
| Supplier API v1 | ✅ 5 endpoints, Bearer auth | Jul 2026 |
| Reporting portal proveedor | ✅ KPIs, Ventas, Catálogo, Operativo, CSV | Jul 2026 |
| Clientes de pago activos | Dato pendiente (analytics desde Jul 2026) | — |
| MRR | Dato pendiente | — |
| Producción | Vercel — trabflow.com | — |
| Base de datos | Supabase — dqqjaujnulutinskmqsu (eu-central-1) | — |
| Motor IA | Anthropic Claude Haiku 4.5 | — |
| Transcripción voz | OpenAI Whisper | — |
| Email | Resend | — |
| Billing | Stripe | — |

---

## 12. REGLAS

```
REGLA-01  No comenzar Sprint 2 Marketplace hasta cerrar RC-1 completamente.

REGLA-02  No ejecutar PZ-001B antes de completar RC1-Beta.

REGLA-03  No ejecutar PZ-001C antes de completar PZ-001B.
          El aprendizaje del primer piloto informa el guión del segundo.

REGLA-04  No crear módulos nuevos durante RC-1.
          RC-1 es consolidación y madurez comercial, no expansión.

REGLA-05  No abrir funcionalidades de Sprint 2 durante pilotos.

REGLA-06  No hay dos tareas activas simultáneas en la cola principal.
          La pista paralela del Motor IA es independiente.

REGLA-07  Todo cambio en código durante RC-1 debe ser:
          (a) un fix de bug existente, o
          (b) un ítem de la lista RC1_CHECKLIST.md o RC1_BETA_PLAN.md.

REGLA-08  Toda fase terminada actualiza este EXECUTION_BOARD.

REGLA-09  Toda decisión de arquitectura requiere un ADR.

REGLA-10  La service_role key no se escribe en migraciones, repositorio,
          logs, documentación ni mensajes.

REGLA-11  Ningún commit de código sin pasar por el flujo:
          verificar tarea activa → implementar → actualizar board → commit.

REGLA-12  Toda idea nueva detectada durante una tarea se registra en
          docs/BACKLOG_FUTURO.md y NO se implementa.

REGLA-13  El orden de lectura del proyecto es:
          README → EXECUTION_BOARD → MASTER_ROADMAP → resto.
```

---

## 13. CHECKLIST DE INICIO DE SESIÓN

```
  1. Abrir EXECUTION_BOARD.md → leer § 1 ESTADO ACTUAL
  2. Leer § 4 FASE EN CURSO y § 4 tabla de tareas RC1-Beta
  3. Confirmar que la tarea sigue siendo válida
  4. Ejecutar únicamente la tarea activa
     → Si surge idea nueva: registrar en BACKLOG_FUTURO.md, no implementar
  5. Al terminar la tarea:
     a. Marcar completada en la tabla de § 4
     b. Actualizar § 11 MÉTRICAS si aplica
  6. Si se cierra una FASE:
     a. Mover a § 2 FASES TERMINADAS
     b. Actualizar § 1, § 4, § 5
     c. Actualizar docs/README.md
  7. Commit con mensaje descriptivo
```

---

*Este documento se actualiza al terminar cada tarea. Nunca al empezarla.*
*Versión 2.0 — 2026-07-31 — Actualización completa post MVP-7*
