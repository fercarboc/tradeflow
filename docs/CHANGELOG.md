# TrabFlow — CHANGELOG

> Historial de cambios a nivel de producto, organizados por fase. Para el historial del Motor IA ver `docs/ai-engine/CHANGELOG.md`.

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
