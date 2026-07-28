# TrabFlow — CHANGELOG

> Historial de cambios a nivel de producto, organizados por fase. Para el historial del Motor IA ver `docs/ai-engine/CHANGELOG.md`.

---

## RC1-Alpha — Commercial Readiness, Bloque 1

**Período:** Julio 2026

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
