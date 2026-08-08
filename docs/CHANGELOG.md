# TrabFlow — CHANGELOG

> Historial de cambios a nivel de producto, organizados por fase. Para el historial del Motor IA ver `docs/ai-engine/CHANGELOG.md`.

---

## B0.5 — Auditoría catálogo legacy: 891 referencias

**Período:** 2026-08-08  
**Estado:** STOP PARCIAL — entrega pre-migración ✓ (sin cambios de datos ni código)  
**Doc:** `docs/marketplace/RC1_C4B_CATALOG_AUDIT.md`

### Resultados del análisis

| Categoría | Count | % |
|-----------|-------|---|
| A_MARKETPLACE_READY (listos hoy) | 18 | 2.0% |
| B_MARKETPLACE_MAPPABLE (solo promoción) | 1 | 0.1% |
| C_UP_REQUIRED (necesitan UP + offering) | 653 | 73.3% |
| D_LEGACY_DUPLICATE (HVAC de marca — correcto como legacy) | 186 | 20.9% |
| E_NON_MARKETPLACE (herramientas, EPIs) | 33 | 3.7% |
| **TOTAL** | **891** | 100% |

**Cobertura catálogo → Marketplace: 2.7%** (18/672 productos comerciales)

### Hallazgos clave

- Solo Obras y Materiales S.L. tiene actor Marketplace activo; los otros 12 proveedores no tienen actor
- Los 160 obramat `pending_review` tienen offering pero 159 sin UP vinculado → reclasificados como C_UP_REQUIRED
- 15 productos obramat son candidatos a mapeo rápido a UPs existentes (validación humana pendiente)
- Falso positivo detectado: OBR-ELE-011 (enchufe estándar) ≠ UP "schuko IP44"
- Para alcanzar cobertura ≥50% se requiere incorporar Saltoki al Marketplace (170 productos)

### Propuesta de migración (pendiente aprobación)

- **Inmediato:** promover OBR-FON-010 (B→A), validar 15 candidatos, crear ~65 UPs para obramat → cobertura ~26%
- **Diferido:** actores + UPs + offerings para 6 proveedores (494 productos) → cobertura >60%
- **Sin acción:** 186 HVAC legacy + 33 herramientas/EPIs

---

## RC1-C.4A — Unificación de catálogo: Presupuesto ↔ Marketplace

**Período:** 2026-08-08  
**Commits:** `63c40f4` (FASE A) + post-A10  
**Estado:** COMPLETADO ✓ — solo datos, sin cambios de código  
**Docs:** `docs/marketplace/RC1_C4A_*.md` (6 documentos)

### Resultados

| Métrica | Antes | Después |
|---------|-------|---------|
| Cobertura demo (Presupuesto → Marketplace) | 0/27 (0%) | 23/27 (85%) |
| UPs en catálogo | 37 | 43 (+6) |
| Offerings matched | 58 | 70 (+12) |
| Falsos positivos | — | 0 |

### Cambios aplicados

**BD (solo datos — sin DDL excepto columna search_aliases):**
- Migración `20260808_01`: columna `search_aliases text[]` + `create_cart_from_quote` mejorado (PATH 3 alias match, eliminado fallback familia que generaba falsos positivos)
- Actor renombrado: "OBRAMAT Demo" → "Obras y Materiales S.L." (slug `obramat-demo` y `supplier_key='obramat'` sin cambio)
- 11 UPs actualizados con aliases fuertes (≥8 chars, diferenciación suelo vs pared)
- 6 UPs nuevos: silicona sanitaria, kit fontanería baño, interruptor IP44, pulsador IP44, mueble 80cm, kit cajas empotrar eléctrico
- 12 offerings nuevas promovidas a `matched` (todas pasaron por `pending_review`)
- Decisión de diseño: interruptor IP44 y pulsador IP44 son UPs separados

**Sin cambios de código:** `create_cart_from_quote` es la migración SQL, no código TypeScript. No se modificó `resolveQuoteMaterialCandidates`, motor IA, checkout ni carrito.

---

## RC1-B.1 — Marketplace en Navegación Privada y Web Pública

**Período:** 2026-08-04  
**Build:** ✓ TypeScript limpio · Vite build exitoso  
**Estado:** IMPLEMENTADO ✓  
**Doc:** `docs/marketplace/RC1_B1_MARKETPLACE_ENTRYPOINTS.md`

### Entrada A — Panel instalador (privado, `/app/marketplace`, mode=professional)

- **Sidebar desktop:** botón "Marketplace" ahora visible para todos con `catalog.manage` (sin condición `orgId`); estilo coherente con `SidebarBtn`; `data-testid="nav-marketplace"`
- **Mobile bottom bar:** botón "Marketplace" reemplaza "Clientes" para usuarios con `catalog.manage`
- Ambos navegan a `ActivePage.Marketplace` (ruta `/app/marketplace`)

### Entrada B — Web pública (anónima, `/marketplace`, mode=public)

- Nuevo `ActivePage.MarketplacePublico` → ruta `/marketplace`
- Enlace "Marketplace" añadido a `Header.tsx` (entre Funciones y Asistente IA) y `Navbar.tsx` (LandingPage)
- Accesible sin login: incluido en `PUBLIC_OR_AUTH_PAGES`; detectado en `detectAuthRoute()`

### Carrito de visitante (guest cart)

- `CarritoProvider`: cuando `orgId=null`, persiste en `localStorage['trabflow:marketplace:guest-cart']`
- Al hacer login (orgId null→valor): fusión automática guest cart + org cart (sin duplicar por `offeringId`)
- Al cerrar sesión (orgId valor→null): recupera el guest cart guardado

### Checkout dual

- Modo público: botón carrito "Identificarte para continuar" (activo, azul) → guarda `sessionStorage['mk_return']` → login
- Modo profesional: botón "Continuar al pago" (deshabilitado, RC1-C pending)
- Post-login con `mk_return`: `routeSession()` detecta la clave y redirige a `ActivePage.Marketplace` en lugar de `AppDashboard`

### Archivos modificados

`src/types.ts` · `src/App.tsx` · `src/components/Header.tsx` · `src/components/landing/Navbar.tsx` · `src/components/marketplace/ScreenMarketplace.tsx` · `src/components/marketplace/CartSidebar.tsx` · `src/context/CarritoProvider.tsx` · `src/components/AppDashboardView.tsx`

---

## PRE-RC1 — Expansión Catálogo Demo Multioficio (Etapa 1: L0–L3)

**Período:** 2026-08-04  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)  
**Estado:** ETAPA 1 COMPLETADA ✓ — Etapa 2 (offerings) bloqueada hasta aprobación humana  
**Batch:** `PRE_RC1_MULTITRADE_001`

### L0 — Snapshot pre-ejecución · 2026-08-04

- Auditoría completa: 22 UPs validated, 3 actores, 17 catálogos, 230 offerings
- Confirmación de ausencia de conflictos: 4 supplier_keys, 4 slugs, 9 categorías, 14 nombres canónicos
- Decisión de identidad: `org_id=NULL` para catálogos de plataforma — confirmada por precedente OBRAMAT/STN
- Doc: `docs/marketplace/PRE_RC1_DEMO_L0_SNAPSHOT.md`

### L1 — 4 catálogos + 4 actores demo · 2026-08-04

- `ElectroSuministros Cantábrico S.L.` — actor `fba14bb4`, catálogo `498a2e63`, oficio electricidad
- `Revestimientos y Obra Norte S.L.` — actor `ce5c781d`, catálogo `6ea37e62`, oficio albanileria
- `Pinturas Profesionales del Norte S.L.` — actor `d8f0bf84`, catálogo `5c72b86b`, oficio pintura
- `Carpintería y Cerramientos Norte S.L.` — actor `0464ae2d`, catálogo `9907af28`, oficio carpinteria
- Todos: `estado='active'`, `verificado=FALSE`, `org_id=NULL`, metadata `_demo=true, _demo_dataset='PRE_RC1_MULTITRADE_001'`
- Doc: `docs/marketplace/PRE_RC1_DEMO_L1_IDENTITY_RESULTS.md`

### L2 — Categoría Revestimientos · 2026-08-04

- `Revestimientos` (slug `alba-revestimientos`, oficio `albanileria`) — id `eb5da908`
- Total categorías: 27 (+1)
- Doc: `docs/marketplace/PRE_RC1_DEMO_L2_CATEGORIES_RESULTS.md`

### L3 — 14 UPs draft + 7 variantes · 2026-08-04

- Albañilería (5): Membrana impermeabilizante, Cemento cola C2, Junta de alicatado, Baldosa porcelánica 60×60, Azulejo rectificado pared
- Pintura (2): Pintura plástica anti-humedad, Imprimación selladora
- Electricidad (4): Luminaria baño LED IP44, Extractor baño temporizado, Cable H07V-K 1,5mm², Enchufe schuko IP44
- Carpintería (3): Puerta de paso ciega, Mueble bajo lavabo 60cm, Espejo con luz LED
- 7 variantes: Membrana (2), Baldosa (2), Cable (3 colores normativos)
- Todas `validation_state='draft'` — invisibles en Marketplace hasta aprobación
- Etiqueta `_batch='PRE_RC1_MULTITRADE_001'` en todas las UPs y variantes para rollback selectivo
- Doc: `docs/marketplace/PRE_RC1_DEMO_L3_UP_RESULTS.md`

**STOP — L4+ bloqueado. Aprobación requerida en `docs/marketplace/PRE_RC1_DEMO_UP_REVIEW_MATRIX.md`.**

---

## PRE-RC1 — PASOS 0–8 — Onboarding de proveedores: fix completo

**Período:** 2026-08-03  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)  
**Estado:** O-1 a O-8 COMPLETADOS · 0 errores TypeScript en src/

### O-Bug — Fix RPCs gen_random_bytes + RPC preview · 2026-08-03 · migración 20260803_01

- `create_marketplace_invitation`: corregido `gen_random_bytes` → `extensions.gen_random_bytes(32)`
- `resend_supplier_invitation`: mismo fix
- Nueva función `preview_marketplace_invitation(p_token text)` — SECURITY DEFINER sin auth; devuelve estado + datos públicos de la invitación

### O-2 — Revocación invitación defectuosa STN · 2026-08-03

- Invitación `28945f54-0668-4d61-b11d-d773640f6f11` → `estado='revoked'`
- Motivo: `manual_insert_without_recoverable_raw_token` — no se podía recuperar el rawToken para el enlace

### O-3 — Ruta /aceptar-invitacion · 2026-08-03

- `ActivePage.MarketplaceInvitationAccept` añadido a `src/types.ts`
- `PAGE_PATHS`, `detectAuthRoute()`, `AUTH_FLOW_PAGES`, `PUBLIC_OR_AUTH_PAGES` actualizados en `App.tsx`
- `previewMarketplaceInvitation` + `InvitationPreview` añadidos a `src/lib/api/marketplace-actors.ts`

### O-4/O-5/O-6 — Componente MarketplaceInvitationAcceptView · 2026-08-03

- Nuevo: `src/components/auth/MarketplaceInvitationAcceptView.tsx`
- 11 estados: validating, unauthenticated, authenticated, accepting, accepted, email_pending, expired, revoked, already_accepted, invalid_token, error
- Flujo nuevo usuario: signup con email bloqueado + password → `supabase.auth.signUp` → accept
- Flujo usuario existente: login con email bloqueado → `signInWithPassword` → accept
- Manejo email_pending: confirmación de email requerida por Supabase → muestra aviso + switch a modo login
- Seguridad: email bloqueado al de la invitación, rawToken nunca almacenado

### O-7 — Texto UI invitaciones · 2026-08-03

- `PortalEquipo.tsx`: "Copiar enlace" → "Copiar enlace de invitación" en InvitationRow

### O-8 — Tab Portal en AdminSuppliersSection · 2026-08-03

- `AdminSuppliersSection.tsx`: nuevo tab "🏪 Portal" para proveedores con actor de marketplace vinculado
- Carga roles dinámicamente desde `trade_marketplace_roles`
- Genera enlace de invitación mediante `create_marketplace_invitation` RPC
- Fernando (platform_super_admin) puede crear invitaciones para cualquier proveedor desde el admin

---

## PRE-RC1 — PASOS 0–3 — Preparación para Marketplace RC1

**Período:** 2026-08-03  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)  
**Estado:** PASOS 0–2 COMPLETADOS · PASO 3 completado · Pendiente: matching admin STN

### PASO 0 — Limpieza código muerto · 2026-08-03 · commit 6a187e7

- `StepMateriales.tsx` eliminado (372 líneas — 0 importadores externos)
- `StepComparar.tsx` eliminado (375 líneas — 0 importadores externos)
- Build TypeScript `src/` sin errores tras la eliminación

### PASO 1 — Migraciones SQL · 2026-08-03

**B05 — Constraints de carrito ampliados:**
- `chk_cart_source`: añadidos `'free'` y `'reorder'` → desbloquea `create_cart()` para compra libre
- `chk_cart_estado`: añadido `'saved'` → habilita guardar carritos sin checkout

**B01 — Overload 3-param eliminado:**
- `DROP FUNCTION ship_supplier_order(uuid, text, text)` — overload bugado (no guardaba `tracking_ref`)
- Solo permanece el overload de 5 params (correcto: guarda tracking, tracking_url, notas, outbox)

### PASO 2 — Segundo proveedor demo · 2026-08-03

**Proveedor creado:** Suministros Técnicos Norte S.L. (STN)

| Recurso | ID |
|---|---|
| Catálogo | `1aec572f-d22c-4556-9fbf-315ec7b3ba02` |
| Actor | `aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9` |
| Invitación | `28945f54-0668-4d61-b11d-d773640f6f11` |
| API credential | `98b40e78-4334-476b-9ae9-bdcaf081212b` |
| Import (12 offerings) | `d82b640d-b3e2-4946-9901-6b4fd28f4948` |

**Import:** 12 offerings de fontanería importadas vía Supplier API v1, todas `pending_review`  
**Estado catálogo:** 21 matched + 209 pending_review (197 OBRAMAT + 12 STN)  
**Pendiente:** matching admin de las 12 offerings STN en el panel

### PASO 3 — Fixes TypeScript · 2026-08-03

- `bulkShipSupplierOrders`: reemplazado `shipSupplierOrder` (3-param) por `shipMarketplaceOrderWithTracking`
- `PortalPedidoSlideOver.doShip`: ahora pasa `notas` a `shipMarketplaceOrderWithTracking`
- `CartSourceType`: añadidos `'free'` y `'reorder'`
- `CartEstado`: añadido `'saved'`; `'reviewing'` y `'checkout'` marcados como deprecated

---

## MKT-FASE1-PILOT-002 — ETAPAs 1–7 + E2E — Validación funcional puente Motor IA → Marketplace

**Período:** 2026-08-01 / 2026-08-02  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)  
**Estado:** ✅ COMPLETADO — 7 ETAPAs · 8/8 tests SQL · E2E PASS · MKT-000004 delivered

### C-007 — Matching humano + E2E (ETAPA 7) · 2026-08-02

#### FASE 7.1 — Revisión humana de 5 offerings

| supplier_ref | offering_id | UP vinculado | confidence | Resultado |
|---|---|---|---|---|
| DEMO-FON-COC-001 | `8c1d6a96` | `145d1eaa` (Grifo monomando cocina) | 0.95 | ✅ Aprobado |
| DEMO-FON-CU15-001 | `8074998c` | `e1b76491` (Tubo cobre 15mm) | 0.95 | ⚠️ Rechazado → D-2 → Aprobado |
| DEMO-FON-VSEG-001 | `d096d75a` | `6056ea3d` + `3154a350` (Válvula 3/4" 3bar) | 0.97 | ✅ Aprobado |
| DEMO-FON-PDR-001 | `a7ceb134` | `54777b80` + `5b05a4c5` (Plato ducha 80×80) | 0.97 | ✅ Aprobado |
| DEMO-FON-C15-001 | `8282bef1` | `74d6d138` + `744865cb` (Codo 90° 15mm) | 0.95 | ✅ Aprobado |

D-1: `match_method='admin'` (CHECK constraint). Contexto en audit_log event_data.  
D-2: CU15-001 actualizada via Supplier API v1 a unidad `ml`, precio/metro (coste=1.83, venta=2.97, stock=144). import_id: `6737462f`.

#### FASE 7.2 — Binding atómico

- 5/5 offerings bindeadas con `match_state='matched'`, `match_method='admin'`
- PL/pgSQL con guards: id exacto + supplier_ref + match_state=pending_review + UP IS NULL + actor OBRAMAT
- Pre-verificación: variante activa + UP validated. RAISE EXCEPTION → rollback si falla.
- 5 eventos audit_log `match_review_approved` con review_type='human_reviewed'

#### FASE 7.3 — Tests funcionales SQL (8/8 PASS)

- TEST-01 a 05: Level 0-A (structured_variant) y 0-B (structured_product). 5/5 offerings resueltas.
- TEST-06: UP sin offering → selected_offering_id=NULL ("Sin proveedor disponible") ✅
- TEST-07: Regresión PZ-001A — 16 cart items intactos, confidence=0.900, 0 contaminación ETAPA 7 ✅
- TEST-08: Multi-proveedor — algoritmo determinista (stock→conf→precio→plazo) ✅

#### FASE 7.4 — E2E Real (MKT-000004)

- **Presupuesto:** PRE-2026-084 (`ece04ef8`) — 3 partidas: grifo cocina + válvula + codo 5 ud
- **Carrito:** `9c245ffd` — Level 0-B (grifo) + Level 0-A (válvula + codo) · 3 cart_items · 0 "Sin proveedor"
- **Checkout:** `checkout_cart` → pedido único MKT-000004 (`540d5f5e`) · subtotal=58.25 · envío=8.50 · total=66.75
- **Portal Proveedor:** pending→confirmed (21:24:47) → preparing (21:24:57) → shipped (21:25:07) · tracking=MKT-PILOT-002-TRACK
- **Recepción:** delivered (21:25:34) · completed_at=21:25:34 · 5 eventos historial
- **Integridad post-E2E:** 10/10 checks PASS · 197 pending_review intactas · PZ-001A intacto · 0 duplicados

### C-001 — DDL trade_quote_items (ETAPA 1) · commit `2ae619c`

- Añadidas 3 columnas `uuid NULLABLE ON DELETE SET NULL` a `trade_quote_items`: `global_catalog_id`, `universal_product_id`, `universal_variant_id`
- 3 índices parciales `WHERE IS NOT NULL` para rendimiento en filtros FK
- Tipos TypeScript actualizados en `src/supabase.gen.ts` y `src/lib/supabase.ts` (`TradeQuoteItem`, `saveQuote` Pick type)

### C-002 — Motor IA batch resolution (ETAPA 2) · commit `d445651`

- `resolveMarketplaceIds` en `trade-voice-to-quote`: máximo 2 queries adicionales por presupuesto (anti-N+1)
- Reglas A (UP directo, conf=1.0), B (variante activa), C (sin mapping, sin excepción)
- 4 métodos de log estructurado sin PII
- 14/14 tests vitest: 9 escenarios A–G + 5 benchmarks (BENCH-1 a BENCH-5)
- Benchmark BENCH-4: 20 gc_ids + 10ms latencia simulada → ~20ms (2 roundtrips vs ~400ms con N+1)
- Deploy: `trade-voice-to-quote` v70 (producción)

### C-003 — Level 0 create_cart_from_quote (ETAPA 3) · commit `e279bd5`

- `create_cart_from_quote` ampliada con Level 0 antes de levels legacy (1-3 intactos)
- Level 0-A: `universal_variant_id` → variante activa + UP validated (conf=1.0)
- Level 0-B: `universal_product_id` → UP validated (conf=1.0)
- Level 0-C-1: `global_catalog_id` → UP directo validated (conf=1.0)
- Level 0-C-2: `global_catalog_id` → variante → UP validated (conf=1.0)
- Métodos especiales: `product_not_validated`, `structured_id_invalid`, `no_match`
- 10/10 tests SQL PASS · rollback disponible: `C003_ROLLBACK_create_cart_from_quote_pre_level0.sql`

### C-006 — Carga 5 offerings OBRAMAT Demo (ETAPA 6) · 2026-08-02

- 5 offerings cargadas via Supplier API v1 (endpoint `POST /catalog/upsert`, Bearer auth `tsf_v1_*`)
- Actor: OBRAMAT Demo (`85e73234-c74e-44e7-865a-1aca8312f9a5`), catálogo `obramat-demo`
- Todos en `match_state='pending_review'`, `universal_product_id=NULL` (matching no ejecutado)
- `import_id: 67c8103d-1b4c-4541-b6f0-0ef713eac358` · `filas_ok=5` · `filas_error=0`
- Bug fix: `api_sync_catalog_offerings` — `encode(gen_random_bytes(8),'hex')` → `replace(gen_random_uuid()::text,'-','')` (schema `extensions` inaccesible con `SET search_path TO 'public'`)
- Migración local: `supabase/migrations/20260802_01_fix_api_sync_catalog_gen_random_bytes.sql`
- Postvalidaciones 7/7 OK: 5 nuevas offerings, 5 refs únicas, 0 duplicados, 0 sync errors, 213 offerings previas intactas

| supplier_ref | offering_id | descripcion_comercial | precio_coste | precio_venta | unidad | stock | estado |
|---|---|---|---|---|---|---|---|
| DEMO-FON-C15-001 | `8282bef1` | Codo 90° cobre soldadura capilar 15mm | 0.95 | 1.65 | ud | 120 | pending_review |
| DEMO-FON-COC-001 | `8c1d6a96` | Grifo monomando cocina cano alto giratorio cromado | 45.00 | 68.00 | ud | 12 | pending_review |
| DEMO-FON-CU15-001 | `8074998c` | Tubo cobre rigido 15mm barra 3m | 5.50 | 8.90 | barra | 48 | pending_review |
| DEMO-FON-PDR-001 | `a7ceb134` | Plato de ducha resina 80x80cm blanco mate | 85.00 | 135.00 | ud | 6 | pending_review |
| DEMO-FON-VSEG-001 | `d096d75a` | Valvula de seguridad 3/4 pulgada 3 bar laton | 8.50 | 13.90 | ud | 25 | pending_review |

### C-005 — Validación sin offerings ETAPA 5 (ETAPA 5) · 2026-08-02

- Tests 3–11 ejecutados sobre producción (SQL simulation, 0 offerings cargadas para el lote)
- 27/27 sub-checks PASS: Level 0-A/B (variante y UP sin offering), legacy fallback intacto, mano_de_obra excluida, regresión PZ-001A sin degradación, UP draft → product_not_validated, IDs incoherentes → structured_id_invalid, gc sin UP → no_match sin invención, batch 20 líneas → 2 queries confirmado
- Integridad post-tests: 22 UPs · 213 offerings · 0 residual · 16 cart items PZ-001A intactos
- Resultados completos: `docs/marketplace/MKT_FASE1_PILOT_002_STAGE5_RESULTS.md`

### C-004 — Promoción 16 UPs draft → validated (ETAPA 4) · 2026-08-02

- Dry run §DR-1 a §DR-11g ejecutado y 100% OK
- Corrección §DR-11g: umbral `≥21` reemplazado por 6 sub-checks explícitos (5+15+20 lote + 1 PZ-FON-001 + 21 piloto completo + 0 solapamientos)
- UPDATE promovió exactamente 16 UPs del lote `MKT_FASE1_PILOT_001` de `draft` a `validated`
- Postvalidaciones 7/7 OK: 16 validated, 0 draft, 6 preexistentes intactos, 15 variantes activas, 0 modificaciones externas
- Level 0 en `create_cart_from_quote` resuelve correctamente los 16 UPs (16/16 por Level 0-B; 5/16 también por Level 0-C directo)
- 0 offerings matched dependientes antes de la promoción

### Incidencias

| Incidencia | Causa | Corrección |
|---|---|---|
| §DR-11g — REVISAR (cobertura 20 vs umbral ≥21) | Umbral estimado en el script era off-by-one; arquitectura lote correcta (5 directos + 15 variantes = 20 únicos) | §DR-11g reemplazado por 6 sub-checks exactos; script `MKT_FASE1_PILOT_002_VALIDATE_BATCH_UPS.sql` actualizado a v2.1 |
| ETAPA 6 — 500 INTERNAL_ERROR en Supplier API v1 | `api_sync_catalog_offerings` con `SET search_path TO 'public'` no puede acceder a `gen_random_bytes` (schema `extensions`). Error detectado al llamar `POST /catalog/upsert`. | Reemplazado `encode(gen_random_bytes(8),'hex')` por `replace(gen_random_uuid()::text,'-','')`. Fix en producción via MCP + migración local `20260802_01`. |

---

## MKT-FASE1-PILOT-001 — Puente gc → UP → Marketplace (fontanería)

**Fecha:** 2026-08-01  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)  
**Tipo:** Migración de datos + DDL

### Descripción

Primera migración del puente entre `trade_global_catalog` y `trade_marketplace_universal_products`. Procesa 40 registros de fontanería clasificados manualmente: 19 partidas no comerciales (sin acción), 15 variantes en 11 UPs padre genéricos, 5 UPs directos, 1 UPDATE a UP preexistente.

### DDL aplicado

- **`MKT_FASE1_PILOT_001_DDL.sql`** — Columna `global_catalog_id uuid REFERENCES trade_global_catalog(id) ON DELETE SET NULL` en `trade_marketplace_universal_product_variants`. Índice UNIQUE parcial `uq_variant_global_catalog_id WHERE global_catalog_id IS NOT NULL`.
- **`MKT_FASE1_PILOT_001_VARIANT_IDENTIFIERS_FIX.sql`** — Reemplaza constraints `UNIQUE NULLS NOT DISTINCT` en `ean` y `gtin` por índices únicos parciales `WHERE ean IS NOT NULL` / `WHERE gtin IS NOT NULL`. Permite múltiples variantes sin EAN/GTIN sin generar identificadores ficticios.

### DML aplicado

- **`MKT_FASE1_PILOT_001_v4.sql`** — 10 pre-validaciones (0-A a 0-K), 12 post-validaciones (7-A a 7-L), transacción única. `origen = 'global_catalog'`, batch identificado por `especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'`.

### Conteos antes → después

| Tabla | Antes | Después | Delta |
|---|---|---|---|
| `trade_marketplace_universal_products` | 6 | 22 | +16 |
| `trade_marketplace_universal_product_variants` | 0 | 15 | +15 |
| `trade_marketplace_categories` | 25 | 26 | +1 |

### Incidencias y correcciones

| Incidencia | Causa | Corrección |
|---|---|---|
| `chk_up_origen` rechazó `'pilot_fontaneria_2026_08_01'` | El CHECK solo admite valores de procedencia funcional (`global_catalog`, `supplier_import`, etc.) | `origen = 'global_catalog'`; batch en `especificaciones` jsonb; pre-validación 0-K añadida |
| `uq_variant_ean UNIQUE NULLS NOT DISTINCT` bloqueó 2ª variante sin EAN | PG 15+ `NULLS NOT DISTINCT` trata todos los NULL como iguales | Constraints eliminados; reemplazados por índices únicos parciales `WHERE IS NOT NULL` |

### Cobertura gc final

- Directos (gc → UP): 6/6
- Variantes (gc → variant): 15/15
- NC excluidos: 19/19 sin relación marketplace
- Total: 40/40 registros procesados

### Verificación de integridad

7/7 checks OK: sin gc_id duplicados, sin category_id nulos, sin variantes huérfanas, sin duplicados lógicos, sin NC con relación marketplace, sin registros ajenos modificados.

### Rollback disponible

`docs/marketplace/sql/MKT_FASE1_PILOT_001_ROLLBACK_v4.sql` — válido mientras no se carguen UPs adicionales del mismo origen.

---

## RC1-Alpha — Commercial Readiness, Bloque 1

**Período:** Julio 2026

### RC1-C04-C — Auditoría documental + sincronización documentación viva (2026-07-29)

- Auditoría completa de 50+ documentos estratégicos del proyecto — 22 hallazgos clasificados CRÍTICO/ALTO/MEDIO/BAJO
- `docs/EXECUTION_BOARD.md`: 3 métricas actualizadas (❌→✅ NIF, cookies, analytics); ficha RC1-C04-C añadida; tabla RC1-Alpha actualizada
- `docs/RC1_CHECKLIST.md`: resumen ejecutivo corregido — Legal y Cumplimiento 5 completados (era ~0); Analytics 1 completado (era 0); totales CRÍTICOS actualizados
- `docs/00_MASTER_ROADMAP.md`: "beta testers" → "usuarios piloto"; hito "Beta" → "Programa Piloto"; "Fase 2 ACTIVA" con nota RC-1; "Prioridades actuales" con referencia a RC-1
- `docs/TRADEFLOW_OS.md`: título TRADEFLOW→TRABFLOW; versión 1.0→1.1; 15 instancias "beta tester(s)" → "usuario(s) piloto"; "Beta cerrada" → "Piloto controlado"; dashboard CEO "BETA" → "PILOTOS"
- `docs/02_IMPLEMENTATION_MASTER_PLAN.md`: nota en Fase 2 indicando que está siendo gestionada como RC-1 Commercial Readiness
- `docs/README.md`: nueva fila PRODUCT_LANGUAGE.md en tabla Design System; regla de uso actualizada; estado del producto actualizado
- `docs/01_TRABFLOW_CONSTITUTION.md`: §7.4 referencia dual PRODUCT_LANGUAGE_v1 (UI/UX) + PRODUCT_LANGUAGE.md (comercial)
- `docs/design-system/PRODUCT_LANGUAGE_v1.md`: sección "Alcance de este documento" añadida al final con referencia al nuevo PRODUCT_LANGUAGE.md
- `docs/RC1_COMMERCIAL_READINESS.md`: header snapshot histórico con ítems resueltos (RC1-C01 a RC1-C04-B)
- `docs/RC1_MVP_ELEMENTS.md`: header snapshot histórico; ítems NIF, domicilio y narrativa beta marcados como ✅ RESUELTO
- `docs/PILOT_ZERO_PLAN.md`: Estado: Activo → COMPLETADO
- `docs/07_GO_TO_MARKET.md`: "beta testers" → "usuarios piloto"
- `docs/marketplace/TRABFLOW_MARKETPLACE_MASTER_PLAN.md`: "Beta privada" → "Programa piloto controlado" en timeline 2026
- `docs/marketplace/MARKETPLACE_RESOURCE_SCENARIOS.md`: "Beta privada" → "Piloto controlado" en tabla de fases

### RC1-C04-B — Consolidación lenguaje comercial (2026-07-28)

- Creado `docs/PRODUCT_LANGUAGE.md` — guía oficial de lenguaje para 6 audiencias (instaladores, distribuidores, asociaciones, fabricantes, inversores, programa piloto)
- Eliminadas 25 referencias a "beta privada", "beta tester", "versión beta", "en pruebas", "puede tener errores" y similares en 9 archivos fuente
- `src/components/Footer.tsx`: badge "Beta privada" → "Despliegue controlado · Programa piloto activo"; "Acuerdo beta" → "Condiciones del piloto"
- `src/components/landing/HeroSection.tsx`: "Beta abierta — Únete gratis hoy" → "Acceso anticipado — Empieza gratis hoy" (desktop + móvil)
- `src/components/landing/BetaSection.tsx`: "Únete a la beta privada" → "Solicita tu acceso anticipado"; fix typo "TradeFlow" → "TrabFlow"
- `src/components/RegistroView.tsx`: eliminado badge 🚧 "Versión Beta — En pruebas"; card "puede tener errores" → "Actualizaciones semanales"; "Beta tester" → "usuario piloto"; precios "Gratis en Beta" → "3 meses gratuitos"
- `src/components/OnboardingWizard.tsx`: "durante la Beta" → "durante tu período de prueba" (4 lugares)
- `src/components/LegalViews.tsx`: página /beta reescrita — "Beta Privada" → "Programa Piloto Controlado"; "acceso a la beta" → "acceso a la plataforma"; "Acuerdo Beta Privada" → "Condiciones del Programa Piloto"
- `src/components/HomeView.tsx`: "Beta activa" → "Programa piloto" (social proof badge)
- `src/components/ComoFuncionaView.tsx`: "BETA-" → "PRES-" en número de presupuesto demo
- `src/components/partner-demo/DemoFinal.tsx`: "Gratis en beta" → "Período de prueba gratuito"

### RC1-C04-A — Vercel Analytics con consent gate (2026-07-28)

- Instalado `@vercel/analytics@2.0.1`
- Creado `src/components/AnalyticsManager.tsx` — activa Vercel Analytics solo si `categories.analytics = true`
- Creado `docs/ANALYTICS_ARCHITECTURE.md` — arquitectura completa de 4 capas para los próximos 2 años
- Catálogo de ~50 eventos definidos (no implementados) agrupados en 9 módulos
- BI KPIs de negocio documentados (tiempos, tasas, uso IA) con fuente en Supabase

### RC1-C03 — Sistema de consentimiento de cookies RGPD (2026-07-28)

- Creado `src/context/CookieConsentContext.tsx` — contexto + hook + storage
- Creado `src/components/CookieBanner.tsx` — banner + panel de preferencias
- Categorías: Esenciales (siempre on) / Analíticas / Marketing
- Persistencia: `localStorage['trabflow_cookie_consent']` versión 1
- Compatible con Consent Mode v2, GA4, Clarity, Meta Pixel
- Añadido enlace "Configurar preferencias" en Footer
- `index.html`: Consent Mode v2 por defecto denegado

### RC1-C02 — Domicilio social provisional en Aviso Legal (2026-07-28)

- `src/components/LegalViews.tsx`: "Paseo de la Castellana 124, Madrid" → C/ Las Varas 69, Castillo Pedroso, Cantabria
- Domicilio provisional hasta inscripción definitiva en Registro Mercantil

### RC1-C01 — NIF provisional en Aviso Legal (2026-07-28)

- `src/components/LegalViews.tsx`: `[PENDIENTE]` → `B11792515`
- NIF ficticio provisional. Reemplazar con NIF de Hacienda cuando esté disponible.

---

## PZ-001A — Piloto Zero Interno (2026-07-26/27)

- 2 ciclos de pedido Marketplace completados (MKT-000001, MKT-000002)
- Ciclo E2E MKT-000002: ~3 minutos (confirmar → recibido)
- 11 bugs encontrados y resueltos
- 5 mejoras UX implementadas
- Ver: `docs/pilot/PZ001A_COMPLETED.md`

---

## Fase 2 — Marketplace Phase 2 (Jun–Jul 2026)

- Checkout integrado (wizard 2 pasos, auto-selección proveedor)
- Seguimiento Realtime (Supabase Realtime, timeline animado)
- Portal proveedor completo (dashboard IA, pedidos, catálogo, equipo, config)
- Design System v1 y Product Language v1

---

## Fase 1 — ERP Base + Motor IA (Ene–Jun 2026)

- ERP: presupuestos, facturas, clientes, trabajos, ruta, equipo, roles, contratos SAT
- Motor IA: v1 → v59. 98.2% OK rate. Benchmark 400 casos.
- Stripe billing con trial 3 meses
- Onboarding wizard 7 pasos
- Chatbot de ayuda, Asistente técnico normativa
- Admin Panel
- Push notifications, PWA instalable
