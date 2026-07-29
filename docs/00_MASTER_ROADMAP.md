# TrabFlow — Master Roadmap

**Versión:** 1.0 — Julio 2026  
**Estado:** Normativo. Última actualización basada en estado real del repositorio.  
**Audiencia:** Fundador, futuros inversores, socios estratégicos.

---

## Visión del producto

> **Ser la plataforma operativa estándar del instalador europeo.**

En 2036, un fontanero en Lisboa, un electricista en Berlín, y un instalador HVAC en Milán usan TrabFlow para gestionar su empresa. No porque no haya alternativas, sino porque TrabFlow es la única plataforma construida exclusivamente para instaladores técnicos, con IA integrada desde el primer día, y con los catálogos de los distribuidores locales conectados directamente.

**Misión 2026:**  
Dar a cada instalador español las herramientas que solo tienen las grandes empresas: presupuesto profesional en 30 segundos, factura legal en un clic, gestión de contratos de mantenimiento, y seguimiento de técnicos de campo. Todo desde el móvil. Todo en su idioma.

---

## Objetivos 2026

| Objetivo | Indicador | Estado |
|---|---|---|
| 20 usuarios piloto activos | Usuarios registrados y usando app ≥ 2 veces/semana | En proceso |
| 1 acuerdo con asociación gremial (CONAIF / FENIE / APIEM) | Contrato firmado | Pendiente |
| 1 piloto con distribuidor material (OBRAMAT / SALTOKI / SONEPAR) | Catálogo integrado + 1 pedido real | Pendiente (demo preparada) |
| Motor IA en producción con 98%+ de presupuestos generados correctamente | OK rate benchmark 400 casos | **Completado: 98.2% (v59)** |
| Marketplace Phase 2 en producción | Checkout + Seguimiento + Portal proveedor | **Completado: 2026-07-25** |
| App web con paridad funcional para piloto comercial | Checklist de producción sin bloqueadores | En consolidación UX |
| Primeros ingresos de suscripción | ≥ 5 clientes de pago | En proceso |

---

## Objetivos 2027

| Objetivo | Indicador |
|---|---|
| 100 clientes de pago (instaladores) | MRR > 3.000 € |
| 5 proveedores integrados en TrabFlow Connect | Catálogos activos + pedidos reales |
| Modelo de comisión operativo (Stripe Connect) | GMV > 50.000 € / mes |
| Primer acuerdo internacional (Portugal o Italia) | 1 acuerdo firmado |
| Ronda seed cerrada | 300K–500K € |
| App móvil en paridad con web | Expo/React Native — todos los flujos críticos |

---

## Objetivos 2028

| Objetivo | Indicador |
|---|---|
| 500 clientes de pago en España | MRR > 15.000 € |
| Operaciones en 2 países adicionales | Localización + proveedores locales |
| 20 proveedores integrados | GMV > 500.000 € / mes |
| API pública para integraciones ERP | 3 integraciones productivas |
| Serie A | 1.5M–3M € |

---

## Estado actual del producto (julio 2026)

### Lo que existe y funciona en producción

| Módulo | Estado | Notas |
|---|---|---|
| **Motor IA voz-a-presupuesto** | ✅ Producción | v59 — 98.2% OK rate — 400 casos benchmark |
| **Presupuestos** | ✅ Producción | Por voz, por foto, manual — PDF automático — WhatsApp |
| **Facturas** | ✅ Producción | Desde presupuesto, estados, PDF, vista pública con token |
| **Clientes** | ✅ Producción | CRUD completo, historial |
| **Trabajos** | ✅ Producción | Planificación, seguimiento, parte de trabajo firmado |
| **Ruta del día** | ✅ Producción | Optimización nearest-neighbor |
| **Equipo** | ✅ Producción | Técnicos, roles, partes de trabajo |
| **Contratos mantenimiento** | ✅ Producción | SAT, facturación automática, plantillas DOCX |
| **Asistente técnico** | ✅ Producción | Normativa REBT, RITE, CTE, AEAT, SS — límites por plan |
| **Subcontratas** | ✅ Producción | Solo plan empresa_plus |
| **Catálogos de proveedor** | ✅ Producción | CSV, búsqueda semántica, aprendizaje de preferencias |
| **Marketplace — Checkout** | ✅ Producción | Wizard 2 pasos, auto-selección, estrategias precio/plazo |
| **Marketplace — Seguimiento** | ✅ Producción | Realtime por canal org, timeline, paginación historial |
| **Marketplace — Portal proveedor** | ✅ Producción | Dashboard, pedidos, catálogo, configuración, equipo |
| **Suscripciones + Stripe** | ✅ Producción | Trial 3 meses, planes, portal cliente, webhooks |
| **Admin Panel** | ✅ Producción | KPIs, orgs, IA validation, docs, suppliers, normativa |
| **Chatbot de ayuda** | ✅ Producción | Claude Haiku, conoce todos los módulos |
| **Notificaciones push** | ✅ Producción | Web Push / VAPID, outbox consumer |
| **Onboarding wizard** | ✅ Producción | 7 pasos, seed de catálogo, invitación equipo |
| **Demo interactiva** | ✅ Producción | Sin login, guía paso a paso para distribuidores |
| **PWA** | ✅ Producción | Instalable desde navegador, sin tiendas |
| **App móvil (Expo)** | ⚠️ Parcial | Solo funciones básicas — no en paridad con web |

### Lo que está en desarrollo activo

| Tarea | Ámbito | Prioridad |
|---|---|---|
| Consolidación Design System | Visual, Product Language, accesibilidad | Alta |
| Revisión responsive completa | Todas las pantallas del Marketplace | Alta |
| Preparación checklist producción piloto | Auditoría antes/después | Alta |
| Sprint 4 Motor IA (observabilidad, regression diff) | Admin Panel IA | Media |

### Lo que no existe aún (deuda o pendiente)

| Funcionalidad | Bloqueado por | Cuándo |
|---|---|---|
| Realtime en Portal Proveedor | Confirmar `supplier_actor_id` en RLS (ver ADR-001) | Sprint 2 |
| Registro auto-gestionado de proveedores | Modelo de datos `trade_supplier_accounts` | Sprint 2 |
| Modelo comisión (Stripe Connect) | Piloto validado primero | 2027 |
| Valoraciones de proveedores | Piloto validado primero | 2027 |
| API pública para ERP | Post-PMF | 2027 |
| Catálogo público de descubrimiento | Post-PMF | 2027 |
| Staging separado de producción | Deuda infra | Antes Sprint 2 |
| CI/CD automatizado | Deuda infra | Antes Sprint 2 |
| App móvil en paridad con web | Expo — alta prioridad 2027 | 2027 |

---

## Roadmap completo

### Fase 0 — Base ERP + Motor IA (COMPLETADA)

**Período:** Ene–Jun 2026  
**Qué se construyó:** La aplicación de gestión completa para el instalador. Motor IA voz-a-presupuesto. Catálogos de proveedor. Contratos de mantenimiento. Facturación. Billing con Stripe. Asistente técnico con normativa real.

**Estado:** Producción. Sin deuda pendiente.

---

### Fase 1 — Marketplace Connect Phase 2 (COMPLETADA)

**Período:** Jun–Jul 2026  
**Qué se construyó:**

- **Phase 2A** — Checkout integrado (wizard 2 pasos, auto-selección de proveedor)
- **Phase 2B** — Seguimiento de material en tiempo real (Supabase Realtime, timeline animado)
- **Phase 2C** — Portal del proveedor (gestión de pedidos, catálogo, dashboard con IA)
- Design System v1 (tokens, componentes compartidos)
- Product Language v1 (terminología normalizada)

**Estado:** Producción. ADR-001 documenta la decisión de diferir Realtime en portal proveedor.

---

### Fase 2 — Consolidación UX para piloto comercial (ACTIVA — gestionada como RC-1 Commercial Readiness)

> **Nota (julio 2026):** Esta fase está siendo ejecutada bajo el marco **RC-1 Commercial Readiness**, que amplía su alcance a cumplimiento legal, analytics y narrativa comercial. Estado actual en [EXECUTION_BOARD.md](EXECUTION_BOARD.md).

**Período:** Jul–Ago 2026  
**Objetivo:** Hacer el producto presentable y legalmente sólido antes del primer piloto externo. No se añaden funcionalidades.

**Ámbito:**
1. Revisión visual completa de todas las pantallas del Marketplace
2. Consistencia del Design System en toda la app
3. Product Language en todos los textos visibles
4. Microinteracciones y accesibilidad
5. Checklist de producción para piloto
6. Auditoría comparativa antes/después

**Criterio de salida:** Demo comercial funcional sin inconsistencias visuales ni lenguaje técnico visible.

---

### Fase 3 — Sprint 2 Marketplace (PENDIENTE)

**Período:** Sep–Oct 2026  
**Objetivo:** Cerrar las funcionalidades bloqueadas tras la consolidación UX.

**Ámbito previsto (no iniciado):**
- Realtime en Portal Proveedor (condicionado a ADR-001 resuelto)
- Registro auto-gestionado de proveedores
- Notificaciones por email al proveedor cuando llega pedido
- Infraestructura de staging + CI/CD básico

**Dependencias:** Consolidación UX cerrada. ADR-001 resuelto.

---

### Fase 4 — Motor IA Sprint 4 (PARALELO)

**Período:** Jul–Sep 2026  
**Objetivo:** Observabilidad y fiabilidad del motor IA en producción.

**Ámbito (según SPRINT4_PLAN.md):**
- P1: Fix max_tokens — **COMPLETADO** (v59)
- P2: Regression Diff en AI Validation Center — pendiente
- P3: Dashboard de observabilidad del motor IA — pendiente
- P4: Mejora de detección de oficio — pendiente
- P5: SLA de latencia y alertas — pendiente
- P6: Correlación benchmark ↔ producción real — pendiente

---

### Fase 5 — Modelo de comisión y red de descubrimiento (2027)

**Período:** Ene–Mar 2027  
**Objetivos:**
- Stripe Connect para split de pagos proveedor/TrabFlow
- Valoraciones de proveedores tras pedido
- Catálogo público de búsqueda de proveedores
- Webhooks para ERP de proveedores

**Dependencias:** Piloto con 2+ proveedores reales completado.

---

### Fase 6 — Inteligencia de mercado e internacionalización (2027–2028)

**Período:** 2027–2028  
**Objetivos:**
- Comparativa de precios entre proveedores por región
- Predicción de demanda basada en estacionalidad
- Localización a portugués e italiano
- API pública para integraciones ERP

---

## Dependencias entre módulos

```
Motor IA (voz-a-presupuesto)
    └─ depende de: trade_actuaciones (KB de partidas), trade_catalog_products
    └─ alimenta: trade_quotes, trade_quote_items

Presupuesto
    └─ depende de: Clientes, Catálogo, Motor IA
    └─ activa: Factura, Trabajo, Marketplace Checkout

Factura
    └─ depende de: Presupuesto o Trabajo
    └─ activa: Stripe (si pago digital)

Trabajo
    └─ depende de: Presupuesto
    └─ activa: Parte de trabajo, Valoración, Seguimiento material

Mantenimiento (SAT)
    └─ depende de: Clientes, Contratos
    └─ activa: Facturación automática, Notificaciones email

Marketplace Checkout
    └─ depende de: Presupuesto o Trabajo, Catálogos de proveedor, Portal Proveedor activo
    └─ activa: Órdenes marketplace, Notificaciones push, Seguimiento

Portal Proveedor
    └─ depende de: Sistema de actores marketplace, Catálogo universal
    └─ activa: Ciclo de vida del pedido, Notificaciones

Asistente Técnico
    └─ depende de: Normativa vectorizada (chunks Supabase), Plan del usuario
    └─ independiente del resto de módulos

Stripe
    └─ depende de: trade_subscriptions, trade_organizations
    └─ desbloquea: funcionalidades por plan
```

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Latencia P95 del motor IA supera 30s en producción | Media | Alto | SLA activo + alerta (Sprint 4 P5) |
| Proveedor piloto rechaza el portal por UX inconsistente | Media | Crítico | Consolidación UX antes de pilotos |
| Deuda técnica en AppDashboardView (10.617 líneas) genera bugs difíciles de aislar | Media | Alto | Refactoring progresivo, post-PMF |
| App móvil insuficiente genera churn en usuarios campo | Alta | Medio | Prioridad 2027 |
| Tipo generado (supabase.gen.ts) desactualizado bloquea TypeScript correcto | Actual | Medio | Regenerar tras cada sprint con migraciones |
| Sin staging separado, cualquier migración va directo a producción | Alta | Crítico | Crear Supabase branch antes de Sprint 2 |
| ADR-001 no resuelto bloquea Realtime en portal proveedor indefinidamente | Baja | Medio | Sprint 2: confirmar columna y auditar RLS |

---

## Prioridades actuales (julio 2026)

> Las prioridades se gestionan bajo **RC-1 Commercial Readiness**. Ver [EXECUTION_BOARD.md](EXECUTION_BOARD.md) para el estado actual de cada tarea.

1. **RC1-Alpha** — bloqueantes legales, analytics, narrativa comercial ← ACTIVO
2. **Consolidación UX** — sin esto no hay piloto comercial posible
3. **Motor IA Sprint 4 (P2–P6)** — sin observabilidad, no se puede optimizar con seguridad
4. **Piloto OBRAMAT** — primer cliente B2B validado
5. **Staging + CI/CD** — prerequisito para Sprint 2 seguro

---

## Definición de hitos

### MVP (alcanzado en jun 2026)
Un instalador puede crear un presupuesto por voz, enviarlo al cliente, que el cliente lo acepte por link, generar la factura, y gestionar sus contratos de mantenimiento. Todo sin salir de TrabFlow.

### Programa Piloto / Despliegue controlado (jul 2026 — en progreso)
El instalador puede además pedir material directamente desde el presupuesto a través del Marketplace, con seguimiento en tiempo real. El proveedor gestiona sus pedidos desde su portal.

### Lanzamiento (objetivo: oct 2026)
- Checklist de producción completo (cero bloqueadores en demo)
- 1 proveedor real integrado con catálogo
- 1 acuerdo con asociación firmado
- App web completa y consolidada
- App móvil con flujos críticos cubiertos

### Post-lanzamiento (2027)
Modelo de comisión, registro de proveedores auto-gestionado, valoraciones, red de descubrimiento, internacionalización.
