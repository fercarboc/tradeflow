# TrabFlow — CHANGELOG

> Historial de cambios a nivel de producto, organizados por fase. Para el historial del Motor IA ver `docs/ai-engine/CHANGELOG.md`.

---

## MKT-FASE1-PILOT-002 — ETAPAs 1–4 — Validación funcional puente Motor IA → Marketplace

**Período:** 2026-08-01 / 2026-08-02  
**Supabase:** dqqjaujnulutinskmqsu (eu-central-1)  
**Estado:** ETAPAs 1–4 completadas · ETAPA 5 pendiente autorización

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
