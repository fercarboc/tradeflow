# TrabFlow — Implementation Master Plan

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Refleja el estado real del repositorio en julio 2026.  
**Propósito:** Responder tres preguntas: ¿Qué queda por desarrollar? ¿En qué orden? ¿Por qué?

---

## Estado de partida (julio 2026)

### Lo que existe y funciona

El sistema tiene un núcleo ERP completo en producción, un motor IA en producción con 98.2% de éxito, y un Marketplace con las tres fases de UX terminadas (checkout, seguimiento, portal proveedor). El producto es funcional pero necesita consolidación antes de escalar.

### Deuda técnica heredada

| Deuda | Impacto | Prioridad |
|---|---|---|
| `AppDashboardView.tsx` — 10.617 líneas | Bugs difíciles de aislar, onboarding lento de nuevos devs | Post-PMF |
| `src/lib/supabase.ts` — 3.987 líneas | Idem | Post-PMF |
| `supabase.gen.ts` desactualizado (faltan tipos de RPCs de Marketplace) | 67 `as any` en código | Antes Sprint 2 |
| Sin staging separado de producción | Toda migración va directo a prod | Antes Sprint 2 |
| Sin CI/CD automatizado | Riesgo de regresión en cada despliegue | Antes Sprint 2 |
| App móvil (Expo) con cobertura mínima | Churn en usuarios de campo | 2027 |
| `e2e/.auth/*.json` en repositorio (sesiones de Playwright) | Riesgo de seguridad menor | Inmediato |

---

## Fase 0 — Base ERP + Motor IA

**Estado: COMPLETADA**  
**Período:** Enero–Junio 2026

### Qué se construyó

**ERP core:**
- Presupuestos (voz, foto, manual) con PDF automático y envío por WhatsApp
- Facturas con vista pública por token
- Clientes con historial completo
- Trabajos con planificación y partes de trabajo firmados digitalmente
- Equipo con roles y permisos
- Contratos de mantenimiento SAT con facturación automática
- Ruta del día optimizada
- Subcontratas (plan empresa_plus)

**Motor IA:**
- `trade-voice-to-quote` v59 — transcripción (OpenAI Whisper) + extracción de partidas (Claude Haiku)
- Base de conocimiento de 20+ oficios en `trade_actuaciones`
- Sistema de validación con benchmark de 400 casos
- `AdminAIValidationSection` — centro de validación con versiones, benchmarks, runs

**Infraestructura:**
- Onboarding wizard de 7 pasos
- Sistema de suscripciones y billing con Stripe (trial 3 meses)
- Asistente técnico de normativa (REBT, RITE, CTE, AEAT, SS, DGT)
- Notificaciones push (Web Push / VAPID)
- Chatbot de ayuda (Claude Haiku)
- Panel de administración de plataforma

**Catálogos:**
- Catálogos de proveedor con búsqueda semántica
- Aprendizaje implícito de proveedores preferidos
- Panel de comparación de precios entre proveedores
- Pedidos de material (flujo clásico, pre-Marketplace)

**Por qué en esta fase:**  
Sin ERP core, el Marketplace no tiene valor — el instalador necesita primero tener un presupuesto que comprar. El motor IA es la ventaja competitiva central y debe estar validado antes de escalar usuarios.

---

## Fase 1 — Marketplace Connect Phase 2

**Estado: COMPLETADA (2026-07-25)**  
**Período:** Junio–Julio 2026

### Qué se construyó

**Phase 2A — Checkout integrado:**
- `StepRevisar.tsx` — fusión de selección de materiales y comparación de proveedores en un único paso
- `MarketplaceComprarView.tsx` — wizard reducido a 2 pasos (Revisar → Confirmar)
- Auto-selección de proveedores al entrar al paso de revisión
- CTA sticky en móvil + CTA inline en escritorio

**Phase 2B — Seguimiento de material:**
- `ScreenSeguimientoMaterial.tsx` — Realtime por canal `org-orders-{orgId}`
- Componentes compartidos en `src/components/marketplace/shared/`:
  - `OrderStatusBadge.tsx` — badge de estado normalizado (diferencia instalador/proveedor)
  - `OrderTimeline.tsx` — timeline animado con steps correctos por rol
  - `ConfirmModal.tsx` — modal accesible con focus trap, Escape, `aria-modal`
- Paginación del historial (HIST_PAGE_SIZE=20)
- Modales propios para confirmar recepción y cancelar

**Phase 2C — Portal del proveedor:**
- `PortalPedidos.tsx` — CTAs visibles sin expandir, búsqueda client-side, sort por edad, contadores por estado
- `PortalDashboard.tsx` — insights IA accionables, estado vacío con link
- `ADR-001` — Realtime en PortalPedidos diferido hasta confirmar `supplier_actor_id` en RLS

**Design System y Product Language:**
- `src/design-system/index.ts` — tokens de diseño
- `docs/design-system/DESIGN_SYSTEM_v1.md` — especificación completa
- `docs/design-system/PRODUCT_LANGUAGE_v1.md` — terminología normalizada

**Por qué en esta fase:**  
Sin el checkout integrado y el portal del proveedor, el Marketplace es unidireccional — el instalador pide pero el proveedor no puede responder. Las tres phases son necesarias juntas para que el ciclo completo sea funcional.

---

## Fase 2 — Consolidación UX para piloto comercial

> **⚠️ Nota (julio 2026):** Esta fase está siendo ejecutada bajo el marco ampliado **RC-1 Commercial Readiness**, que incluye el alcance original de Consolidación UX más cumplimiento legal, analytics, y narrativa comercial. Para el estado actual de cada tarea, ver [EXECUTION_BOARD.md](EXECUTION_BOARD.md).

**Estado: ACTIVA — gestionada como RC-1 Commercial Readiness**  
**Período:** Julio–Agosto 2026  
**Objetivo:** Hacer el producto presentable y legalmente sólido antes del primer piloto externo.

### Por qué antes que Sprint 2

Un proveedor real no puede evaluar el producto con inconsistencias visuales o lenguaje técnico visible. La consolidación UX es el prerequisito para cualquier piloto comercial, independientemente de cuántas funcionalidades nuevas se añadan.

### Qué incluye

1. **Consistencia visual en toda la app** — todas las pantallas del Marketplace usan tokens del Design System v1
2. **Product Language completo** — eliminar términos técnicos visibles al usuario en toda la interfaz
3. **Microinteracciones** — estados de hover, focus, transiciones consistentes
4. **Revisión responsive** — todas las pantallas funcionan correctamente en móvil
5. **Accesibilidad final** — todos los requisitos de la Constitution (section 8) cumplidos
6. **Checklist de producción** — lista de verificación sin bloqueadores para demo comercial
7. **Auditoría comparativa** — antes/después documentado

### Criterio de salida

Demo comercial ejecutable de principio a fin sin inconsistencias visuales, sin lenguaje técnico visible, y sin errores conocidos.

---

## Fase 3 — Motor IA Sprint 4

**Estado: EN PROGRESO (paralelo a Fase 2)**  
**Período:** Julio–Septiembre 2026  
**Objetivo:** Observabilidad y fiabilidad del motor IA en producción.

### Qué incluye (orden de prioridad)

**P1 — Fix max_tokens: COMPLETADO (v59)**  
Eliminado el bloque `isComplexJob`. `max_tokens: 8192` siempre. Benchmark: 98.2% OK.

**P2 — Regression Diff en AI Validation Center: PENDIENTE**  
Comparar dos ejecuciones caso a caso para validar que un cambio mejora sin regresionar. Prerequisito para P3-P6.

**P3 — Dashboard de observabilidad del motor IA: PENDIENTE**  
Métricas en tiempo real: tokens in/out, latencia P50/P95, finish_reason, versión activa.

**P4 — Mejora de detección de oficio: PENDIENTE**  
Solo si el análisis de los 85 casos fallidos (coincide_oficio=false) muestra patrones dominantes (≥10 casos con el mismo par oficio_esperado/oficio_detectado). Si los patrones son dispersos, se cierra sin cambios.

**P5 — SLA de latencia y alertas: PENDIENTE**  
Umbrales: P50 < 15s, P95 < 25s, alerta en P95 > 30s. Implementado sobre P3.

**P6 — Correlación benchmark ↔ producción real: PENDIENTE**  
Informe de qué % del benchmark representa el tráfico real de instaladores.

### Regla operativa del Sprint 4

Ninguna tarea de P3 a P6 se inicia sin el Regression Diff (P2) disponible para validar cambios.

---

## Fase 4 — Sprint 2 Marketplace

**Estado: PENDIENTE (bloqueado hasta cerrar Fase 2)**  
**Período:** Septiembre–Octubre 2026  
**Objetivo:** Cerrar las funcionalidades bloqueadas tras la consolidación UX.

### Qué incluye

**Infraestructura (prerequisito):**
- Supabase branch o proyecto separado para staging
- CI/CD básico en GitHub Actions (build + lint + E2E)
- `supabase.gen.ts` regenerado con todas las RPCs del Marketplace

**Realtime en Portal Proveedor:**
- Condicionado a resolver ADR-001: confirmar existencia de `supplier_actor_id` en esquema, auditar política RLS para canales de Realtime
- Seguir patrón de `ScreenSeguimientoMaterial.tsx`: `channelRef`, cleanup en return, indicador "En vivo"

**Notificaciones por email al proveedor:**
- Cuando llega un nuevo pedido, el proveedor recibe email de alerta
- Usar Edge Function `trade-email` (ya existe) con nuevo template de pedido recibido

**Registro auto-gestionado de proveedores:**
- Flujo de invitación + activación para que el proveedor se registre sin intervención de admin
- Reutilizar lógica de `AuthActivateView.tsx`

### Criterio de salida

Un proveedor nuevo puede registrarse, cargar su catálogo y recibir su primer pedido real sin intervención manual de TrabFlow.

---

## Fase 5 — Modelo de comisión (2027)

**Estado: PENDIENTE**  
**Período:** Enero–Marzo 2027  
**Objetivo:** TrabFlow cobra comisión por cada pedido completado.

### Por qué después de los pilotos

El modelo de comisión requiere acuerdo comercial previo con el proveedor y credibilidad ganada con pedidos reales. Sin pilotos exitosos, no hay argumento para que el proveedor acepte compartir ingresos.

### Qué incluye

- Stripe Connect: el proveedor crea cuenta conectada
- Split de pago: instalador paga al proveedor, TrabFlow retiene comisión (2-3%)
- `trade_marketplace_commissions` tabla
- Dashboard financiero (comisiones, GMV)
- Reporting para proveedores (pagos recibidos, liquidaciones)

---

## Fase 6 — Red de descubrimiento y valoraciones (2027)

**Estado: PENDIENTE**  
**Período:** Marzo–Junio 2027

### Qué incluye

- Catálogo público de proveedores (filtrable por oficio, provincia, rating)
- Sistema de valoraciones: instalador valora proveedor tras pedido completado
- Recomendaciones basadas en oficio y ubicación del instalador
- API pública REST (solo lectura en v1)
- Webhooks para ERP de proveedores

---

## Fase 7 — Internacionalización y expansión (2027–2028)

**Estado: PENDIENTE**  
**Período:** 2027–2028

### Qué incluye

- Localización a portugués e italiano
- Proveedores locales por país
- Normativa técnica por país (equivalentes de REBT, RITE para cada mercado)
- Adaptación del motor IA a idiomas locales

---

## Orden de prioridades en conflicto

Cuando dos tareas compitan por tiempo, este es el orden:

1. **Bloqueadores de producción** — bugs que afectan a usuarios activos
2. **Seguridad** — vulnerabilidades, keys expuestas, RLS incorrecta
3. **Piloto comercial** — cualquier cosa que bloquee la demo o el primer pedido real
4. **Motor IA** — latencia, regresiones, TRUNCADO en producción
5. **Consolidación UX** — consistencia visual, Product Language
6. **Nuevas funcionalidades** — solo tras cerrar las fases anteriores

---

## Deuda técnica documentada (sin fecha)

| Deuda | Descripción | Impacto |
|---|---|---|
| Monolito `AppDashboardView.tsx` | 10.617 líneas. Extraer módulos a archivos propios. | Mantenimiento |
| Monolito `src/lib/supabase.ts` | 3.987 líneas. Migrar a `src/lib/api/`. | Mantenimiento |
| `supabase.gen.ts` desactualizado | Regenerar y eliminar los `as any` del Marketplace. | Tipos correctos |
| Seeds sin oficio (`undefined_b1.sql`) | Clasificar partidas sin oficio asignado. | Calidad catálogo |
| Normativa pendiente de PDF | CTE DB-SE, DB-SUA, DB-HR, IDAE. | Asistente técnico |
| App móvil (Expo) con cobertura mínima | Solo 9 pantallas. Añadir flujos críticos. | UX campo |
| `e2e/.auth/*.json` en repositorio | Revisar `.gitignore`. | Seguridad menor |
| Timeout de cliente en motor IA | El frontend no tiene timeout explícito en el request al motor. Si el servidor tarda 48s, el cliente espera. | UX |
| Errores silenciados en billing | `apply_scheduled_plan_if_due` captura excepciones en catch vacío. | Fiabilidad |
